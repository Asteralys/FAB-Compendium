/**
 * Duel — compteur de vie à deux tapis.
 *
 * Repris de ce qui marche sur les compteurs FaB et Magic : illustration du
 * héros en fond, tap à gauche pour retirer / à droite pour ajouter, panneau
 * adverse retourné pour le face-à-face, coups groupés pendant 1,6 s avant
 * d'entrer au journal (on tape « −3 » en trois fois, une seule ligne d'historique).
 */

import { html, raw, qs, qsa, toast, buzz } from "../core/dom.js";
import { S, commit, save, uid, deckById } from "../core/store.js";
import { heroById, heroSubtitle } from "../data/heroes.js";
import { icon } from "../ui/icons.js";
import { openSheet, closeSheet, confirmSheet } from "../ui/sheet.js";
import { pickHero } from "../ui/heropicker.js";
import { crest, clock, today } from "../ui/components.js";
import { FORMATS, ageMismatchIssue } from "../data/rules.js";
import { openTournament } from "./tournaments.js";
import { goToTab } from "../core/nav.js";

const BATCH_MS = 3000;

/* Brouillon de mise en place, conservé le temps de la session. */
let setup = {
  p1: { heroId: null, artUrl: null, deckId: "" },
  p2: { heroId: null, artUrl: null, oppDeck: "" },
  format: "Classic Constructed",
  event: "",
  initiative: null
};

const pending = { p1: 0, p2: 0 };
let flushTimer = null;
let tick = null;
let wakeLock = null;

/* =========================== rendu =========================== */

export function render() {
  return S.duel ? board() : setupScreen();
}

export function mount(root) {
  if (S.duel) mountBoard(root);
  else mountSetup(root);
}

export function unmount() {
  clearInterval(tick); tick = null;
  flushPending();
  releaseWake();
}

/* ------------------------ mise en place ---------------------- */

function slot(side) {
  const s = setup[side];
  const h = heroById(s.heroId);
  return html`<button class="slot ${side}" data-pick="${side}">
    <span class="who">${side === "p1" ? "Joueur 1 · moi" : "Joueur 2 · adverse"}</span>
    ${crest(h, s.artUrl, "lg")}
    <span class="hn">${h ? h.name : "Choisir un héros"}</span>
    ${h ? html`<span class="pill gold">${h.life} PV</span>` : html`<span class="pill">—</span>`}
    ${h ? html`<span class="small faint">${heroSubtitle(h)}</span>` : ""}
  </button>`;
}

function setupScreen() {
  const mismatch = ageMismatchIssue(heroById(setup.p1.heroId), heroById(setup.p2.heroId));
  const ready = setup.p1.heroId && setup.p2.heroId && !mismatch;
  return html`<div class="setup">
    <div>
      <div class="eyebrow">Nouvelle partie</div>
      <h1 class="title">Préparer le duel</h1>
    </div>

    <div class="sidechoice">${slot("p1")}${slot("p2")}</div>

    ${mismatch ? html`<div class="panel warn">
      <div class="errorline">${icon("warn", 15)}<span>${mismatch}</span></div>
    </div>` : ""}

    <div class="panel gilt stack tight">
      <label class="field"><span>Mon deck</span>
        <select id="su-deck">
          <option value="">— sans deck —</option>
          ${raw(S.decks.map((d) => `<option value="${d.id}" ${d.id === setup.p1.deckId ? "selected" : ""}>${d.name}</option>`).join(""))}
        </select>
      </label>
      <label class="field"><span>Deck adverse</span>
        <input id="su-oppdeck" value="${setup.p2.oppDeck}" placeholder="archétype, optionnel">
      </label>
      <div class="row">
        <label class="field grow"><span>Format</span>
          <select id="su-format">
            ${raw(FORMATS.map((f) => `<option ${f === setup.format ? "selected" : ""}>${f}</option>`).join(""))}
          </select>
        </label>
        <label class="field grow"><span>Événement</span>
          <input id="su-event" value="${setup.event}" placeholder="Armory, casual…">
        </label>
      </div>
    </div>

    <div class="panel stack tight">
      <div class="row">
        <div class="grow">
          <div class="eyebrow">Initiative</div>
          <div class="small muted" id="su-init">${setup.initiative || "Qui joue en premier ?"}</div>
        </div>
        <button class="btn" id="su-roll">Tirer au sort</button>
      </div>
    </div>

    <button class="btn primary block" id="su-start" ${ready ? "" : "disabled"} style="min-height:52px">
      ${mismatch ? "Adulte contre jeune : match impossible" : ready ? "Commencer le duel" : "Choisis les deux héros"}
    </button>
  </div>`;
}

