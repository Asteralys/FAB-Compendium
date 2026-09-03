/** Decks : bibliothèque, decklist zonée, fiche détaillée et plans de side par matchup. */

import { html, raw, toast } from "../core/dom.js";
import { S, commit, save, uid, deckById, record } from "../core/store.js";
import { heroById, heroSubtitle } from "../data/heroes.js";
import {
  searchCards, cardByKey, cardsNamed, cardImage,
  parseDecklist, countList, PITCH_LABEL, defaultZone, isEquipmentCard
} from "../data/cards.js";
import { FORMATS, formatRules, deckIssues, splitZones, zoneTotal } from "../data/rules.js";
import { openSheet, closeSheet, confirmSheet } from "../ui/sheet.js";
import { pickHero, legendPill } from "../ui/heropicker.js";
import { crest, ratePill } from "../ui/components.js";
import { icon } from "../ui/icons.js";

const PITCHES = [["1", "Rouge"], ["2", "Jaune"], ["3", "Bleu"]];

let openId = null;

export const render = () => (openId && deckById(openId) ? detail(deckById(openId)) : library());

export function mount(root) {
  root.addEventListener("click", async (e) => {
    const open = e.target.closest("[data-deck]");
    if (open) { openId = open.dataset.deck; commit(); return; }

    if (e.target.closest("#dk-back")) { openId = null; commit(); return; }
    if (e.target.closest("#dk-new")) { deckForm(null); return; }
    if (e.target.closest("#dk-edit")) { deckForm(openId); return; }
    if (e.target.closest("#dk-plan")) { planForm(openId, null); return; }
    if (e.target.closest("#dk-addcard")) { cardPicker(openId); return; }
    if (e.target.closest("#dk-import")) { importSheet(openId); return; }

    const step = e.target.closest("[data-step]");
    if (step) { const [id, delta] = step.dataset.step.split("§"); adjust(openId, id, delta); return; }

    const zoneBtn = e.target.closest("[data-zone]");
    if (zoneBtn) { moveZone(openId, zoneBtn.dataset.zone); return; }

    const peek = e.target.closest("[data-card]");
    if (peek) { cardPreview(peek.dataset.card); return; }

    const plan = e.target.closest("[data-plan]");
    if (plan) { planForm(openId, plan.dataset.plan); return; }

    if (e.target.closest("#dk-del")) {
      if (await confirmSheet("Supprimer ce deck ?", "Les matchs déjà joués restent dans tes statistiques.", "Supprimer")) {
        S.decks = S.decks.filter((d) => d.id !== openId);
        openId = null;
        commit();
      }
    }
  });
}

/* --------------------------- liste --------------------------- */

