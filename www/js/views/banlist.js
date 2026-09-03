/**
 * Banlist : cartes bannies, suspendues et restreintes, séparées par format.
 * Sa propre vue — la sortir des Actus lui évite d'alourdir cette page.
 */

import { html, raw } from "../core/dom.js";
import { commit } from "../core/store.js";
import { bannedData } from "../data/banned.js";

const FORMAT_TABS = ["Classic Constructed", "Living Legend", "Blitz", "Silver Age", "Commoner", "UPF"];
const STATUS_LABEL = { banned: "Bannie", suspended: "Suspendue", restricted: "Restreinte" };
const STATUS_TONE = { banned: "loss", suspended: "", restricted: "gold" };

let activeFormat = "Classic Constructed";
let query = "";

export function render() {
  const data = bannedData();

  return html`<div class="stack">
    <div>
      <div class="eyebrow">Restrictions officielles</div>
      <h1 class="title">Banlist</h1>
      ${data ? html`<div class="small faint">Mise à jour ${data.version}</div>` : ""}
    </div>

    <div class="chiprow">${raw(FORMAT_TABS.map((f) => `<button class="chip" data-fmt="${f}" aria-pressed="${f === activeFormat}">${f}</button>`).join(""))}</div>

    ${data
      ? html`<label class="field"><span>Rechercher</span>
          <input id="bl-q" type="search" placeholder="Nom d'une carte…" value="${query}" autocomplete="off"></label>
          <div class="small faint" id="bl-count">${countLabel(rowsFor(data))}</div>
          ${resultsBlock(data)}`
      : html`<div class="empty">Liste pas encore chargée.<br>Elle arrive avec le reste des données, sans connexion nécessaire ensuite.</div>`}

    <p class="small faint">Source : the-fab-cube/flesh-and-blood-cards, synchronisée sur les annonces officielles LSS.</p>
  </div>`;
}

function rowsFor(data) {
  const byFormat = data.cards.filter((c) => c.statuses.some((s) => s.format === activeFormat));
  const q = query.trim().toLowerCase();
  return q ? byFormat.filter((c) => c.name.toLowerCase().includes(q)) : byFormat;
}

const countLabel = (rows) => `${rows.length} carte${rows.length > 1 ? "s" : ""} concernée${rows.length > 1 ? "s" : ""} en ${activeFormat}`;

function resultsBlock(data) {
  const rows = rowsFor(data);
  return rows.length
    ? html`<div class="panel"><div class="banlist">${rows.map((c) => banRow(c))}</div></div>`
    : html`<div class="empty">Aucune carte restreinte en ${activeFormat}${query.trim() ? " pour cette recherche" : ""}.</div>`;
}

function banRow(c) {
  const relevant = c.statuses.filter((s) => s.format === activeFormat);
  return html`<div class="banrow">
    <span class="pitchdot p${c.pitch || 0}"></span>
    <span class="nm">${c.name}</span>
    <span class="tags">${relevant.map((s) => html`<span class="pill ${STATUS_TONE[s.status]}">${STATUS_LABEL[s.status]}</span>`)}</span>
  </div>`;
}

export function mount(root) {
  root.addEventListener("click", (e) => {
    const fmt = e.target.closest("[data-fmt]");
    if (fmt) { activeFormat = fmt.dataset.fmt; commit(); }
  });

  // Recherche sans redessiner toute la vue : un commit() ici recréerait le
  // champ à chaque frappe et ferait perdre le curseur.
  root.addEventListener("input", (e) => {
    if (e.target.id !== "bl-q") return;
    query = e.target.value;
    const data = bannedData();
    if (!data) return;

    const rows = rowsFor(data);
    const count = root.querySelector("#bl-count");
    if (count) count.textContent = countLabel(rows);

    const target = root.querySelector(".panel, .empty");
    if (target) target.outerHTML = resultsBlock(data).toString();
  });
}