function mountSetup(root) {
  root.addEventListener("click", async (e) => {
    const pick = e.target.closest("[data-pick]");
    if (pick) {
      const side = pick.dataset.pick;
      const res = await pickHero({
        title: side === "p1" ? "Mon héros" : "Héros adverse",
        heroId: setup[side].heroId,
        artUrl: setup[side].artUrl
      });
      if (res) {
        setup[side].heroId = res.heroId;
        setup[side].artUrl = res.artUrl;
        commit();
      }
      return;
    }

    if (e.target.closest("#su-roll")) {
      const first = Math.random() < 0.5 ? "Joueur 1" : "Joueur 2";
      setup.initiative = `${first} commence — l'autre joueur pioche une carte de plus.`;
      qs("#su-init", root).textContent = setup.initiative;
      buzz(20);
      return;
    }

    if (e.target.closest("#su-start")) {
      readSetup(root);
      startDuel();
    }
  });

  root.addEventListener("change", () => readSetup(root));
}

function readSetup(root) {
  setup.p1.deckId = qs("#su-deck", root)?.value || "";
  setup.p2.oppDeck = qs("#su-oppdeck", root)?.value.trim() || "";
  setup.format = qs("#su-format", root)?.value || setup.format;
  setup.event = qs("#su-event", root)?.value.trim() || "";
  const deck = deckById(setup.p1.deckId);
  if (deck) setup.format = deck.format || setup.format;
}

function startDuel() {
  const h1 = heroById(setup.p1.heroId);
  const h2 = heroById(setup.p2.heroId);
  if (!h1 || !h2) return;
  const mismatch = ageMismatchIssue(h1, h2);
  if (mismatch) { toast(mismatch); return; }

  S.duel = {
    startedAt: Date.now(),
    format: setup.format,
    event: setup.event,
    initiative: setup.initiative,
    p1: { heroId: h1.id, artUrl: setup.p1.artUrl, deckId: setup.p1.deckId || null, life: h1.life, max: h1.life },
    p2: { heroId: h2.id, artUrl: setup.p2.artUrl, oppDeck: setup.p2.oppDeck, life: h2.life, max: h2.life },
    log: [],
    timer: { running: false, elapsed: 0, since: 0 }
  };
  commit();
}

/* ---------------------------- tapis -------------------------- */

function seat(side) {
  const p = S.duel[side];
  const h = heroById(p.heroId);
  const ratio = p.max ? p.life / p.max : 1;
  const tone = p.life <= 0 ? "dead" : ratio <= 0.15 ? "critical" : ratio <= 0.35 ? "low" : "";
  const flipped = side === "p2" && S.prefs.faceToFace;
  const art = p.artUrl || h?.arts?.[0]?.url;

  return html`<section class="seat ${flipped ? "is-flipped" : ""} ${art ? "" : "no-art"}" data-side="${side}">
    ${art ? raw(`<img class="art" alt="" src="${art}" onerror="this.closest('.seat').classList.add('no-art');this.remove()">`) : ""}
    <div class="veil"></div>
    <button class="tapzone minus" data-nudge="${side}:-1" aria-label="Retirer un point de vie">−</button>
    <button class="tapzone plus" data-nudge="${side}:1" aria-label="Ajouter un point de vie">+</button>
    <div class="content">
      <div class="banner">
        <span class="heroname">${h?.name || "—"}</span>
        ${h?.young ? html`<span class="pill young">Jeune</span>` : ""}
      </div>
      <div class="lifewrap">
        <span class="life ${tone}" data-life="${side}">${p.life}</span>
        <span class="delta" data-delta="${side}" hidden></span>
      </div>
      <div class="footer">
        <span class="herometa">${side === "p1" ? (deckById(p.deckId)?.name || heroSubtitle(h)) : (p.oppDeck || heroSubtitle(h))}</span>
        <span class="pipbar" title="Intellect — cartes en main">
          ${raw(Array.from({ length: h?.int || 4 }, () => '<i class="pip on"></i>').join(""))}
        </span>
      </div>
    </div>
  </section>`;
}