function library() {
  return html`<div class="stack">
    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Bibliothèque</div>
        <h1 class="title">Mes decks</h1>
      </div>
      <button class="btn" id="dk-new">${icon("plus")} Deck</button>
    </div>

    ${S.decks.length
      ? S.decks.map((d) => {
          const h = heroById(d.heroId);
          const r = record((m) => m.deckId === d.id);
          const n = countList(d.list || []);
          return html`<button class="listitem" data-deck="${d.id}">
            ${crest(h, d.artUrl)}
            <span class="grow">
              <span class="name">${d.name}</span>
              <span class="meta">${h?.name || "héros inconnu"} · ${d.format}${n ? ` · ${n} cartes` : ""}</span>
            </span>
            <span style="text-align:right">
              ${ratePill(r.rate)}
              <span class="meta" style="display:block">${r.wins}V / ${r.losses}D</span>
            </span>
          </button>`;
        })
      : html`<div class="empty">Aucun deck pour l'instant.<br>Crée ton premier deck : liste, winrate, matchups et plans de side suivront.</div>`}
  </div>`;
}

/* --------------------------- fiche --------------------------- */

function detail(d) {
  const h = heroById(d.heroId);
  const r = record((m) => m.deckId === d.id);
  const plans = d.plans || [];
  const matchups = matchupTable((m) => m.deckId === d.id);
  const issues = deckIssues(d, h);

  return html`<div class="stack">
    <button class="btn ghost" id="dk-back" style="align-self:flex-start;min-height:38px;padding:6px 12px">${icon("back")} Mes decks</button>

    <div class="panel gilt deckhead">
      ${crest(h, d.artUrl, "lg")}
      <div class="info">
        <h1 class="title-sm">${d.name}</h1>
        <div class="small muted">${h?.name || "—"} · ${h?.life ?? "?"} PV · ${h ? heroSubtitle(h) : ""}</div>
        <div class="row wrap" style="gap:6px">
          <span class="pill gold">${d.format}</span>
          ${ratePill(r.rate)}
          <span class="pill">${r.wins}V / ${r.losses}D</span>
          ${h?.young ? html`<span class="pill young">Jeune</span>` : ""}
          ${h ? raw(legendPill(h.name)) : ""}
        </div>
      </div>
    </div>

    ${issues.length ? html`<div class="panel warn stack tight">
      <div class="eyebrow">À corriger</div>
      ${issues.map((msg) => html`<div class="errorline">${icon("warn", 15)}<span>${msg}</span></div>`)}
    </div>` : ""}

    ${d.notes ? html`<div class="panel small">${raw(escapeText(d.notes).replace(/\n/g, "<br>"))}</div>` : ""}

    ${decklistPanel(d)}

    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Sideboard</div>
        <h2 class="title-sm">Plans par matchup</h2>
      </div>
      <button class="btn" id="dk-plan">${icon("plus")} Plan</button>
    </div>

    ${plans.length
      ? plans.map((p) => planCard(d, p))
      : html`<div class="empty">Aucun plan enregistré.<br>Un plan par héros adverse s'affiche tout seul pendant le duel.</div>`}

    ${matchups ? html`<div class="panel">
      <div class="eyebrow" style="margin-bottom:6px">Matchups joués</div>
      <div class="scroll-x"><table>
        <thead><tr><th>Adversaire</th><th class="n">J</th><th class="n">V-D</th><th class="n">WR</th></tr></thead>
        <tbody>${matchups}</tbody>
      </table></div>
    </div>` : ""}

    <div class="row">
      <button class="btn grow" id="dk-edit">Modifier</button>
      <button class="btn danger" id="dk-del">Supprimer</button>
    </div>
  </div>`;
}

/* -------------------------- decklist ------------------------- */

/** Les decks créés avant l'ajout des zones n'ont pas d'identifiant de ligne. */
function ensureIds(list) {
  let changed = false;
  for (const e of list) if (!e.id) { e.id = uid(); changed = true; }
  return changed;
}

function decklistPanel(d) {
  const list = d.list || [];
  if (ensureIds(list)) save();

  const zones = splitZones(list);
  const rules = formatRules(d.format);
  const mainTotal = zoneTotal(zones.main);
  const equipTotal = zoneTotal(zones.equipment);
  const sideTotal = zoneTotal(zones.side);
  const total = mainTotal + equipTotal + sideTotal;

  return html`<div class="stack tight">
    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Decklist</div>
        <h2 class="title-sm">${total ? `${total} cartes` : "Liste"}</h2>
      </div>
      <button class="btn ghost" id="dk-import" style="min-height:38px;padding:6px 12px">Importer</button>
      <button class="btn" id="dk-addcard" style="min-height:38px;padding:6px 12px">${icon("plus")}</button>
    </div>

    ${total
      ? html`<div class="stack tight">
          ${zoneBlock("equipment", "Équipement", zones.equipment, equipTotal, rules)}
          ${zoneBlock("main", "Main Deck", zones.main, mainTotal, rules)}
          ${zoneBlock("side", "Sideboard", zones.side, sideTotal, rules)}
        </div>`
      : html`<div class="empty">Pas encore de liste.<br>Colle ton export FaBrary avec <b>Importer</b>, ou ajoute les cartes une par une.<br>
          <span class="small faint">La liste reste consultable hors connexion.</span></div>`}
  </div>`;
}

function zoneBlock(zoneKey, label, entries, total, rules) {
  let note = String(total);
  let offTarget = false;
  if (zoneKey === "main" && rules) {
    if (rules.deckExact != null) { note = `${total} / ${rules.deckExact}`; offTarget = total !== rules.deckExact; }
    else if (rules.deckMin != null) { note = `${total} / ${rules.deckMin}+`; offTarget = total < rules.deckMin; }
  } else if (zoneKey === "equipment" && rules) {
    note = `${total} en jeu`;
  }

  const emptyLabel = zoneKey === "side" ? "Aucune carte en sideboard."
    : zoneKey === "equipment" ? "Aucune arme ni équipement."
    : "Aucune carte dans le deck principal.";

  return html`<div class="panel stack tight">
    <div class="row" style="justify-content:space-between">
      <span class="eyebrow">${label}</span>
      <span class="small num" style="${offTarget ? "color:var(--loss);font-weight:700" : "color:var(--parchment-dim)"}">${note}</span>
    </div>
    ${entries.length
      ? html`<div class="stack" style="gap:0">${pitchGroups(entries).map((g) => group(g, zoneKey))}</div>`
      : html`<p class="small faint" style="margin:0">${emptyLabel}</p>`}
  </div>`;
}

function pitchGroups(entries) {
  const buckets = [
    { id: "1", label: "Rouge", items: [] },
    { id: "2", label: "Jaune", items: [] },
    { id: "3", label: "Bleu", items: [] },
    { id: "0", label: "Autres", items: [] }
  ];
  entries.forEach((e) => (buckets.find((b) => b.id === (e.pitch || "0")) || buckets[3]).items.push(e));
  buckets.forEach((b) => b.items.sort((a, c) => a.name.localeCompare(c.name, "fr")));
  return buckets.filter((b) => b.items.length);
}

function group(g, zoneKey) {
  const count = g.items.reduce((n, i) => n + i.qty, 0);
  return html`<div class="listgroup">
    <h4>${g.label} <span>${count}</span></h4>
    ${g.items.map((entry) => cardRow(entry, zoneKey))}
  </div>`;
}

function cardRow(entry, zoneKey) {
  const c = entry.card;
  const pitch = c?.pitch || "";
  return html`<div class="cardrow">
    <span class="pitchdot p${pitch || 0}" title="${PITCH_LABEL[pitch] || ""}"></span>
    <span class="qty">${entry.qty}</span>
    <button class="nm" data-card="${entry.key}">${entry.name}</button>
    ${c?.cost !== undefined && c?.cost !== "" ? html`<span class="cost">${c.cost}</span>` : ""}
    <button class="step" data-step="${entry.id}§-1" aria-label="Retirer un exemplaire">−</button>
    <button class="step" data-step="${entry.id}§1" aria-label="Ajouter un exemplaire">+</button>
    ${zoneKey !== "equipment"
      ? html`<button class="step" data-zone="${entry.id}" aria-label="${zoneKey === "main" ? "Passer en sideboard" : "Passer en deck principal"}" title="${zoneKey === "main" ? "Passer en sideboard" : "Passer en deck principal"}">${icon("swap", 14)}</button>`
      : ""}
  </div>`;
}

function adjust(deckId, id, delta) {
  const deck = deckById(deckId);
  if (!deck) return;
  deck.list = deck.list || [];
  const entry = deck.list.find((e) => e.id === id);
  if (!entry) return;
  entry.qty += Number(delta);
  if (entry.qty <= 0) deck.list = deck.list.filter((e) => e !== entry);
  commit();
}

function moveZone(deckId, id) {
  const deck = deckById(deckId);
  if (!deck) return;
  const entry = (deck.list || []).find((e) => e.id === id);
  if (!entry) return;
  const card = cardByKey(entry.key);
  if (isEquipmentCard(card)) { toast("Une arme ou un équipement reste en zone équipement."); return; }
  entry.zone = (entry.zone || defaultZone(card)) === "side" ? "main" : "side";
  commit();
  toast(entry.zone === "side" ? `${entry.name} → sideboard` : `${entry.name} → deck principal`);
}

/* ---------------------- ajout d'une carte -------------------- */

function cardPicker(deckId) {
  const deck = deckById(deckId);
  if (!deck) { toast("Ce deck n'existe plus."); return; }

  const hero = heroById(deck.heroId);
  const canRestrict = !!(hero && (hero.cls || []).length);
  const state = { query: "", pitch: null, allClasses: !canRestrict };

  const inner = openSheet(`<h3>Ajouter des cartes</h3>
    <label class="field"><span>Rechercher</span>
      <input id="cp-q" type="search" placeholder="Nom de carte, type…" autocomplete="off"></label>
    <div class="chiprow" id="cp-pitch">
      ${PITCHES.map(([v, l]) => `<button class="chip" data-pitch="${v}" aria-pressed="false">${l}</button>`).join("")}
      <button class="chip" data-pitch="" aria-pressed="false">Sans pitch</button>
    </div>
    ${canRestrict ? `<label class="switch"><input type="checkbox" id="cp-allclasses">
      <span>Voir toutes les classes (pas seulement Générique et ${hero.cls.join("/")})</span></label>` : ""}
    <div class="stack tight" id="cp-results"></div>
    <div class="actions"><button class="btn primary" data-close>Terminé</button></div>`);

  const results = inner.querySelector("#cp-results");

  function eligible(c) {
    if (state.allClasses) return true;
    return c.types.includes("Generic") || hero.cls.some((cl) => c.types.includes(cl));
  }

  function qtyOf(key) {
    return (deck.list || []).filter((e) => e.key === key).reduce((n, e) => n + e.qty, 0);
  }

  function draw() {
    if (!state.query && state.pitch === null) {
      results.innerHTML = `<div class="empty">Tape les premières lettres d'une carte.</div>`;
      return;
    }
    const list = searchCards(state.query, { pitch: state.pitch, limit: 150 }).filter(eligible);
    results.innerHTML = list.length
      ? list.map((c) => cardResultRow(c, qtyOf(c.key))).join("")
      : `<div class="empty">Aucune carte trouvée${canRestrict && !state.allClasses ? " pour la classe de ce héros — essaie « Voir toutes les classes »." : "."}</div>`;
  }

  inner.addEventListener("input", (e) => {
    if (e.target.id === "cp-q") { state.query = e.target.value; draw(); }
  });

  inner.addEventListener("change", (e) => {
    if (e.target.id === "cp-allclasses") { state.allClasses = e.target.checked; draw(); }
  });

  inner.addEventListener("click", (e) => {
    const pitch = e.target.closest("[data-pitch]");
    if (pitch) {
      const v = pitch.dataset.pitch;
      state.pitch = state.pitch === v ? null : v;
      inner.querySelectorAll("[data-pitch]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.pitch === state.pitch));
      draw();
      return;
    }

    const preview = e.target.closest("[data-card]");
    if (preview) { cardPreview(preview.dataset.card); return; }

    const adj = e.target.closest("[data-adj]");
    if (adj) {
      const [key, delta] = adj.dataset.adj.split("§");
      adjustQuiet(deck, key, Number(delta));
      draw();
    }
  });

  draw();
}

