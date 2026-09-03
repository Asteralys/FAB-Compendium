/**
 * Transformation du jeu de cartes officiel (the-fab-cube/flesh-and-blood-cards)
 * en un index de héros léger, utilisable hors-ligne.
 *
 * Ce module est partagé par :
 *  - tools/build-heroes.mjs  (génération du snapshot livré avec l'app)
 *  - www/js/data/heroes.js   (mise à jour à chaud depuis le téléphone)
 * Les deux passent donc exactement par la même logique.
 */

export const CLASSES = [
  "Adjudicator", "Assassin", "Bard", "Brute", "Guardian", "Illusionist",
  "Mechanologist", "Merchant", "Necromancer", "Ninja", "Pirate", "Ranger",
  "Runeblade", "Shapeshifter", "Thief", "Warrior", "Wizard"
];

/** Teinte d'accent par classe — sert de repli quand l'illustration n'est pas chargée. */
export const CLASS_COLOR = {
  Adjudicator: "#8d8577", Assassin: "#6b4a72", Bard: "#c08a3a",
  Brute: "#8c3a2b", Guardian: "#6e7b8b", Illusionist: "#a9a5cc",
  Mechanologist: "#b8763a", Merchant: "#a8863a", Necromancer: "#57436b",
  Ninja: "#3e7a5e", Pirate: "#7a6a4a", Ranger: "#6e8c3a",
  Runeblade: "#7a3e8c", Shapeshifter: "#5f7a6a", Thief: "#5c5a4a",
  Warrior: "#b0392b", Wizard: "#3a6e9e", Generic: "#8a7a5f"
};

const MAX_ARTS = 10;
const NON_TALENT = new Set(["Hero", "Young", ...CLASSES]);

