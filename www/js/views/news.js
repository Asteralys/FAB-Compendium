/**
 * Actualités : course au Living Legend, ressources officielles,
 * et entretien des bases de données (héros, cartes).
 */

import { html, qs, toast } from "../core/dom.js";
import { S, commit, save } from "../core/store.js";
import { allHeroes, heroesVersion, checkForNewSets, updateHeroes } from "../data/heroes.js";
import { cardsVersion, allCards, updateCards } from "../data/cards.js";
import { legendData, legendThreshold, legendDate, refreshLegend } from "../data/legend.js";
import { icon } from "../ui/icons.js";

const LINKS = [
  ["Actualités officielles", "https://fabtcg.com/en/articles/", "Annonces, spoilers, notes de version", "news"],
  ["Page Living Legend", "https://fabtcg.com/living-legend/", "Le classement officiel, mis à jour chaque lundi", "trophy"],
  ["Organised Play", "https://fabtcg.com/en/organised-play/", "Armory, Skirmish, Battle Hardened, Pro Tour", "events"],
  ["Règles & politique", "https://fabtcg.com/en/resources/rules-and-policy-center/", "Règles complètes, banned & suspended", "book"],
  ["Talishar", "https://talishar.net/", "Jouer et tester ses plans de side en ligne", "duel"],
  ["FaBrary", "https://fabrary.net/", "Deckbuilder et listes de la communauté", "scroll"]
];

let showAllLegend = false;
let busy = false;

export function render() {
  const heroes = allHeroes();
  const young = heroes.filter((h) => h.young).length;

  return html`<div class="stack">
    <div>
      <div class="eyebrow">Flesh and Blood</div>
      <h1 class="title">Actualités</h1>
    </div>

    ${legendPanel()}

    <div class="panel gilt stack tight" id="nw-data">
      <div class="row">
        <div class="grow">
          <div class="eyebrow">Bases de données</div>
          <div class="small">${heroes.length} héros (${heroes.length - young} adultes, ${young} jeunes) · ${allCards().length} cartes</div>
          <div class="small faint">Héros ${heroesVersion()} · cartes ${cardsVersion()}</div>
        </div>
        <button class="btn" id="nw-check" ${busy ? "disabled" : ""}>${icon("refresh")} Vérifier</button>
      </div>
      <div id="nw-status" class="small muted">Points de vie, illustrations et index de cartes viennent de la base officielle communautaire.</div>
    </div>

    ${LINKS.map(([title, url, desc, glyph]) => html`
      <a class="linkcard" href="${url}" target="_blank" rel="noopener noreferrer">
        <span class="glyph">${icon(glyph)}</span>
        <span class="grow"><b>${title}</b><span>${desc}</span></span>
        ${icon("link")}
      </a>`)}

    <p class="small faint">Cartes : the-fab-cube/flesh-and-blood-cards · Classement : fabtcg.com.
    Illustrations © Legend Story Studios. Application non officielle.</p>
  </div>`;
}

/* --------------------- course au Living Legend --------------------- */

function legendPanel() {
  const data = legendData();
  if (!data) return "";

  const threshold = legendThreshold();
  const board = showAllLegend ? data.board : data.board.slice(0, 10);

  return html`<div class="panel gilt stack tight">
    <div class="row">
      <div class="grow">
        <div class="eyebrow">Points Living Legend</div>
        <h2 class="title-sm">Course au ${threshold}</h2>
        <div class="small faint">Classement du ${legendDate()} · Classic Constructed</div>
      </div>
      <button class="btn ghost" id="ll-refresh" style="min-height:38px;padding:6px 12px" ${busy ? "disabled" : ""}>${icon("refresh")}</button>
    </div>

    <div id="ll-status" class="small muted" hidden></div>

    <div>${board.map((row, i) => legendRow(row, i + 1, threshold))}</div>

    ${data.board.length > 10
      ? html`<button class="btn ghost" id="ll-more">${showAllLegend ? "Réduire" : `Voir les ${data.board.length} héros`}</button>`
      : ""}

    <details>
      <summary class="eyebrow" style="cursor:pointer;padding:6px 0">Déjà Living Legend — ${data.legends.length}</summary>
      <div>${data.legends.map((row) => legendRow(row, null, threshold, true))}</div>
    </details>
  </div>`;
}

function legendRow(row, rank, threshold, isLegend = false) {
  const pct = Math.min(100, Math.round((row.points / threshold) * 100));
  const hot = pct >= 85;
  return html`<div class="llrow ${isLegend ? "legend" : ""}">
    <span class="rank">${isLegend ? "LL" : rank}</span>
    <span class="who">
      <b>${row.hero}</b>
      ${isLegend ? "" : html`<span class="track"><i class="${hot ? "hot" : ""}" style="width:${pct}%"></i></span>`}
    </span>
    <span class="pts">${row.points}${row.season ? html`<span>saison ${row.season}</span>` : ""}</span>
  </div>`;
}

/* ------------------------------ actions ---------------------------- */

export function mount(root) {
  root.addEventListener("click", async (e) => {
    if (e.target.closest("#ll-more")) { showAllLegend = !showAllLegend; commit(); return; }
    if (e.target.closest("#ll-refresh")) { refreshBoard(root); return; }
    if (e.target.closest("#nw-check")) { checkData(root, e.target.closest("#nw-check")); }
  });
}

async function refreshBoard(root) {
  const status = qs("#ll-status", root);
  status.hidden = false;
  status.textContent = "Lecture du classement officiel…";
  busy = true;

  try {
    const data = await refreshLegend();
    busy = false;
    toast(`Classement à jour — ${data.board.length} héros en course`);
    commit();
  } catch (err) {
    busy = false;
    status.innerHTML = `${err.message}<br><span class="faint">Le classement livré avec l'application reste affiché.</span>`;
  }
}

async function checkData(root, button) {
  const status = qs("#nw-status", root);
  busy = true;
  button.disabled = true;
  status.textContent = "Vérification des sets publiés…";

  try {
    const res = await checkForNewSets({ force: true });
    S.lastUpdateCheck = Date.now();

    if (!res.newSets.length) {
      status.textContent = `À jour — ${res.total} sets connus.`;
      save();
      return;
    }

    status.innerHTML = `<b>${res.newSets.length} nouveau(x) set(s)</b> : ${res.newSets.join(", ")}.`;
    await runUpdate(status);
  } catch (err) {
    status.textContent = `Échec : ${err.message}. Vérifie ta connexion et réessaie.`;
  } finally {
    busy = false;
    const btn = qs("#nw-check", root);
    if (btn) btn.disabled = false;
  }
}

async function runUpdate(status) {
  status.insertAdjacentHTML("afterend", '<div class="progress" id="nw-bar"><i style="width:0"></i></div>');
  const bar = document.querySelector("#nw-bar i");

  const track = (label) => (ratio, mb) => {
    if (bar) bar.style.width = `${Math.round((ratio ?? 0) * 100)}%`;
    status.textContent = `${label}… ${mb} Mo`;
  };

  try {
    const heroes = await updateHeroes(track("Héros"));
    const cards = await updateCards(track("Cartes"));
    document.querySelector("#nw-bar")?.remove();
    toast(`${heroes.heroes.length} héros · ${cards.cards.length} cartes à jour`);
    commit();
  } catch (err) {
    document.querySelector("#nw-bar")?.remove();
    status.textContent = `Échec : ${err.message}`;
  }
}