function cardResultRow(c, qty) {
  const stats = [c.cost !== "" ? `coût ${c.cost}` : "", c.power ? `${c.power} force` : "", c.defense ? `${c.defense} déf.` : ""].filter(Boolean).join(" · ");
  return `<div class="cardresult">
    <span class="pitchdot p${c.pitch || 0}"></span>
    <button class="thumb" data-card="${c.key}" aria-label="Voir ${escapeText(c.name)}">${c.img ? `<img alt="" loading="lazy" src="${cardImage(c.img)}" onerror="this.remove()">` : ""}</button>
    <button class="info" data-card="${c.key}"><b>${escapeText(c.name)}</b><span>${c.types.join(" ")}${stats ? " · " + stats : ""}</span></button>
    <span class="qtybox">
      <button class="step" data-adj="${c.key}§-1" aria-label="Retirer un exemplaire" ${qty ? "" : "disabled"}>−</button>
      <span class="q">${qty || 0}</span>
      <button class="step" data-adj="${c.key}§1" aria-label="Ajouter un exemplaire">+</button>
    </span>
  </div>`;
}

/** Ajout/retrait sans redessiner toute la vue depuis la feuille : elle reste ouverte pour enchaîner. */
function adjustQuiet(deck, key, delta) {
  deck.list = deck.list || [];
  const entry = deck.list.find((e) => e.key === key);
  if (entry) {
    entry.qty += delta;
    if (entry.qty <= 0) deck.list = deck.list.filter((e) => e !== entry);
  } else if (delta > 0) {
    const card = cardByKey(key);
    if (card) deck.list.push({ id: uid(), key, name: card.name, pitch: card.pitch, zone: defaultZone(card), qty: delta });
  }
  commit();
}