/** @returns {{version:string, sets:string[], heroes:object[]}} */
export function slimHeroes(cards, sets = []) {
  const heroes = cards
    .filter(c => Array.isArray(c.types) && c.types.includes("Hero"))
    .map(toHero)
    .filter(h => h.life > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return {
    version: new Date().toISOString().slice(0, 10),
    sets: sets.map(s => s.id).filter(Boolean).sort(),
    heroes
  };
}

function toHero(c) {
  const cls = c.types.filter(t => CLASSES.includes(t));
  const talents = c.types.filter(t => !NON_TALENT.has(t));
  const seen = new Set();
  const arts = [];

  for (const p of c.printings || []) {
    if (!p.image_url || seen.has(p.image_url)) continue;
    seen.add(p.image_url);
    arts.push({
      id: p.id,
      set: p.set_id,
      url: p.image_url,
      artist: (p.artists || [])[0] || ""
    });
    if (arts.length >= MAX_ARTS) break;
  }

  return {
    id: c.unique_id,
    name: c.name,
    cls,
    talents,
    life: parseInt(c.health, 10) || 0,
    int: parseInt(c.intelligence, 10) || 4,
    young: c.types.includes("Young"),
    legal: { cc: !!c.cc_legal, blitz: !!c.blitz_legal, ll: !!c.ll_legal },
    arts
  };
}

/* ===================== index des cartes (deckbuilding) ===================== */

/** Le nom du fichier suffit : l'URL complète se reconstruit à l'affichage. */
export const CARD_IMAGE_BASE = "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/";
export const cardImage = (stem) => (stem ? CARD_IMAGE_BASE + stem + ".webp" : null);

/** Identité d'une carte en Flesh and Blood : le nom ET la couleur de pitch. */
export const cardKey = (name, pitch) => `${name}|${pitch || ""}`;

const EXCLUDED_TYPES = new Set(["Hero", "Token", "Placeholder Card"]);

/**
 * Index compact : dictionnaire de types + une ligne par carte.
 * [nom, pitch, coût, force, défense, [typeIdx], imageStem, drapeaux]
 * drapeaux : 1 = légal CC, 2 = légal Blitz
 */
export function slimCards(cards) {
  const types = [];
  const typeIndex = new Map();
  const idOf = (t) => {
    if (!typeIndex.has(t)) { typeIndex.set(t, types.length); types.push(t); }
    return typeIndex.get(t);
  };

  const rows = cards
    .filter((c) => Array.isArray(c.types) && !c.types.some((t) => EXCLUDED_TYPES.has(t)))
    .map((c) => [
      c.name,
      c.pitch || "",
      c.cost || "",
      c.power || "",
      c.defense || "",
      c.types.map(idOf),
      bestPrinting(c),
      (c.cc_legal ? 1 : 0) | (c.blitz_legal ? 2 : 0)
    ])
    .sort((a, b) => a[0].localeCompare(b[0], "en") || String(a[1]).localeCompare(String(b[1])));

  return { version: new Date().toISOString().slice(0, 10), types, cards: rows };
}

/** Tirage normal non-foil de préférence : l'illustration la plus reconnaissable. */
function bestPrinting(card) {
  const printings = (card.printings || []).filter((p) => p.image_url);
  if (!printings.length) return "";
  const plain = printings.find((p) => p.edition === "N" && !/-[A-Z]{2}\.webp$/.test(p.image_url)) || printings[0];
  return plain.image_url.replace(CARD_IMAGE_BASE, "").replace(/\.webp$/, "");
}

/** Transforme une ligne compacte en objet exploitable. */
export function expandCard(row, types) {
  const [name, pitch, cost, power, defense, typeIds, img, flags] = row;
  return {
    key: cardKey(name, pitch),
    name, pitch, cost, power, defense, img,
    types: typeIds.map((i) => types[i]),
    cc: !!(flags & 1),
    blitz: !!(flags & 2)
  };
}

/** Libellé court : "Runeblade · Elemental". */
export function heroSubtitle(h) {
  return [...(h.cls || []), ...(h.talents || [])].join(" · ") || "Generic";
}

export function heroColor(h) {
  return CLASS_COLOR[(h.cls || [])[0]] || CLASS_COLOR.Generic;
}

/* ================== bannies / suspendues / restreintes ================== */

const BAN_FORMAT_LABEL = {
  cc: "Classic Constructed", blitz: "Blitz", commoner: "Commoner",
  ll: "Living Legend", silverAge: "Silver Age", upf: "UPF"
};

/**
 * Croise les listes officielles de restrictions (card_unique_id) avec
 * card.json pour retrouver le nom et le pitch de chaque carte concernée.
 * @param {object[]} cards card.json complet
 * @param {object} lists {ccBanned, blitzBanned, commonerBanned, llBanned, silverAgeBanned, upfBanned, ccSuspended, blitzSuspended, commonerSuspended, llRestricted}
 */
export function slimBanned(cards, lists) {
  const byId = new Map(cards.map((c) => [c.unique_id, c]));
  const entries = new Map();

  const add = (list = [], format, status) => {
    for (const row of list) {
      if (row.status_active === false) continue;
      const card = byId.get(row.card_unique_id);
      if (!card) continue;
      if (!entries.has(row.card_unique_id)) {
        entries.set(row.card_unique_id, { name: card.name, pitch: card.pitch || "", statuses: [] });
      }
      entries.get(row.card_unique_id).statuses.push({ format: BAN_FORMAT_LABEL[format], status });
    }
  };

  add(lists.ccBanned, "cc", "banned");
  add(lists.blitzBanned, "blitz", "banned");
  add(lists.commonerBanned, "commoner", "banned");
  add(lists.llBanned, "ll", "banned");
  add(lists.silverAgeBanned, "silverAge", "banned");
  add(lists.upfBanned, "upf", "banned");
  add(lists.ccSuspended, "cc", "suspended");
  add(lists.blitzSuspended, "blitz", "suspended");
  add(lists.commonerSuspended, "commoner", "suspended");
  add(lists.llRestricted, "ll", "restricted");

  const cardsOut = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  return { version: new Date().toISOString().slice(0, 10), cards: cardsOut };
}
