/**
 * Index des cartes : recherche, illustrations, lecture d'une decklist collée.
 * L'index complet (4760 cartes) est livré avec l'app et tient en 260 Ko :
 * la decklist reste donc consultable hors connexion.
 */

import { slimCards, expandCard, cardKey, cardImage } from "./slim.js";

const URL_CARDS = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english/card.json";
const CACHE_KEY = "fab.cards.v1";

let index = null;          // { version, types, cards }
let expanded = [];         // cartes prêtes à l'emploi
let byKey = new Map();
let byName = new Map();    // nom replié → [cartes]

export { cardImage, cardKey };

const DIACRITICS = /[̀-ͯ]/g;
export const foldName = (s) =>
  String(s ?? "").normalize("NFD").replace(DIACRITICS, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const PITCH_NAMES = { red: "1", rouge: "1", yellow: "2", jaune: "2", blue: "3", bleu: "3" };
export const PITCH_LABEL = { 1: "Rouge", 2: "Jaune", 3: "Bleu", "": "Sans pitch" };

function adopt(data) {
  index = data;
  expanded = data.cards.map((row) => expandCard(row, data.types));
  byKey = new Map(expanded.map((c) => [c.key, c]));
  byName = new Map();
  expanded.forEach((c) => {
    const f = foldName(c.name);
    if (!byName.has(f)) byName.set(f, []);
    byName.get(f).push(c);
  });
  return index;
}

export async function loadCards() {
  if (index) return index;

  if (globalThis.__FAB_CARDS__) return adopt(globalThis.__FAB_CARDS__);

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return adopt(JSON.parse(cached));
  } catch { /* cache illisible */ }

  const res = await fetch("./data/cards.json");
  if (!res.ok) throw new Error("Index des cartes introuvable");
  return adopt(await res.json());
}

export const allCards = () => expanded;
export const cardsVersion = () => index?.version ?? "—";
export const cardByKey = (key) => byKey.get(key) || null;
export const cardsNamed = (name) => byName.get(foldName(name)) || [];

/** Recherche par nom, type ou classe. */
export function searchCards(query = "", { pitch = null, type = null, limit = 80 } = {}) {
  const q = foldName(query);
  const out = [];
  for (const c of expanded) {
    if (pitch !== null && c.pitch !== pitch) continue;
    if (type && !c.types.includes(type)) continue;
    if (q && !foldName(`${c.name} ${c.types.join(" ")}`).includes(q)) continue;
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------- zones ------------------------------- */

/** Une arme ou un équipement se joue en zone d'arène, jamais dans le deck/side. */
export const isEquipmentCard = (card) => !!card && (card.types.includes("Weapon") || card.types.includes("Equipment"));
export const defaultZone = (card) => (isEquipmentCard(card) ? "equipment" : "main");

/* -------------------------- lecture d'une liste -------------------------- */

/** Titres de section reconnus dans un export collé, et la zone qu'ils ouvrent. */
const ZONE_HEADERS = [
  [/^(weapons?|armes?)\s*:?\s*(\(\d+\))?$/i, "equipment"],
  [/^(equipment|équipement|equipement)\s*:?\s*(\(\d+\))?$/i, "equipment"],
  [/^(side\s*board|side|réserve)\s*:?\s*(\(\d+\))?$/i, "side"],
  [/^(deck|main\s*deck|maindeck|cards?|liste)\s*:?\s*(\(\d+\))?$/i, "main"],
  [/^(hero|héros|inventory)\s*:?\s*(\(\d+\))?$/i, null]
];

/**
 * Analyse une decklist collée (FaBrary, Talishar, texte libre).
 * Formats acceptés : « 3 Lightning Press (red) », « (3) Lightning Press »,
 * « 3x Lightning Press », « Lightning Press (red) x3 », une carte par ligne.
 * Les titres de section (Weapons / Equipment / Sideboard / …) répartissent
 * automatiquement les cartes suivantes dans la bonne zone.
 *
 * @returns {{entries:{key,name,pitch,qty,zone}[], hero:object|null, unknown:string[], ambiguous:string[], recolored:string[]}}
 */
export function parseDecklist(text) {
  const entries = new Map(); // clé "cardKey::zone" → entrée
  const unknown = [];
  const ambiguous = [];
  const recolored = [];
  const hero = null;
  let zone = null; // zone de la section en cours, si des titres sont présents

  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*•]\s*/, "");
    if (!line) continue;

    const header = ZONE_HEADERS.find(([re]) => re.test(line));
    if (header) { zone = header[1] ?? zone; continue; }

    let qty = 1;
    let rest = line;

    const lead = rest.match(/^\(?(\d{1,2})\)?\s*[x×]?\s+(.+)$/i) || rest.match(/^(\d{1,2})[x×]\s*(.+)$/i);
    if (lead) { qty = Number(lead[1]); rest = lead[2].trim(); }

    const trail = rest.match(/^(.+?)\s*[x×]\s*(\d{1,2})$/i);
    if (trail) { rest = trail[1].trim(); qty = Number(trail[2]); }

    let pitch = null;
    const colour = rest.match(/[([]\s*(red|yellow|blue|rouge|jaune|bleu)\s*[)\]]\s*$/i);
    if (colour) {
      pitch = PITCH_NAMES[colour[1].toLowerCase()];
      rest = rest.slice(0, colour.index).trim();
    }

    rest = rest.replace(/\s*\((?:CC|Blitz|LL)\)\s*$/i, "").trim();
    if (!rest) continue;

    const matches = cardsNamed(rest);
    if (!matches.length) { unknown.push(line); continue; }

    let card = pitch ? matches.find((c) => c.pitch === pitch) : null;
    if (!card) {
      const distinct = new Set(matches.map((c) => c.pitch));
      if (pitch) recolored.push(`${rest} → ${PITCH_LABEL[matches[0].pitch] || "sans pitch"}`);
      else if (distinct.size > 1) ambiguous.push(rest);
      card = matches[0];
    }

    const cardZone = zone || defaultZone(card);
    const mapKey = `${card.key}::${cardZone}`;
    const previous = entries.get(mapKey);
    entries.set(mapKey, {
      key: card.key,
      name: card.name,
      pitch: card.pitch,
      zone: cardZone,
      qty: (previous?.qty || 0) + qty
    });
  }

  return { entries: [...entries.values()], hero, unknown, ambiguous, recolored };
}

export const countList = (list) => list.reduce((n, e) => n + e.qty, 0);

/* ------------------------------ mise à jour ------------------------------ */

/** Retélécharge la base complète et reconstruit l'index des cartes. */
export async function updateCards(onProgress = () => {}) {
  const res = await fetch(URL_CARDS, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Téléchargement impossible (HTTP ${res.status})`);

  const total = Number(res.headers.get("content-length")) || 0;
  let text;

  if (res.body?.getReader) {
    const reader = res.body.getReader();
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
    text = await res.text();
  }

  const data = slimCards(JSON.parse(text));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
  catch { throw new Error("Espace de stockage insuffisant sur l'appareil"); }
  return adopt(data);
}

export async function resetCards() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* rien à faire */ }
  index = null;
  return loadCards();
}
