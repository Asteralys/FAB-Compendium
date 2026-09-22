/**
 * Tournois : calendrier, puis fiche détaillée par tournoi avec les rondes
 * jouées (adversaire, Bo1/Bo3, score). Chaque ronde est aussi une entrée de
 * S.matches (tournamentId + round) : elle alimente les statistiques comme
 * n'importe quel autre match, sans logique séparée à maintenir.
 */

import { html, toast, esc } from "../core/dom.js";
import { S, commit, uid, deckById, tournamentById, record } from "../core/store.js";
import { heroById, preferredArt } from "../data/heroes.js";
import { openSheet, closeSheet, confirmSheet } from "../ui/sheet.js";
import { pickHero } from "../ui/heropicker.js";
import { crest, ratePill, formatDate, dayNumber, monthLabel, countdown, today, heroSelectGroups, deckOptions } from "../ui/components.js";
import { icon } from "../ui/icons.js";
import { FORMATS, ageMismatchIssue } from "../data/rules.js";
import { goToTab } from "../core/nav.js";

const KINDS = ["Armory", "Skirmish", "Road to Nationals", "Battle Hardened", "Pro Quest", "Nationals", "Calling", "Pro Tour", "Casual"];
const BO = ["Bo1", "Bo3"];

let openId = null;

export const render = () => (openId && tournamentById(openId) ? detail(tournamentById(openId)) : library());

/* --------------------------- calendrier --------------------------- */

function library() {
  const sorted = [...S.tournaments].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const now = today();
  const upcoming = sorted.filter((t) => (t.date || "9999") >= now);
  const past = sorted.filter((t) => (t.date || "9999") < now).reverse();

  return html`<div class="stack">
    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Calendrier</div>
        <h1 class="title">Tournois</h1>
      </div>
      <button class="btn" id="tr-new">${icon("plus")} Tournoi</button>
    </div>

    ${upcoming.length
      ? html`<div class="eyebrow">À venir</div>${upcoming.map((t) => card(t, false))}`
      : html`<div class="empty">Rien de prévu.<br>Note ton prochain Armory, Skirmish ou Battle Hardened.</div>`}

    ${past.length ? html`<div class="eyebrow" style="margin-top:6px">Passés</div>${past.map((t) => card(t, true))}` : ""}
  </div>`;
}

function card(t, isPast) {
  const deck = deckById(t.deckId);
  const soon = countdown(t.date);
  const r = record((m) => m.tournamentId === t.id);
  return html`<button class="panel event ${isPast ? "past" : ""}" data-open="${t.id}">
    <div class="date">
      <b>${dayNumber(t.date)}</b>
      <span>${monthLabel(t.date)}</span>
    </div>
    <div class="body">
      <div class="nm">${t.name}</div>
      <div class="small muted">${[t.kind, t.format, t.place].filter(Boolean).join(" · ")}</div>
      ${deck ? html`<div class="small muted">Deck : ${deck.name}</div>` : ""}
      ${r.played ? html`<div class="small muted">${r.wins}V / ${r.losses}D${r.rate !== null ? ` · ${r.rate}%` : ""}</div>` : ""}
      ${!isPast && soon ? html`<div class="countdown">${soon}</div>` : ""}
      ${isPast && t.standing ? html`<div class="small"><span class="pill gold">${t.standing}</span></div>` : ""}
    </div>
  </button>`;
}

/* ----------------------------- fiche ------------------------------- */

const tournamentRounds = (id) => S.matches.filter((m) => m.tournamentId === id).sort((a, b) => (a.round || 0) - (b.round || 0));