function railButton(action, name, label) {
  return html`<button data-act="${action}">${icon(name)}<span>${label}</span></button>`;
}

function board() {
  const d = S.duel;
  return html`<div class="duel">
    ${seat("p2")}
    <div class="rail">
      ${railButton("undo", "undo", "Annuler")}
      ${railButton("side", "cards", "Side")}
      ${railButton("log", "history", "Journal")}
      <button data-act="timer" class="timerbtn">
        <span class="clock" data-clock>${clock(elapsed())}</span>
        <span>${d.timer.running ? "Pause" : "Chrono"}</span>
      </button>
      ${railButton("end", "flag", "Fin")}
    </div>
    ${seat("p1")}
  </div>`;
}

const elapsed = () => {
  const t = S.duel?.timer;
  if (!t) return 0;
  return t.elapsed + (t.running ? (Date.now() - t.since) / 1000 : 0);
};

/* ------------------------ interactions ----------------------- */

function mountBoard(root) {
  requestWake();
  startTick(root);

  let holdTimer = null;
  let holdRepeat = null;

  const press = (el) => {
    const [side, step] = el.dataset.nudge.split(":");
    nudge(root, side, Number(step));
    holdTimer = setTimeout(() => {
      holdRepeat = setInterval(() => nudge(root, side, Number(step)), 110);
    }, 420);
  };
  const release = () => {
    clearTimeout(holdTimer);
    clearInterval(holdRepeat);
    holdTimer = holdRepeat = null;
  };

  qsa("[data-nudge]", root).forEach((el) => {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); press(el); });
    el.addEventListener("pointerup", release);
    el.addEventListener("pointerleave", release);
    el.addEventListener("pointercancel", release);
  });

  root.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    ({ undo, side: sidePlan, log: openLog, timer: toggleTimer, end: endSheet })[act]?.(root);
  });
}

function startTick(root) {
  clearInterval(tick);
  tick = setInterval(() => {
    const el = qs("[data-clock]", root);
    if (!el || !S.duel) return;
    const secs = elapsed();
    el.textContent = clock(secs);
    const limit = (S.prefs.roundLimit || 40) * 60;
    el.classList.toggle("warn", secs > limit - 300 && secs <= limit);
    el.classList.toggle("over", secs > limit);
  }, 1000);
}

/** Applique un delta et met à jour le DOM sans redessiner tout l'écran. */
function nudge(root, side, step) {
  if (!S.duel) return;
  const p = S.duel[side];
  p.life += step;
  pending[side] += step;
  buzz(8);

  const lifeEl = qs(`[data-life="${side}"]`, root);
  if (lifeEl) {
    lifeEl.textContent = p.life;
    const ratio = p.max ? p.life / p.max : 1;
    lifeEl.className = `life ${p.life <= 0 ? "dead" : ratio <= 0.15 ? "critical" : ratio <= 0.35 ? "low" : ""} bump`;
    setTimeout(() => lifeEl.classList.remove("bump"), 120);
  }

  const deltaEl = qs(`[data-delta="${side}"]`, root);
  if (deltaEl) {
    const v = pending[side];
    deltaEl.hidden = v === 0;
    deltaEl.textContent = v > 0 ? `+${v}` : String(v);
    deltaEl.className = `delta ${v < 0 ? "neg" : "pos"}`;
  }

  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => flushPending(root), BATCH_MS);
  save();
}

/** Verse les coups accumulés dans le journal. */
/**
 * @param {boolean} autoEnd Propose la fin de partie si un PV est tombé à 0.
 *   À false pour les appels internes à endSheet lui-même (sinon boucle : il
 *   vide déjà les coups en attente avant d'afficher sa propre feuille).
 */
