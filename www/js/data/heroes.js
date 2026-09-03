/**
 * Index des héros : snapshot livré avec l'app, puis mise à jour à la demande
 * depuis la base officielle communautaire (the-fab-cube/flesh-and-blood-cards).
 * Tout est mis en cache localement, l'app reste utilisable hors-ligne.
 */

import { slimHeroes, heroSubtitle, heroColor } from "./slim.js";

const BASE = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english";
const CACHE_KEY = "fab.heroes.v1";
const CHECK_EVERY = 7 * 24 * 3600 * 1000; // une vérification par semaine suffit

let index = null;   // { version, sets, heroes }
let byId = new Map();

export { heroSubtitle, heroColor };

function adopt(data) {
  index = data;
  byId = new Map(data.heroes.map((h) => [h.id, h]));
  return index;
}

export async function loadHeroes() {
  if (index) return index;

  // 1. Version inlinée (build mono-fichier)
  if (globalThis.__FAB_HEROES__) return adopt(globalThis.__FAB_HEROES__);

  // 2. Mise à jour téléchargée précédemment
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return adopt(JSON.parse(cached));
  } catch { /* cache illisible : on prend le snapshot */ }

  // 3. Snapshot livré avec l'application
  const res = await fetch("./data/heroes.json");
  if (!res.ok) throw new Error("Index des héros introuvable");
  return adopt(await res.json());
}

export const allHeroes = () => index?.heroes ?? [];
export const heroById = (id) => byId.get(id) || null;
export const heroesVersion = () => index?.version ?? "—";

const DIACRITICS = /[̀-ͯ]/g;
const fold = (s) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

/** Recherche par nom, classe ou talent. `age` vaut "young", "adult" ou null. */
export function searchHeroes(query = "", { age = null, cls = null, talent = null } = {}) {
  const q = fold(query.trim());
  return allHeroes().filter((h) => {
    if (age === "young" && !h.young) return false;
    if (age === "adult" && h.young) return false;
    if (cls && !h.cls.includes(cls)) return false;
    if (talent && !h.talents.includes(talent)) return false;
    if (!q) return true;
    return fold(`${h.name} ${h.cls.join(" ")} ${h.talents.join(" ")}`).includes(q);
  });
}

/** Toutes les classes présentes dans l'index, triées. */
export function classList() {
  return [...new Set(allHeroes().flatMap((h) => h.cls))].sort();
}

/** Talents présents, Pit-Fighter en tête : c'est le filtre le plus demandé. */
export function talentList() {
  const found = [...new Set(allHeroes().flatMap((h) => h.talents))].sort();
  return found.sort((a, b) => (a === "Pit-Fighter" ? -1 : b === "Pit-Fighter" ? 1 : 0));
}

/** « Pit-Fighter » se lit mieux sans le trait d'union. */
export const talentLabel = (t) => t.replace("-", " ");

export const heroArt = (hero, url) =>
  url || hero?.arts?.[0]?.url || null;

export const initials = (name = "?") =>
  name.replace(/[^A-Za-zÀ-ÿ ]/g, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/* --------------------------- mise à jour --------------------------- */

/** Compare la liste des sets publiés à celle du snapshot local. */
export async function checkForNewSets({ force = false, lastCheck = 0 } = {}) {
  if (!force && Date.now() - lastCheck < CHECK_EVERY) return null;
  const res = await fetch(`${BASE}/set.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Vérification impossible (HTTP ${res.status})`);
  const sets = await res.json();
  const known = new Set(index?.sets ?? []);
  const fresh = sets.map((s) => s.id).filter((id) => id && !known.has(id));
  return { newSets: fresh, total: sets.length, sets };
}

/**
 * Télécharge la base complète et reconstruit l'index local.
 * @param {(ratio:number|null, loadedMB:string)=>void} onProgress
 */
export async function updateHeroes(onProgress = () => {}) {
  const [cardsRes, setsRes] = await Promise.all([
    fetch(`${BASE}/card.json`, { cache: "no-cache" }),
    fetch(`${BASE}/set.json`, { cache: "no-cache" })
  ]);
  if (!cardsRes.ok) throw new Error(`Téléchargement impossible (HTTP ${cardsRes.status})`);

  const total = Number(cardsRes.headers.get("content-length")) || 0;
  let text;

  if (cardsRes.body?.getReader) {
    const reader = cardsRes.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(total ? loaded / total : null, (loaded / 1048576).toFixed(1));
    }
    text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
  } else {
    text = await cardsRes.text();
  }

  const data = slimHeroes(JSON.parse(text), setsRes.ok ? await setsRes.json() : []);
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  catch { throw new Error("Espace de stockage insuffisant sur l'appareil"); }
  adopt(data);
  return data;
}

/** Revient au snapshot livré avec l'app. */
export async function resetHeroes() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* rien à faire */ }
  index = null;
  return loadHeroes();
}
