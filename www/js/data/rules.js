/**
 * Règles officielles de construction de deck (rules.fabtcg.com §7) et
 * répartition d'une decklist en zones (équipement / deck principal / side).
 *
 * Seuls les formats à taille fixe sont contraints ici (Classic Constructed,
 * Living Legend, Blitz, Silver Age). Draft, Sealed et Commoner restent
 * libres : pas de règle de taille universelle à appliquer côté deckbuilder.
 */

import { cardByKey, defaultZone } from "./cards.js";

export const FORMATS = [
  "Classic Constructed", "Living Legend", "Blitz", "Silver Age",
  "Draft", "Sealed", "Commoner"
];

const RULES = {
  "Classic Constructed": { heroAge: "adult", maxPool: 80, maxCopies: 3, deckMin: 60, deckExact: null },
  "Living Legend": { heroAge: "adult", maxPool: 80, maxCopies: 3, deckMin: 60, deckExact: null },
  "Blitz": { heroAge: "young", maxPool: 52, maxCopies: 1, deckMin: null, deckExact: 40 },
  "Silver Age": { heroAge: "young", maxPool: 55, maxCopies: 2, deckMin: null, deckExact: 40 }
};

export const formatRules = (format) => RULES[format] || null;

/** Le héros convient-il au format (âge, Pit Fighter) ? Message clair sinon null. */
export function heroFormatIssue(hero, format) {
  if (!hero) return null;
  const rules = formatRules(format);
  if (!rules) return null;
  if (rules.heroAge === "adult" && hero.young) return `Le format ${format} exige un héros adulte — ${hero.name} est un héros jeune.`;
  if (rules.heroAge === "young" && !hero.young) return `Le format ${format} exige un héros jeune — ${hero.name} est un héros adulte.`;
  if (rules.heroAge === "adult" && (hero.talents || []).includes("Pit-Fighter")) return `Les héros Pit Fighter ne sont pas légaux en ${format}.`;
  return null;
}

/** Un héros adulte ne peut pas affronter un héros jeune, quel que soit le format. */
export function ageMismatchIssue(h1, h2) {
  if (!h1 || !h2) return null;
  if (!!h1.young !== !!h2.young) return `Un héros adulte ne peut pas affronter un héros jeune : ${h1.name} vs ${h2.name}.`;
  return null;
}

/** Répartit une liste de decklist en trois zones, chaque entrée enrichie de sa carte. */
export function splitZones(list) {
  const out = { equipment: [], main: [], side: [] };
  for (const entry of list || []) {
    const card = cardByKey(entry.key);
    const zone = entry.zone === "equipment" || entry.zone === "main" || entry.zone === "side"
      ? entry.zone
      : defaultZone(card);
    out[zone].push({ ...entry, card, zone });
  }
  return out;
}

export const zoneTotal = (entries) => entries.reduce((n, e) => n + e.qty, 0);

/** Alertes de légalité pour l'écran de deck : héros, effectif, copies. */
export function deckIssues(deck, hero) {
  const issues = [];
  const heroIssue = heroFormatIssue(hero, deck.format);
  if (heroIssue) issues.push(heroIssue);

  const rules = formatRules(deck.format);
  if (!rules) return issues;

  const zones = splitZones(deck.list || []);
  const mainCount = zoneTotal(zones.main);
  const equipCount = zoneTotal(zones.equipment);
  const poolCount = mainCount + equipCount;

  if (rules.deckExact != null && mainCount > 0 && mainCount !== rules.deckExact) {
    issues.push(`Deck principal : ${mainCount} cartes — il en faut exactement ${rules.deckExact} en ${deck.format}.`);
  }
  if (rules.deckMin != null && mainCount > 0 && mainCount < rules.deckMin) {
    issues.push(`Deck principal : ${mainCount} cartes — il en faut au moins ${rules.deckMin} en ${deck.format}.`);
  }
  if (poolCount > rules.maxPool) {
    issues.push(`${poolCount} cartes en jeu (équipement + deck principal) pour un maximum de ${rules.maxPool} en ${deck.format}.`);
  }

  const perCard = new Map();
  const all = [...zones.equipment, ...zones.main, ...zones.side];
  for (const e of all) perCard.set(e.key, (perCard.get(e.key) || 0) + e.qty);
  for (const [key, qty] of perCard) {
    if (qty > rules.maxCopies) {
      const name = all.find((e) => e.key === key)?.name || key;
      issues.push(`${name} : ${qty} exemplaires au total — maximum ${rules.maxCopies} en ${deck.format}.`);
    }
  }

  return issues;
}