function flushPending(root = document, autoEnd = true) {
  clearTimeout(flushTimer);
  flushTimer = null;
  let wrote = false;

  for (const side of ["p1", "p2"]) {
    if (!pending[side] || !S.duel) continue;
    S.duel.log.push({
      at: Math.round((Date.now() - S.duel.startedAt) / 1000),
      side,
      delta: pending[side],
      after: S.duel[side].life
    });
    pending[side] = 0;
    wrote = true;
    const el = qs(`[data-delta="${side}"]`, root);
    if (el) el.hidden = true;
  }
  if (!wrote) return;
  save();

  // Un des deux est tombé à 0 (ou moins) et le chiffre s'est stabilisé :
  // on propose directement d'enregistrer le résultat, sans étape en plus.
  if (autoEnd && S.duel && (S.duel.p1.life <= 0 || S.duel.p2.life <= 0) && !qs(".sheet")) {
    endSheet(root);
  }
}

/* --------------------------- actions ------------------------- */

function undo(root) {
  flushPending(root, false);
  const entry = S.duel.log.pop();
  if (!entry) { toast("Rien à annuler"); return; }
  S.duel[entry.side].life -= entry.delta;
  commit();
}

function toggleTimer() {
  const t = S.duel.timer;
  if (t.running) { t.elapsed = elapsed(); t.running = false; }
  else { t.since = Date.now(); t.running = true; }
  commit();
}

function openLog(root) {
  flushPending(root, false);
  const rows = [...S.duel.log].reverse();
  const inner = openSheet(
    `<h3>Journal des dégâts</h3>
     <p class="small muted">${rows.length} échange${rows.length > 1 ? "s" : ""} · départ ${S.duel.p1.max} / ${S.duel.p2.max} PV</p>
     <div class="log">${rows.length ? rows.map(logRow).join("") : '<div class="empty">Aucun coup enregistré.</div>'}</div>
     <div class="actions"><button class="btn" data-close>Fermer</button>
       <button class="btn danger" id="log-clear">Vider le journal</button></div>`
  );
  inner.querySelector("#log-clear").addEventListener("click", async () => {
    closeSheet();
    if (await confirmSheet("Vider le journal ?", "Les points de vie actuels ne changent pas.", "Vider")) {
      S.duel.log = [];
      commit();
    }
  });
}

function logRow(e) {
  const h = heroById(S.duel[e.side].heroId);
  return `<div class="logrow">
    <span class="t">${clock(e.at)}</span>
    <span class="who ${e.side}">${h?.name?.split(",")[0] || e.side}</span>
    <span class="d ${e.delta < 0 ? "neg" : "pos"}">${e.delta > 0 ? "+" : ""}${e.delta}</span>
    <span class="after">→ ${e.after}</span>
  </div>`;
}

