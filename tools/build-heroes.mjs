/**
 * Régénère www/data/heroes.json depuis la base de cartes officielle.
 * Usage : npm run heroes
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { slimHeroes } from "../www/js/data/slim.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english";

const grab = async (file) => {
  process.stdout.write(`  ↓ ${file} … `);
  const r = await fetch(`${BASE}/${file}`);
  if (!r.ok) throw new Error(`${file} : HTTP ${r.status}`);
  const j = await r.json();
  console.log(`${j.length} entrées`);
  return j;
};

console.log("Base de cartes Flesh and Blood — the-fab-cube/flesh-and-blood-cards");
const [cards, sets] = await Promise.all([grab("card.json"), grab("set.json")]);

const data = slimHeroes(cards, sets);
const out = join(ROOT, "www", "data", "heroes.json");
await writeFile(out, JSON.stringify(data));

const young = data.heroes.filter(h => h.young).length;
const arts = data.heroes.reduce((n, h) => n + h.arts.length, 0);
console.log(`\n✔ ${data.heroes.length} héros (${young} jeunes / ${data.heroes.length - young} adultes)`);
console.log(`  ${arts} illustrations · ${data.sets.length} sets · snapshot ${data.version}`);
console.log(`  → www/data/heroes.json`);
