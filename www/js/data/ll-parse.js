/**
 * Lecture de la page « Living Legend » du site officiel.
 * Partagé par tools/build-ll.mjs (instantané livré avec l'app) et par
 * data/legend.js (rafraîchissement depuis l'APK).
 */

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  "#39": "'", "#8217": "’", "#8211": "–", nbsp: " ", ndash: "–", mdash: "—"
};

export function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&([a-z]+|#\d+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

const num = (s) => {
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

/** @returns {{threshold:number, board:Array, legends:Array, weapons:Array}} */
export function parseLivingLegend(html) {
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((m) => m[1]);

  const rowsOf = (table) =>
    [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => stripTags(c[1])))
      .filter((cells) => cells.length);

  const board = [];
  const legends = [];
  const weapons = [];

  for (const table of tables) {
    const rows = rowsOf(table);
    if (rows.length < 2) continue;
    const head = rows[0].map((h) => h.toLowerCase());
    const body = rows.slice(1);

    if (head[0] === "rank" && head.some((h) => h.includes("season"))) {
      body.forEach((r) => {
        const points = num(r[3]);
        if (r[1] && points !== null) board.push({ hero: r[1], season: num(r[2]), points });
      });
    } else if (head[0] === "rank" && head[1] === "hero") {
      body.forEach((r) => {
        const points = num(r[2]);
        if (r[1]) legends.push({ hero: r[1], points });
      });
    } else if (head[0] === "hero" && head[1] === "weapon") {
      body.forEach((r) => { if (r[0] && r[1]) weapons.push({ hero: r[0], weapon: r[1] }); });
    }
  }

  return {
    source: "https://fabtcg.com/living-legend/",
    fetchedAt: new Date().toISOString().slice(0, 10),
    threshold: 1000,
    board: board.sort((a, b) => b.points - a.points),
    legends: legends.sort((a, b) => b.points - a.points),
    weapons
  };
}
