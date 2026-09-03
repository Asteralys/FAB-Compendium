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

process.stdout.write("Course au Living Legend — fabtcg.com … ");
const res = await fetch(PAGE, { headers: { "user-agent": UA, accept: "text/html" } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);

const data = parseLivingLegend(await res.text());
if (!data.board.length) throw new Error("Tableau introuvable — la page a changé de structure.");

await writeFile(join(ROOT, "www", "data", "living-legend.json"), JSON.stringify(data));
console.log(`${data.board.length} héros en course, ${data.legends.length} déjà Living Legend`);
console.log(`  Tête : ${data.board.slice(0, 3).map((b) => `${b.hero} ${b.points}`).join(" · ")}`);
console.log("  → www/data/living-legend.json");
