/**
 * Régénère www/data/banned.json — cartes bannies, suspendues et restreintes,
 * tous formats officiels confondus (the-fab-cube/flesh-and-blood-cards).
 * Usage : npm run banned
 */
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slimBanned } from "../www/js/data/slim.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://raw.githubusercontent.com/the-fab-cube/flesh-and-blood-cards/develop/json/english";

const FILES = {
  ccBanned: "banned-cc.json",
  blitzBanned: "banned-blitz.json",
  commonerBanned: "banned-commoner.json",
  llBanned: "banned-ll.json",
  silverAgeBanned: "banned-silver-age.json",
  upfBanned: "banned-upf.json",
  ccSuspended: "suspended-cc.json",
  blitzSuspended: "suspended-blitz.json",
  commonerSuspended: "suspended-commoner.json",
  llRestricted: "restricted-ll.json"
};

const grab = async (file) => {
  process.stdout.write(`  ↓ ${file} … `);
  const r = await fetch(`${BASE}/${file}`);
  if (!r.ok) throw new Error(`${file} : HTTP ${r.status}`);
  const j = await r.json();
  console.log(`${j.length} entrées`);
  return j;
};

console.log("Cartes interdites — the-fab-cube/flesh-and-blood-cards");
const cards = await grab("card.json");

const lists = {};
for (const [key, file] of Object.entries(FILES)) lists[key] = await grab(file);

const data = slimBanned(cards, lists);
const out = join(ROOT, "www", "data", "banned.json");
await writeFile(out, JSON.stringify(data));

const banned = data.cards.filter((c) => c.statuses.some((s) => s.status === "banned")).length;
const suspended = data.cards.filter((c) => c.statuses.some((s) => s.status === "suspended")).length;
const restricted = data.cards.filter((c) => c.statuses.some((s) => s.status === "restricted")).length;
console.log(`\n✔ ${data.cards.length} cartes concernées (${banned} bannies, ${suspended} suspendues, ${restricted} restreintes)`);
console.log("  → www/data/banned.json");
