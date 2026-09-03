/**
 * Réunit l'app modulaire en un seul fichier HTML (dist/fab-compendium.html)
 * pour la prévisualisation partageable. Le code source reste découpé ;
 * ce fichier n'est qu'une sortie de build.
 *
 * Usage : npm run bundle
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WWW = join(ROOT, "www");

const CSS = ["tokens", "base", "components", "duel", "views"].map((n) => `css/${n}.css`);

/* Ordre topologique : chaque module ne dépend que de ceux qui le précèdent. */
const MODULES = [
  "core/dom.js",
  "core/store.js",
  "core/nav.js",
  "data/slim.js",
  "data/heroes.js",
  "data/cards.js",
  "data/rules.js",
  "data/banned.js",
  "data/ll-parse.js",
  "data/legend.js",
  "ui/sheet.js",
  "ui/icons.js",
  "ui/components.js",
  "ui/heropicker.js",
  "ui/settings.js",
  "views/decks.js",
  "views/tournaments.js",
  "views/duel.js",
  "views/stats.js",
  "views/news.js",
  "views/banlist.js",
  "main.js"
];

const read = (p) => readFile(join(WWW, p), "utf8");
const readModule = (p) => readFile(join(WWW, "js", p), "utf8");

/** Réécrit un module ESM en fabrique enregistrée dans le registre __M. */
function wrap(key, source) {
  const exported = new Set();
  let body = source;

  // import … from "…"  →  const … = __M["…"];
  body = body.replace(/^import\s+([\s\S]+?)\s+from\s+["'](.+?)["'];?[ \t]*$/gm, (_, clause, spec) => {
    const target = resolve(key, spec);
    const ns = clause.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (ns) return `const ${ns[1]} = __M[${JSON.stringify(target)}];`;
    const named = clause.trim().replace(/\bas\b/g, ":");
    return `const ${named} = __M[${JSON.stringify(target)}];`;
  });

  // export { a, b };
  body = body.replace(/^export\s*\{([^}]+)\};?[ \t]*$/gm, (_, names) => {
    names.split(",").map((n) => n.trim().split(/\s+as\s+/).pop()).filter(Boolean).forEach((n) => exported.add(n));
    return "";
  });

  // export function / const / let / class
  body = body.replace(/^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => {
    exported.add(name);
    return `${kind} ${name}`;
  });

  if (/^\s*export\s/m.test(body)) throw new Error(`Forme d'export non gérée dans ${key}`);

  const returns = [...exported].map((n) => `${n}`).join(", ");
  return `__M[${JSON.stringify(key)}] = (function () {\n${body}\nreturn { ${returns} };\n})();`;
}

function resolve(from, spec) {
  const dir = posix.dirname(from);
  return posix.normalize(posix.join(dir, spec)).replace(/^\.\//, "");
}

const [css, modules, heroes, cards, legend, banned] = await Promise.all([
  Promise.all(CSS.map(read)).then((parts) => parts.join("\n")),
  Promise.all(MODULES.map(async (m) => wrap(m, await readModule(m)))),
  read("data/heroes.json"),
  read("data/cards.json"),
  read("data/living-legend.json"),
  read("data/banned.json")
]);

const html = `<title>FaB Compendium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Grenze:wght@600;700&family=Alegreya+Sans:wght@400;500;700;900&display=swap">
<style>
${css}
</style>

<div class="shell">
  <header class="topbar">
    <div class="wordmark">FaB <em>Compendium</em></div>
    <div style="flex:1"></div>
    <button class="btn ghost" id="settings" aria-label="Réglages" style="min-height:38px;padding:6px 12px">
      <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" fill="none" stroke-width="1.5" stroke-linecap="round">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2.5v2.6M12 18.9v2.6M4.2 7.2l2.3 1.3M17.5 15.5l2.3 1.3M4.2 16.8l2.3-1.3M17.5 8.5l2.3-1.3"/>
      </svg>
    </button>
  </header>
  <main id="view" class="view"><div class="empty">Chargement…</div></main>
  <nav class="tabbar" id="tabbar" aria-label="Navigation principale"></nav>
</div>

<script>
globalThis.__FAB_HEROES__ = ${heroes};
globalThis.__FAB_CARDS__ = ${cards};
globalThis.__FAB_LEGEND__ = ${legend};
globalThis.__FAB_BANNED__ = ${banned};
</script>
<script>
(function () {
const __M = {};
${modules.join("\n\n")}
})();
</script>
`;

await mkdir(join(ROOT, "dist"), { recursive: true });
const out = join(ROOT, "dist", "fab-compendium.html");
await writeFile(out, html);
console.log(`✔ dist/fab-compendium.html — ${(html.length / 1024).toFixed(0)} Ko`);
