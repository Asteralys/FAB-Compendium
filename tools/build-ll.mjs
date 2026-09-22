/**
 * Récupère la course au Living Legend sur le site officiel et écrit
 * www/data/living-legend.json.
 *
 * Le navigateur ne peut pas lire cette page directement (pas d'en-tête CORS) :
 * on la lit ici, côté Node, et l'instantané part avec l'application.
 * L'APK, lui, sait la relire tout seul — CapacitorHttp contourne le CORS.
 *
 * Usage : npm run ll
 */
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLivingLegend } from "../www/js/data/ll-parse.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = "https://fabtcg.com/living-legend/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/**
 * fabtcg.com bloque les IP de datacenter (GitHub Actions y compris — HTTP 403,
 * quel que soit le user-agent). Ça ne doit jamais faire échouer `npm run data` :
 * heroes/cards/banned n'ont rien à voir avec cette page, et l'instantané déjà
 * commité reste tout à fait utilisable. On échoue proprement (code 0) plutôt
 * que de bloquer la mise à jour des autres bases.
 */
process.stdout.write("Course au Living Legend — fabtcg.com … ");

let res;
try {
  res = await fetch(PAGE, { headers: { "user-agent": UA, accept: "text/html" } });
} catch (err) {
  console.log(`\n⚠ requête impossible (${err.message}) — instantané conservé tel quel.`);
  process.exit(0);
}
if (!res.ok) {
  console.log(`\n⚠ fabtcg.com a répondu HTTP ${res.status} (bloque probablement cette IP) — instantané conservé tel quel.`);
  process.exit(0);
}

const data = parseLivingLegend(await res.text());
if (!data.board.length) {
  console.log("\n⚠ tableau introuvable — la page a peut-être changé de structure. Instantané conservé tel quel.");
  process.exit(0);
}

await writeFile(join(ROOT, "www", "data", "living-legend.json"), JSON.stringify(data));
console.log(`${data.board.length} héros en course, ${data.legends.length} déjà Living Legend`);
console.log(`  Tête : ${data.board.slice(0, 3).map((b) => `${b.hero} ${b.points}`).join(" · ")}`);
console.log("  → www/data/living-legend.json");