function cardPreview(key) {
  const card = cardByKey(key) || cardsNamed(key.split("|")[0])[0];
  if (!card) { toast("Carte introuvable."); return; }
  const url = cardImage(card.img);
  openSheet(`<h3>${escapeText(card.name)}</h3>
    <div class="row wrap" style="gap:6px">
      <span class="pill">${card.types.join(" · ")}</span>
      ${card.pitch ? `<span class="pill">Pitch ${PITCH_LABEL[card.pitch]}</span>` : ""}
      ${card.cost !== "" ? `<span class="pill">Coût ${card.cost}</span>` : ""}
      ${card.power ? `<span class="pill">${card.power} force</span>` : ""}
      ${card.defense ? `<span class="pill">${card.defense} défense</span>` : ""}
      <span class="pill ${card.cc ? "win" : "loss"}">CC ${card.cc ? "légal" : "non légal"}</span>
      <span class="pill ${card.blitz ? "win" : "loss"}">Blitz ${card.blitz ? "légal" : "non légal"}</span>
    </div>
    ${url ? `<div class="cardpreview"><img alt="${escapeText(card.name)}" src="${url}" onerror="this.closest('.cardpreview').innerHTML='<p class=\\'muted small\\'>Illustration indisponible hors connexion.</p>'"></div>` : ""}
    <div class="actions"><button class="btn" data-close>Fermer</button></div>`);
}

