/** Statistiques : winrate global, par deck, par matchup, et journal des matchs. */

import { html } from "../core/dom.js";
import { S, commit, uid, deckById, record } from "../core/store.js";
import { heroById, preferredArt } from "../data/heroes.js";
import { openSheet, closeSheet, confirmSheet } from "../ui/sheet.js";
import { crest, ratePill, winBar, formatDate, today, clock, heroSelectGroups, deckOptions } from "../ui/components.js";
import { matchupTable } from "./decks.js";
import { icon } from "../ui/icons.js";

const RANGES = [
  ["all", "Tout"],
  ["90", "90 jours"],
  ["30", "30 jours"]
];

let range = "all";
let selectedDeck = "";

const inRange = (m) => {
  if (range === "all") return true;
  const limit = new Date(Date.now() - Number(range) * 86400000).toISOString().slice(0, 10);
  return (m.date || "") >= limit;
};
const inDeck = (m) => !selectedDeck || m.deckId === selectedDeck;
const inScope = (m) => inRange(m) && inDeck(m);

export function render() {
  const matches = S.matches.filter(inScope);
  const r = record(inScope);
  const streak = currentStreak(matches);
  const deck = selectedDeck ? deckById(selectedDeck) : null;

  return html`<div class="stack">
    <div>
      <div class="eyebrow">Performance</div>
      <h1 class="title">Statistiques</h1>
    </div>

    ${S.decks.length ? html`<label class="field"><span>Deck</span>
      <select id="st-deckpick">
        <option value="">Tous mes decks</option>
        ${deckOptions(selectedDeck)}
      </select></label>` : ""}

    <div class="row wrap" style="gap:6px">
      ${RANGES.map(([v, l]) => html`<button class="chip" data-range="${v}" aria-pressed="${range === v}">${l}</button>`)}
    </div>

    <div class="panel gilt stack tight">
      <div class="statgrid">
        <div class="cell"><b style="color:${r.rate === null ? "var(--parchment-dim)" : r.rate >= 50 ? "var(--win)" : "var(--loss)"}">${r.rate === null ? "—" : r.rate + "%"}</b><span>Winrate</span></div>
        <div class="cell"><b>${r.played}</b><span>Matchs</span></div>
        <div class="cell"><b style="color:${streak.kind === "W" ? "var(--win)" : streak.kind === "L" ? "var(--loss)" : "inherit"}">${streak.label}</b><span>Série</span></div>
      </div>
      <div class="meter"><i style="width:${r.rate ?? 0}%"></i><u></u></div>
      <div class="small muted">${r.wins} victoire${r.wins > 1 ? "s" : ""} · ${r.losses} défaite${r.losses > 1 ? "s" : ""}</div>
    </div>

    ${deck ? matchupChart(matches, deck) : deckBars(matches)}
    ${matchupPanel()}

    <div class="sectionhead">
      <div class="grow">
        <div class="eyebrow">Journal</div>
        <h2 class="title-sm">Derniers matchs</h2>
      </div>
      <button class="btn" id="st-add">${icon("plus")} Match</button>
    </div>

    ${matches.length
      ? html`<div class="panel">${matches.slice(0, 50).map(matchRow)}</div>`
      : html`<div class="empty">Aucun match sur cette période.<br>Les duels terminés arrivent ici automatiquement.</div>`}
  </div>`;
}

function deckBars(matches) {
  const played = S.decks.filter((d) => matches.some((m) => m.deckId === d.id));
  if (!played.length) return "";
  return html`<div class="panel stack tight">
    <div class="eyebrow">Par deck</div>
    <div class="bars">
      ${played.map((d) => {
        const list = matches.filter((m) => m.deckId === d.id);
        return winBar(d.name, list.filter((m) => m.result === "W").length, list.length);
      })}
    </div>
  </div>`;
}

/** Graphique de winrate par héros adverse, pour le deck sélectionné, séparé adulte/jeune. */
function matchupChart(matches, deck) {
  if (!matches.length) return html`<div class="empty">Aucun match avec ${deck.name} sur cette période.</div>`;

  const buckets = new Map();
  matches.forEach((m) => {
    const opp = heroById(m.oppHeroId);
    const key = m.oppHeroId || "?";
    const b = buckets.get(key) || { name: opp?.name || "Héros inconnu", young: !!opp?.young, played: 0, wins: 0 };
    b.played++;
    if (m.result === "W") b.wins++;
    buckets.set(key, b);
  });

  const rows = [...buckets.values()].sort((a, b) => b.played - a.played);
  const adults = rows.filter((r) => !r.young);
  const young = rows.filter((r) => r.young);

  const section = (label, list) => (!list.length ? "" : html`
    <div class="stack tight">
      <div class="eyebrow">${label}</div>
      <div class="bars">${list.map((r) => winBar(r.name, r.wins, r.played))}</div>
    </div>`);

  return html`<div class="panel gilt stack">
    <div class="eyebrow">Graphique — ${deck.name}</div>
    <h2 class="title-sm" style="margin:-4px 0 2px">Winrate par héros affronté</h2>
    ${section("Contre les héros adultes", adults)}
    ${section("Contre les héros jeunes", young)}
  </div>`;
}