function sidePlan() {
  const deck = deckById(S.duel.p1.deckId);
  const oppId = S.duel.p2.heroId;
  const opp = heroById(oppId);

  if (!deck) {
    openSheet(`<h3>Plan de side</h3>
      <p class="muted small">Aucun deck n'est associé à cette partie. Choisis un deck au lancement du duel pour retrouver tes plans ici.</p>
      <div class="actions"><button class="btn" data-close>Fermer</button></div>`);
    return;
  }

  const plan = (deck.plans || []).find((p) => p.oppHeroId === oppId);
  openSheet(`<h3>${deck.name} <span class="muted">vs ${opp?.name || "?"}</span></h3>
    ${plan ? `<div class="plan"><div class="swap">
        <div class="col in"><h4>Entrées</h4><ul>${listItems(plan.in)}</ul></div>
        <div class="col out"><h4>Sorties</h4><ul>${listItems(plan.out)}</ul></div>
      </div>${plan.notes ? `<p class="small muted">${escapeText(plan.notes)}</p>` : ""}</div>`
      : `<div class="empty">Pas encore de plan contre ${opp?.name || "ce héros"}.<br>Tu peux le créer depuis l'onglet Decks.</div>`}
    <div class="actions"><button class="btn" data-close>Fermer</button></div>`);
}

const escapeText = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const listItems = (t) => String(t ?? "").split("\n").filter(Boolean).map((l) => `<li>${escapeText(l)}</li>`).join("") || "<li class='faint'>—</li>";

function endSheet(root) {
  flushPending(root, false);
  const d = S.duel;
  const h1 = heroById(d.p1.heroId);
  const h2 = heroById(d.p2.heroId);
  const p1Down = d.p1.life <= 0;
  const p2Down = d.p2.life <= 0;

  // Les deux boutons proposent la même action (« tape le héros qui a gagné »).
  // « Victoire »/« Défaite » fixés à gauche/droite induisaient en erreur :
  // le joueur à 0 PV n'est pas toujours à gauche.
  const inner = openSheet(`<h3>Fin de partie</h3>
    <p class="small muted">Qui l'emporte ? Le match part directement dans tes statistiques.</p>
    <div class="sidechoice">
      <button class="slot p1" data-win="p1"><span class="who">Vainqueur</span>
        <span class="hn">${escapeText(h1?.name)}</span>
        <span class="pill ${p1Down ? "loss" : "gold"}">${d.p1.life} PV${p1Down ? " · à terre" : ""}</span></button>
      <button class="slot p2" data-win="p2"><span class="who">Vainqueur</span>
        <span class="hn">${escapeText(h2?.name)}</span>
        <span class="pill ${p2Down ? "loss" : "gold"}">${d.p2.life} PV${p2Down ? " · à terre" : ""}</span></button>
    </div>
    <div class="actions">
      <button class="btn" data-close>Continuer la partie</button>
      <button class="btn danger" id="end-drop">Abandonner sans noter</button>
    </div>`);

  inner.addEventListener("click", (e) => {
    const win = e.target.closest("[data-win]");
    if (win) { closeSheet(); recordMatch(win.dataset.win); }
  });
  inner.querySelector("#end-drop").addEventListener("click", async () => {
    closeSheet();
    if (await confirmSheet("Abandonner ce duel ?", "La partie ne sera pas enregistrée.", "Abandonner")) {
      S.duel = null;
      releaseWake();
      commit();
    }
  });
}

function recordMatch(winner) {
  const d = S.duel;
  const isRound = !!d.tournamentId;

  S.matches.unshift({
    id: uid(),
    date: today(),
    deckId: d.p1.deckId || null,
    heroId: d.p1.heroId,
    artUrl: d.p1.artUrl || null,
    oppHeroId: d.p2.heroId,
    artUrlOpp: d.p2.artUrl || null,
    oppDeck: d.p2.oppDeck || "",
    result: winner === "p1" ? "W" : "L",
    format: d.format,
    event: d.event || "",
    lifeP1: d.p1.life,
    lifeP2: d.p2.life,
    duration: Math.round(elapsed()),
    blows: d.log.length,
    ...(isRound ? { tournamentId: d.tournamentId, round: d.round, bo: d.bo } : {})
  });

  // On garde héros et deck pour enchaîner la partie suivante — sauf pour un
  // round de tournoi, où on repart plutôt sur sa fiche pour enchaîner le suivant.
  if (!isRound) {
    setup = {
      p1: { heroId: d.p1.heroId, artUrl: d.p1.artUrl, deckId: d.p1.deckId || "" },
      p2: { heroId: d.p2.heroId, artUrl: d.p2.artUrl, oppDeck: d.p2.oppDeck || "" },
      format: d.format,
      event: d.event,
      initiative: null
    };
  }

  const tournamentId = d.tournamentId;
  S.duel = null;
  releaseWake();

  if (isRound) {
    openTournament(tournamentId);
    commit();
    toast(`Round ${d.round} enregistré — ${winner === "p1" ? "victoire" : "défaite"}`);
    goToTab("tournaments");
  } else {
    commit();
    toast(winner === "p1" ? "Victoire enregistrée" : "Défaite enregistrée");
  }
}

/* ------------------------- écran allumé ---------------------- */

async function requestWake() {
  if (!S.prefs.keepAwake || wakeLock) return;
  try { wakeLock = await navigator.wakeLock?.request("screen"); }
  catch { /* non supporté : sans conséquence */ }
}

function releaseWake() {
  try { wakeLock?.release?.(); } catch { /* déjà relâché */ }
  wakeLock = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.duel) requestWake();
});