/* ------------------------ import FaBrary --------------------- */

function importSheet(deckId) {
  const deck = deckById(deckId);
  if (!deck) { toast("Ce deck n'existe plus."); return; }

  const inner = openSheet(`<h3>Importer une decklist</h3>
    <p class="small muted">Colle l'export texte de FaBrary, de Talishar ou ta propre liste.
    Formats reconnus : <code>3 Lightning Press (red)</code>, <code>(3) Lightning Press</code>, <code>3x Lightning Press</code>.
    Les titres <code>Weapons</code>, <code>Equipment</code>, <code>Sideboard</code> répartissent automatiquement les cartes dans les bonnes zones.</p>
    <label class="field"><span>Liste</span>
      <textarea id="im-text" style="min-height:180px" placeholder="Weapons:&#10;(1) Rosetta Thorn&#10;&#10;Deck:&#10;3 Lightning Press (red)&#10;3 Tear Asunder (yellow)&#10;&#10;Sideboard:&#10;2 Snatch"></textarea></label>
    <label class="switch"><input type="checkbox" id="im-replace" checked><span>Remplacer la liste actuelle</span></label>
    <div id="im-report"></div>
    <div class="actions">
      <button class="btn" data-close>Annuler</button>
      <button class="btn primary" id="im-go">Analyser</button>
    </div>`);

  const report = inner.querySelector("#im-report");
  let pending = null;

  inner.querySelector("#im-go").addEventListener("click", () => {
    if (pending) {
      if (inner.querySelector("#im-replace").checked) deck.list = [];
      deck.list = deck.list || [];
      pending.entries.forEach((entry) => {
        const found = deck.list.find((e) => e.key === entry.key && (e.zone || defaultZone(cardByKey(e.key))) === entry.zone);
        if (found) found.qty += entry.qty;
        else deck.list.push({ id: uid(), ...entry });
      });
      closeSheet();
      commit();
      toast(`${countList(pending.entries)} cartes importées`);
      return;
    }

    const text = inner.querySelector("#im-text").value;
    if (!text.trim()) { toast("Colle d'abord une liste."); return; }

    const result = parseDecklist(text);
    if (!result.entries.length) {
      report.innerHTML = `<div class="empty">Aucune carte reconnue dans ce texte.<br><span class="small faint">Vérifie l'orthographe des noms de cartes (en anglais).</span></div>`;
      return;
    }
    pending = result;
    report.innerHTML = `<div class="panel stack tight">
      <div><b>${countList(result.entries)} cartes</b> · ${result.entries.length} références</div>
      ${result.ambiguous.length ? `<div class="small" style="color:var(--pitch-yellow)">Couleur non précisée pour : ${result.ambiguous.map(escapeText).join(", ")}. La première version a été retenue.</div>` : ""}
      ${result.recolored.length ? `<div class="small" style="color:var(--pitch-yellow)">Couleur introuvable, corrigée : ${result.recolored.map(escapeText).join(" · ")}</div>` : ""}
      ${result.unknown.length ? `<div class="small" style="color:var(--loss)">Lignes ignorées : ${result.unknown.slice(0, 8).map(escapeText).join(" / ")}${result.unknown.length > 8 ? "…" : ""}</div>` : ""}
    </div>`;
    inner.querySelector("#im-go").textContent = "Importer";
  });
}