function detail(t) {
  const deck = deckById(t.deckId);
  const rounds = tournamentRounds(t.id);
  const r = record((m) => m.tournamentId === t.id);

  return html`<div class="stack">
    <button class="btn ghost" id="tr-back" style="align-self:flex-start;min-height:38px;padding:6px 12px">${icon("back")} Tournois</button>

    <div class="panel gilt stack tight">
      <div class="row">
        <div class="grow">
          <h1 class="title-sm">${t.name}</h1>
          <div class="small muted">${formatDate(t.date) || "date à définir"} · ${[t.kind, t.format, t.place].filter(Boolean).join(" · ")}</div>
          ${deck ? html`<div class="small muted">Deck : ${deck.name}</div>` : ""}
        </div>
        ${rounds.length ? html`<span style="text-align:right">${ratePill(r.rate)}<span class="meta" style="display:block">${r.wins}V / ${r.losses}D</span></span>` : ""}
      </div>
      <div class="row wrap" style="gap:6px">
        ${t.standing ? html`<span class="pill gold">${t.standing}</span>` : ""}
      </div>
      ${t.notes ? html`<div class="small faint">${esc(t.notes)}</div>` : ""}
    </div>

    ${t.fabraryUrl ? html`
      <a class="linkcard" href="${t.fabraryUrl}" target="_blank" rel="noopener noreferrer">
        <span class="glyph">${icon("scroll")}</span>
        <span class="grow"><b>Decklist FaBrary du tournoi</b><span class="truncate">${t.fabraryUrl}</span></span>
        ${icon("link")}
      </a>` : ""}

    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Rondes</div>
        <h2 class="title-sm">${rounds.length ? `${rounds.length} round${rounds.length > 1 ? "s" : ""}` : "Rounds"}</h2>
      </div>
      <button class="btn ghost" id="tr-addround-manual" style="min-height:38px;padding:6px 12px">Saisir</button>
      <button class="btn" id="tr-addround">${icon("plus")} Lancer un round</button>
    </div>

    ${rounds.length
      ? html`<div class="panel">${rounds.map((m) => roundRow(m))}</div>`
      : html`<div class="empty">Aucun round enregistré.<br>Ajoute chaque ronde au fil du tournoi : le résultat part directement dans tes statistiques.</div>`}

    <div class="row">
      <button class="btn grow" id="tr-edit">Modifier</button>
      <button class="btn danger" id="tr-del">Supprimer</button>
    </div>
  </div>`;
}

function roundRow(m) {
  const opp = heroById(m.oppHeroId);
  return html`<button class="matchrow" data-round="${m.id}">
    ${crest(opp, m.artUrlOpp)}
    <div class="grow">
      <div style="font-weight:600" class="truncate">Round ${m.round} · vs ${opp?.name || "?"}${m.oppDeck ? html` <span class="faint small">· ${m.oppDeck}</span>` : ""}</div>
      <div class="small muted truncate">${m.bo || "Bo1"}${m.score ? " · " + m.score : ""}</div>
    </div>
    <span class="pill ${m.result === "W" ? "win" : "loss"}">${m.result === "W" ? "V" : "D"}</span>
  </button>`;
}

/* ----------------------------- actions ------------------------------ */

export function mount(root) {
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#tr-new")) { form(null); return; }

    const open = e.target.closest("[data-open]");
    if (open) { openId = open.dataset.open; commit(); return; }

    if (e.target.closest("#tr-back")) { openId = null; commit(); return; }
    if (e.target.closest("#tr-edit")) { form(openId); return; }
    if (e.target.closest("#tr-addround")) { launchRound(openId); return; }
    if (e.target.closest("#tr-addround-manual")) { roundForm(openId, null); return; }

    const round = e.target.closest("[data-round]");
    if (round) { roundForm(openId, round.dataset.round); return; }

    if (e.target.closest("#tr-del")) {
      if (await confirmSheet("Supprimer ce tournoi ?", "Les rondes déjà jouées restent dans tes statistiques, seulement détachées du tournoi.", "Supprimer")) {
        S.tournaments = S.tournaments.filter((x) => x.id !== openId);
        openId = null;
        commit();
      }
    }
  });
}

/* --------------------------- formulaire ------------------------------ */

