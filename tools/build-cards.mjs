/**
 * Régénère www/data/cards.json — l'index de cartes utilisé pour les decklists.
 * Usage : npm run cards
 */
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slimCards } from "../www/js/data/slim.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL_CARDS = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english/card.json";

process.stdout.write("Index des cartes — téléchargement … ");
const res = await fetch(URL_CARDS);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const all = await res.json();
console.log(`${all.length} cartes`);

const data = slimCards(all);
const out = join(ROOT, "www", "data", "cards.json");
await writeFile(out, JSON.stringify(data));

const withArt = data.cards.filter((c) => c[6]).length;
console.log(`✔ ${data.cards.length} cartes jouables · ${data.types.length} types · ${withArt} avec illustration`);
console.log("  → www/data/cards.json");