/* ------------------------- plans de side --------------------- */

function planCard(d, p) {
  const opp = heroById(p.oppHeroId);
  const r = record((m) => m.deckId === d.id && m.oppHeroId === p.oppHeroId);
  return html`<div class="panel stack tight">
    <div class="row">
      ${crest(opp, p.artUrl)}
      <div class="grow">
        <div class="name" style="font-weight:600">vs ${opp?.name || "?"}</div>
        <div class="small muted">${r.played ? `${r.wins}V / ${r.losses}D · ${r.rate}%` : "aucun match joué"}</div>
      </div>
      <button class="btn ghost" data-plan="${p.id}" style="min-height:36px;padding:6px 12px">Éditer</button>
    </div>
    <div class="plan"><div class="swap">
      <div class="col in"><h4>Entrées</h4><ul>${bullets(p.in)}</ul></div>
      <div class="col out"><h4>Sorties</h4><ul>${bullets(p.out)}</ul></div>
    </div></div>
    ${p.notes ? html`<div class="small muted">${p.notes}</div>` : ""}
  </div>`;
}

const bullets = (text) => {
  const items = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  return items.length ? items.map((l) => html`<li>${l}</li>`) : html`<li class="faint">—</li>`;
};

export function matchupTable(filter) {
  const buckets = new Map();
  S.matches.filter(filter).forEach((m) => {
    const key = m.oppHeroId || "?";
    const b = buckets.get(key) || { played: 0, wins: 0 };
    b.played++;
    if (m.result === "W") b.wins++;
    buckets.set(key, b);
  });
  if (!buckets.size) return null;

  return [...buckets.entries()]
    .sort((a, b) => b[1].played - a[1].played)
    .map(([id, b]) => {
      const rate = Math.round((b.wins / b.played) * 100);
      return html`<tr>
        <td>${heroById(id)?.name || "Inconnu"}</td>
        <td class="n">${b.played}</td>
        <td class="n">${b.wins}-${b.played - b.wins}</td>
        <td class="n" style="color:${rate >= 50 ? "var(--win)" : "var(--loss)"}">${rate}%</td>
      </tr>`;
    });
}

/* ------------------------ formulaires ------------------------ */