function form(id) {
  const t = id ? tournamentById(id) : { name: "", date: "", place: "", kind: "Armory", format: "Classic Constructed", deckId: "", notes: "", standing: "", fabraryUrl: "" };

  const inner = openSheet(`<h3>${id ? "Modifier le tournoi" : "Nouveau tournoi"}</h3>
    <label class="field"><span>Nom</span><input id="tf-name" value="${esc(t.name)}" placeholder="ex : Armory du samedi"></label>
    <div class="row">
      <label class="field grow"><span>Date</span><input id="tf-date" type="date" value="${esc(t.date)}"></label>
      <label class="field grow"><span>Type</span><select id="tf-kind">
        ${KINDS.map((k) => `<option ${k === t.kind ? "selected" : ""}>${k}</option>`).join("")}</select></label>
    </div>
    <label class="field"><span>Lieu</span><input id="tf-place" value="${esc(t.place)}" placeholder="Boutique, ville"></label>
    <div class="row">
      <label class="field grow"><span>Format</span><select id="tf-format">
        ${FORMATS.map((f) => `<option ${f === t.format ? "selected" : ""}>${f}</option>`).join("")}</select></label>
      <label class="field grow"><span>Deck utilisé</span><select id="tf-deck">
        <option value="">— à décider —</option>
        ${deckOptions(t.deckId)}</select></label>
    </div>
    <label class="field"><span>Lien decklist FaBrary</span><input id="tf-fabrary" value="${esc(t.fabraryUrl)}" placeholder="https://fabrary.net/decks/…"></label>
    <label class="field"><span>Classement / résultat final</span><input id="tf-standing" value="${esc(t.standing)}" placeholder="ex : 3-1, top 8"></label>
    <label class="field"><span>Notes</span><textarea id="tf-notes" placeholder="Inscription, horaire, covoiturage…">${esc(t.notes)}</textarea></label>
    <div class="actions"><button class="btn" data-close>Annuler</button>
      <button class="btn primary" id="tf-save">Enregistrer</button></div>`);

  inner.querySelector("#tf-save").addEventListener("click", () => {
    const data = {
      name: inner.querySelector("#tf-name").value.trim() || "Tournoi",
      date: inner.querySelector("#tf-date").value,
      kind: inner.querySelector("#tf-kind").value,
      place: inner.querySelector("#tf-place").value.trim(),
      format: inner.querySelector("#tf-format").value,
      deckId: inner.querySelector("#tf-deck").value,
      fabraryUrl: inner.querySelector("#tf-fabrary").value.trim(),
      standing: inner.querySelector("#tf-standing").value.trim(),
      notes: inner.querySelector("#tf-notes").value.trim()
    };
    if (id) Object.assign(tournamentById(id), data);
    else {
      const fresh = { id: uid(), ...data };
      S.tournaments.push(fresh);
      openId = fresh.id;
    }
    closeSheet();
    commit();
  });
}

/* ----------------------------- rondes -------------------------------- */

/**
 * Choisit le deck piloté pour ce round précis — pas forcément celui du
 * tournoi si le joueur pilote plusieurs decks au fil des rondes — pour que
 * les statistiques par deck restent justes. Résout `undefined` si annulé,
 * `null`/"" si « pas de deck », sinon l'id du deck choisi.
 */
function pickRoundDeck(defaultDeckId) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v) => { if (!settled) { settled = true; resolve(v); } };

    const inner = openSheet(`<h3>Quel deck pour ce round ?</h3>
      <label class="field"><span>Deck</span>
        <select id="rd-deck">
          <option value="">— pas de deck, juste un héros —</option>
          ${deckOptions(defaultDeckId)}
        </select>
      </label>
      <div class="actions"><button class="btn" data-close>Annuler</button>
        <button class="btn primary" id="rd-ok">Continuer</button></div>`,
      { onClose: () => finish(undefined) }
    );

    inner.querySelector("#rd-ok").addEventListener("click", () => {
      const v = inner.querySelector("#rd-deck").value || null;
      finish(v);
      closeSheet();
    });
  });
}

/**
 * Lance un round comme un vrai duel : choix du deck, des héros, puis bascule
 * sur l'onglet Duel avec le compteur de vie. À la fin de la partie, duel.js
 * enregistre le résultat directement dans ce round (voir recordMatch).
 */
async function launchRound(tournamentId) {
  const t = tournamentById(tournamentId);
  if (!t) return;
  if (S.duel) { toast("Termine d'abord le duel en cours (onglet Duel) avant d'en lancer un autre."); return; }

  let deckId = null;
  if (S.decks.length) {
    deckId = await pickRoundDeck(t.deckId);
    if (deckId === undefined) return;
  }

  const deck = deckId ? deckById(deckId) : null;
  let p1 = deck ? { heroId: deck.heroId, artUrl: preferredArt(deck.heroId) } : null;
  if (!p1?.heroId) {
    p1 = await pickHero({ title: "Mon héros" });
    if (!p1) return;
  }

  const p2 = await pickHero({ title: "Héros adverse" });
  if (!p2) return;

  const h1 = heroById(p1.heroId);
  const h2 = heroById(p2.heroId);
  const mismatch = ageMismatchIssue(h1, h2);
  if (mismatch) { toast(mismatch); return; }

  const rounds = tournamentRounds(tournamentId);
  const round = rounds.length ? Math.max(...rounds.map((x) => x.round || 0)) + 1 : 1;

  S.duel = {
    startedAt: Date.now(),
    format: t.format || "Classic Constructed",
    event: t.name,
    initiative: null,
    tournamentId: t.id,
    round,
    bo: "Bo1",
    p1: { heroId: p1.heroId, artUrl: p1.artUrl, deckId, life: h1.life, max: h1.life },
    p2: { heroId: p2.heroId, artUrl: p2.artUrl, oppDeck: "", life: h2.life, max: h2.life },
    log: [],
    timer: { running: false, elapsed: 0, since: 0 }
  };
  commit();
  goToTab("duel");
}

