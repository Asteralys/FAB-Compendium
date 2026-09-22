/** Point d'entrée : chargement de l'index des héros, onglets, rendu. */

import { qs, toast } from "./core/dom.js";
import { S, subscribe, commit } from "./core/store.js";
import { registerTabSwitcher } from "./core/nav.js";
import { loadHeroes, checkForNewSets } from "./data/heroes.js";
import { loadCards } from "./data/cards.js";
import { loadLegend, refreshLegend } from "./data/legend.js";
import { loadBanned } from "./data/banned.js";
import { icon } from "./ui/icons.js";
import { applySkin, openSettings } from "./ui/settings.js";
import { closeAllSheets } from "./ui/sheet.js";

import * as duel from "./views/duel.js";
import * as decks from "./views/decks.js";
import * as stats from "./views/stats.js";
import * as tournaments from "./views/tournaments.js";
import * as news from "./views/news.js";
import * as banlist from "./views/banlist.js";

const VIEWS = { duel, decks, stats, tournaments, news, banlist };
const TABS = [
  ["duel", "Duel", "duel"],
  ["decks", "Decks", "decks"],
  ["stats", "Stats", "stats"],
  ["tournaments", "Tournois", "events"],
  ["news", "Actus", "news"],
  ["banlist", "Banlist", "ban"]
];

let tab = "duel";
let badge = 0;

function drawTabs() {
  qs("#tabbar").innerHTML = TABS.map(([id, label, glyph]) =>
    `<button data-tab="${id}" aria-selected="${tab === id}">${icon(glyph)}<span>${label}</span>${
      badge && id === "news" ? '<i class="pip on" style="position:absolute;top:6px;right:calc(50% - 16px)"></i>' : ""
    }</button>`
  ).join("");
}

function draw() {
  const view = VIEWS[tab];
  const previous = qs("#view");
  const next = document.createElement("main");
  next.id = "view";
  next.className = `view${tab === "duel" && S.duel ? " is-duel" : ""}`;
  next.innerHTML = String(view.render());
  previous.replaceWith(next);
  view.mount?.(next);
  drawTabs();
}

function switchTab(id) {
  if (id === tab) return;
  VIEWS[tab]?.unmount?.();
  closeAllSheets();
  tab = id;
  if (id === "news") badge = 0;
  draw();
}

async function boot() {
  applySkin();
  registerTabSwitcher(switchTab);

  try {
    await loadHeroes();
  } catch (err) {
    qs("#view").innerHTML = `<div class="empty">Impossible de charger la base de héros.<br><span class="small">${err.message}</span></div>`;
    return;
  }

  // Le classement Living Legend est minuscule : on l'attend.
  await loadLegend().catch(() => { /* instantané absent : les pastilles LL disparaissent */ });

  if (S.duel) tab = "duel";
  subscribe(draw);
  draw();

  // L'index des cartes (260 Ko) arrive juste après, sans retarder le premier écran.
  loadCards().then(draw).catch(() => { /* decklists indisponibles, le reste fonctionne */ });
  loadBanned().then(draw).catch(() => { /* banlist indisponible, le reste fonctionne */ });

  qs("#tabbar").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tab]");
    if (btn) switchTab(btn.dataset.tab);
  });

  qs("#settings").addEventListener("click", openSettings);

  // Veille discrète : un ping par semaine sur la liste des sets publiés.
  try {
    const res = await checkForNewSets({ lastCheck: S.lastUpdateCheck });
    if (res) {
      S.lastUpdateCheck = Date.now();
      if (res.newSets.length) {
        badge = res.newSets.length;
        drawTabs();
        toast(`${res.newSets.length} nouveau(x) set(s) — onglet Actus`);
      }
      commit();
    }
  } catch { /* hors-ligne : on réessaiera plus tard */ }

  // Classement Living Legend : le site officiel refuse le CORS au navigateur,
  // l'application installée y arrive. Échec silencieux, l'instantané reste.
  refreshLegend().then(draw).catch(() => {});

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* pas bloquant */ });
  }
}

boot();