function deckForm(id) {
  const d = id ? deckById(id) : { name: "", heroId: null, artUrl: null, format: "Classic Constructed", notes: "", plans: [], list: [] };
  let heroId = d.heroId;
  let artUrl = d.artUrl;

  const inner = openSheet(`<h3>${id ? "Modifier le deck" : "Nouveau deck"}</h3>
    <button class="listitem" id="df-hero">
      ${crest(heroById(heroId), artUrl)}
      <span class="grow"><span class="name" id="df-heroname">${heroById(heroId)?.name || "Choisir un héros"}</span>
      <span class="meta" id="df-herometa">${heroById(heroId) ? heroSubtitle(heroById(heroId)) : "jeune ou adulte"}</span></span>
    </button>
    <label class="field"><span>Nom du deck</span><input id="df-name" value="${attr(d.name)}" placeholder="ex : Briar Aggro"></label>
    <label class="field"><span>Format</span><select id="df-format">
      ${FORMATS.map((f) => `<option ${f === d.format ? "selected" : ""}>${f}</option>`).join("")}</select></label>
    <label class="field"><span>Notes, plan de jeu</span><textarea id="df-notes" placeholder="Lien FaBrary, cartes clés, lignes de jeu…">${attr(d.notes)}</textarea></label>
    <div class="actions"><button class="btn" data-close>Annuler</button>
      <button class="btn primary" id="df-save">Enregistrer</button></div>`);

  inner.querySelector("#df-hero").addEventListener("click", async () => {
    const res = await pickHero({ title: "Héros du deck", heroId, artUrl });
    if (!res) return;
    heroId = res.heroId;
    artUrl = res.artUrl;
    const h = heroById(heroId);
    inner.querySelector("#df-heroname").textContent = h.name;
    inner.querySelector("#df-herometa").textContent = `${heroSubtitle(h)} · ${h.life} PV`;
    inner.querySelector(".crest").outerHTML = String(crest(h, artUrl));
  });

  inner.querySelector("#df-save").addEventListener("click", () => {
    if (!heroId) { toast("Choisis d'abord un héros — impossible d'enregistrer un deck sans héros."); return; }
    const name = inner.querySelector("#df-name").value.trim();
    const data = {
      name: name || "Deck sans nom",
      heroId, artUrl,
      format: inner.querySelector("#df-format").value,
      notes: inner.querySelector("#df-notes").value.trim()
    };
    if (id) Object.assign(deckById(id), data);
    else {
      const fresh = { id: uid(), plans: [], list: [], ...data };
      S.decks.push(fresh);
      openId = fresh.id;
    }
    closeSheet();
    commit();
  });
}

function planForm(deckId, planId) {
  const deck = deckById(deckId);
  deck.plans = deck.plans || [];
  const p = planId ? deck.plans.find((x) => x.id === planId) : { oppHeroId: null, artUrl: null, in: "", out: "", notes: "" };
  let oppHeroId = p.oppHeroId;
  let artUrl = p.artUrl;

  const inner = openSheet(`<h3>Plan de side</h3>
    <button class="listitem" id="pf-hero">
      ${crest(heroById(oppHeroId), artUrl)}
      <span class="grow"><span class="name" id="pf-heroname">${heroById(oppHeroId)?.name || "Héros adverse"}</span>
      <span class="meta">le plan s'ouvrira automatiquement pendant le duel</span></span>
    </button>
    <label class="field"><span>Cartes à rentrer</span><textarea id="pf-in" placeholder="Une carte par ligne">${attr(p.in)}</textarea></label>
    <label class="field"><span>Cartes à sortir</span><textarea id="pf-out" placeholder="Une carte par ligne">${attr(p.out)}</textarea></label>
    <label class="field"><span>Notes de matchup</span><textarea id="pf-notes" placeholder="Qui a l'initiative, quelles menaces bloquer…">${attr(p.notes)}</textarea></label>
    <div class="actions">
      ${planId ? '<button class="btn danger" id="pf-del">Supprimer</button>' : ""}
      <button class="btn" data-close>Annuler</button>
      <button class="btn primary" id="pf-save">Enregistrer</button>
    </div>`);

  inner.querySelector("#pf-hero").addEventListener("click", async () => {
    const res = await pickHero({ title: "Héros adverse", heroId: oppHeroId, artUrl });
    if (!res) return;
    oppHeroId = res.heroId;
    artUrl = res.artUrl;
    inner.querySelector("#pf-heroname").textContent = heroById(oppHeroId).name;
    inner.querySelector(".crest").outerHTML = String(crest(heroById(oppHeroId), artUrl));
  });

  inner.querySelector("#pf-save").addEventListener("click", () => {
    if (!oppHeroId) { toast("Choisis le héros adverse — impossible d'enregistrer un plan sans lui."); return; }
    const data = {
      oppHeroId, artUrl,
      in: inner.querySelector("#pf-in").value.trim(),
      out: inner.querySelector("#pf-out").value.trim(),
      notes: inner.querySelector("#pf-notes").value.trim()
    };
    if (planId) Object.assign(p, data);
    else deck.plans.push({ id: uid(), ...data });
    closeSheet();
    commit();
  });

  inner.querySelector("#pf-del")?.addEventListener("click", () => {
    deck.plans = deck.plans.filter((x) => x.id !== planId);
    closeSheet();
    commit();
  });
}

const escapeText = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const attr = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Ouvre directement la fiche d'un deck (utilisé depuis les autres onglets). */
export function openDeck(id) { openId = id; }