function roundForm(tournamentId, matchId) {
  const t = tournamentById(tournamentId);
  if (!t) return;
  const m = matchId ? S.matches.find((x) => x.id === matchId) : null;
  const rounds = tournamentRounds(tournamentId);
  const nextRound = m ? m.round : (rounds.length ? Math.max(...rounds.map((x) => x.round || 0)) + 1 : 1);
  let oppHeroId = m?.oppHeroId || null;

  const inner = openSheet(`<h3>${m ? `Modifier le round ${m.round}` : "Nouveau round"}</h3>
    <div class="row">
      <label class="field grow"><span>Round n°</span><input id="rf-round" type="number" min="1" value="${nextRound}"></label>
      <label class="field grow"><span>Format</span><select id="rf-bo">
        ${BO.map((b) => `<option ${(m ? m.bo === b : b === "Bo1") ? "selected" : ""}>${b}</option>`).join("")}</select></label>
    </div>
    <label class="field"><span>Héros adverse</span>
      <select id="rf-opp">
        <option value="">— choisir —</option>
        ${heroSelectGroups(oppHeroId)}
      </select>
    </label>
    <label class="field"><span>Deck adverse</span><input id="rf-oppdeck" value="${esc(m?.oppDeck)}" placeholder="optionnel"></label>
    <label class="field"><span>Score des manches (optionnel)</span><input id="rf-score" value="${esc(m?.score)}" placeholder="ex : 2-1"></label>
    <div class="actions">
      ${m ? `<button class="btn danger" id="rf-del">Supprimer</button>` : ""}
      <button class="btn" id="rf-loss">Défaite</button>
      <button class="btn primary" id="rf-win">Victoire</button>
    </div>`);

  inner.querySelector("#rf-opp").addEventListener("change", (e) => { oppHeroId = e.target.value || null; });

  const save = (result) => {
    if (!oppHeroId) { closeSheet(); openSheet(`<h3>Héros adverse manquant</h3><p class="muted small">Choisis contre qui tu as joué avant d'enregistrer ce round.</p><div class="actions"><button class="btn primary" data-close>Compris</button></div>`); return; }
    const data = {
      tournamentId,
      round: Number(inner.querySelector("#rf-round").value) || nextRound,
      bo: inner.querySelector("#rf-bo").value,
      date: t.date || today(),
      deckId: t.deckId || null,
      heroId: deckById(t.deckId)?.heroId || null,
      oppHeroId,
      artUrlOpp: preferredArt(oppHeroId),
      oppDeck: inner.querySelector("#rf-oppdeck").value.trim(),
      score: inner.querySelector("#rf-score").value.trim(),
      result,
      format: t.format || "",
      event: t.name
    };
    if (m) Object.assign(m, data);
    else S.matches.unshift({ id: uid(), ...data });
    S.matches.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    closeSheet();
    commit();
  };

  inner.querySelector("#rf-win").addEventListener("click", () => save("W"));
  inner.querySelector("#rf-loss").addEventListener("click", () => save("L"));
  inner.querySelector("#rf-del")?.addEventListener("click", async () => {
    closeSheet();
    if (await confirmSheet("Supprimer ce round ?", "Il disparaîtra aussi de tes statistiques.", "Supprimer")) {
      S.matches = S.matches.filter((x) => x.id !== m.id);
      commit();
    }
  });
}

/** Ouvre directement la fiche d'un tournoi (utilisé depuis duel.js en fin de round). */
export function openTournament(id) { openId = id; }