function matchupPanel() {
  const rows = matchupTable(inScope);
  if (!rows) return "";
  return html`<div class="panel">
    <div class="eyebrow" style="margin-bottom:6px">Par héros adverse</div>
    <div class="scroll-x"><table>
      <thead><tr><th>Adversaire</th><th class="n">J</th><th class="n">V-D</th><th class="n">WR</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function matchRow(m) {
  const opp = heroById(m.oppHeroId);
  const mine = deckById(m.deckId)?.name || heroById(m.heroId)?.name || "—";
  return html`<div class="matchrow">
    ${crest(opp, m.artUrlOpp)}
    <div class="grow">
      <div style="font-weight:600" class="truncate">vs ${opp?.name || "?"}${m.oppDeck ? html` <span class="faint small">· ${m.oppDeck}</span>` : ""}</div>
      <div class="small muted truncate">${formatDate(m.date)} · ${mine}${m.event ? " · " + m.event : ""}${m.duration ? " · " + clock(m.duration) : ""}</div>
    </div>
    <span class="pill ${m.result === "W" ? "win" : "loss"}">${m.result === "W" ? "V" : "D"}</span>
    <button class="btn ghost" data-del="${m.id}" style="min-height:34px;padding:4px 10px">${icon("close")}</button>
  </div>`;
}

function currentStreak(matches) {
  if (!matches.length) return { label: "—", kind: null };
  const kind = matches[0].result;
  let n = 0;
  for (const m of matches) { if (m.result !== kind) break; n++; }
  return { label: `${n}${kind}`, kind };
}

export function mount(root) {
  root.addEventListener("click", async (e) => {
    const chip = e.target.closest("[data-range]");
    if (chip) { range = chip.dataset.range; commit(); return; }

    if (e.target.closest("#st-add")) { matchForm(); return; }

    const del = e.target.closest("[data-del]");
    if (del && await confirmSheet("Supprimer ce match ?", "Il disparaîtra de toutes tes statistiques.", "Supprimer")) {
      S.matches = S.matches.filter((m) => m.id !== del.dataset.del);
      commit();
    }
  });

  root.addEventListener("change", (e) => {
    if (e.target.id === "st-deckpick") { selectedDeck = e.target.value; commit(); }
  });
}

/* ---------------------- saisie manuelle ---------------------- */

function matchForm() {
  let oppHeroId = null;

  const inner = openSheet(`<h3>Ajouter un match</h3>
    <label class="field"><span>Mon deck</span><select id="mf-deck">
      <option value="">— sans deck —</option>
      ${deckOptions()}
    </select></label>
    <label class="field"><span>Héros adverse</span>
      <select id="mf-opp">
        <option value="">— choisir —</option>
        ${heroSelectGroups()}
      </select>
    </label>
    <label class="field"><span>Deck adverse</span><input id="mf-oppdeck" placeholder="optionnel"></label>
    <div class="row">
      <label class="field grow"><span>Date</span><input id="mf-date" type="date" value="${today()}"></label>
      <label class="field grow"><span>Événement</span><input id="mf-event" placeholder="Armory…"></label>
    </div>
    <div class="actions">
      <button class="btn danger" id="mf-loss">Défaite</button>
      <button class="btn primary" id="mf-win">Victoire</button>
    </div>`);

  inner.querySelector("#mf-opp").addEventListener("change", (e) => {
    oppHeroId = e.target.value || null;
  });

  const add = (result) => {
    if (!oppHeroId) return;
    const deckId = inner.querySelector("#mf-deck").value || null;
    S.matches.unshift({
      id: uid(),
      date: inner.querySelector("#mf-date").value || today(),
      deckId,
      heroId: deckById(deckId)?.heroId || null,
      oppHeroId,
      artUrlOpp: preferredArt(oppHeroId),
      oppDeck: inner.querySelector("#mf-oppdeck").value.trim(),
      result,
      format: deckById(deckId)?.format || "",
      event: inner.querySelector("#mf-event").value.trim()
    });
    S.matches.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    closeSheet();
    commit();
  };

  inner.querySelector("#mf-win").addEventListener("click", () => add("W"));
  inner.querySelector("#mf-loss").addEventListener("click", () => add("L"));
}
