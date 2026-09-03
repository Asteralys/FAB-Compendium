/**
 * Points Living Legend par héros.
 *
 * Instantané livré avec l'app, puis rafraîchissement depuis fabtcg.com quand
 * l'environnement le permet (APK Capacitor). Dans un navigateur la page
 * officielle refuse le CORS : on garde l'instantané et on l'annonce clairement.
 */

import { parseLivingLegend } from "./ll-parse.js";

const PAGE = "https://fabtcg.com/living-legend/";
const CACHE_KEY = "fab.legend.v1";

let data = null;
let index = new Map();   // nom replié → { points, rank, isLegend }

const DIACRITICS = /[̀-ͯ]/g;
const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function adopt(next) {
  data = next;
  index = new Map();
  next.board.forEach((row, i) => index.set(fold(row.hero), { ...row, rank: i + 1, isLegend: false }));
  next.legends.forEach((row) => index.set(fold(row.hero), { ...row, rank: null, isLegend: true }));
  return data;
}

export async function loadLegend() {
  if (data) return data;

  if (globalThis.__FAB_LEGEND__) return adopt(globalThis.__FAB_LEGEND__);

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return adopt(JSON.parse(cached));
  } catch { /* cache illisible */ }

  const res = await fetch("./data/living-legend.json");
  if (!res.ok) throw new Error("Classement Living Legend introuvable");
  return adopt(await res.json());
}

export const legendData = () => data;
export const legendThreshold = () => data?.threshold || 1000;
export const legendDate = () => data?.fetchedAt || "—";

/** Points d'un héros, par son nom de carte. */
export const legendFor = (heroName) => index.get(fold(heroName)) || null;

/** Arme signature d'un héros, telle que publiée par LSS. */
export const signatureWeapon = (heroName) => {
  const f = fold(heroName);
  return data?.weapons.find((w) => fold(w.hero) === f)?.weapon || null;
};

/**
 * Relit la page officielle. Renvoie le jeu de données, ou lève une erreur
 * explicite si l'environnement bloque la requête (cas du navigateur).
 */
export async function refreshLegend() {
  let res;
  try {
    res = await fetch(PAGE, { headers: { accept: "text/html" }, cache: "no-cache" });
  } catch {
    throw new Error("Le navigateur bloque la lecture de fabtcg.com (CORS). L'application installée, elle, y arrive.");
  }
  if (!res.ok) throw new Error(`fabtcg.com a répondu ${res.status}`);

  const next = parseLivingLegend(await res.text());
  if (!next.board.length) throw new Error("Classement illisible — la page a changé de structure.");

  try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); }
  catch { /* pas bloquant : on garde la version en mémoire */ }
  return adopt(next);
}

export async function resetLegend() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* rien à faire */ }
  data = null;
  return loadLegend();
}
