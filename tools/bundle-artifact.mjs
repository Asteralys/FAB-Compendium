/**
 * Réunit l'app modulaire en un seul fichier HTML (dist/fab-compendium.html)
 * pour la prévisualisation partageable. Le code source reste découpé ;
 * ce fichier n'est qu'une sortie de build.
 *
 * L'ordre d'assemblage des modules est déduit automatiquement de leurs
 * `import` (tri topologique) plutôt que maintenu à la main : une nouvelle
 * dépendance entre deux vues ne peut plus casser le build en silence parce
 * qu'on a oublié de la refléter dans une liste manuelle — c'est exactement
 * ce qui s'est produit une fois entre tournaments.js et duel.js.
 *
 * Usage : npm run bundle
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WWW = join(ROOT, "www");
const JS = join(WWW, "js");

const CSS = ["tokens", "base", "components", "duel", "views"].map((n) => `css/${n}.css`);

const read = (p) => readFile(join(WWW, p), "utf8");
const readModule = (p) => readFile(join(JS, p), "utf8");

/** Liste tous les modules .js sous www/js, chemins relatifs en style posix (ex. "views/duel.js"). */
async function listModules(dir = "") {
  const entries = await readdir(join(JS, dir), { withFileTypes: true });
  const found = [];
  for (const e of entries) {
    const rel = dir ? posix.join(dir, e.name) : e.name;
    if (e.isDirectory()) found.push(...await listModules(rel));
    else if (e.name.endsWith(".js")) found.push(rel);
  }
  return found;
}

/** Specs importés par un module (chemins relatifs bruts, non résolus). */
function importSpecs(source) {
  const specs = [];
  const re = /^import\s+[\s\S]+?\s+from\s+["'](.+?)["'];?[ \t]*$/gm;
  let m;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

function resolve(from, spec) {
  const dir = posix.dirname(from);
  return posix.normalize(posix.join(dir, spec)).replace(/^\.\//, "");
}

/**
 * Tri topologique par parcours en profondeur : chaque module est placé
 * juste après tout ce dont il dépend. Un cycle authentique (A importe B qui
 * importe A) est détecté et signalé clairement plutôt que de produire un
 * bundle dont l'ordre est silencieusement faux.
 */
function topoSort(graph) {
  const order = [];
  const done = new Set();
  const visiting = new Set();

  function visit(key, chain) {
    if (done.has(key)) return;
    if (visiting.has(key)) throw new Error(`Import circulaire : ${[...chain, key].join(" → ")}`);
    visiting.add(key);
    for (const dep of graph.get(key) || []) visit(dep, [...chain, key]);
    visiting.delete(key);
    done.add(key);
    order.push(key);
  }

  for (const key of graph.keys()) visit(key, []);
  return order;
}

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

const files = await listModules();
const sources = new Map(await Promise.all(files.map(async (f) => [f, await readModule(f)])));

const graph = new Map(files.map((f) => [
  f,
  importSpecs(sources.get(f))
    .filter((s) => s.startsWith(".")) // ignore d'éventuels imports externes
    .map((s) => resolve(f, s))
]));

const order = topoSort(graph);

const [css, modules, heroes, cards, legend, banned] = await Promise.all([
  Promise.all(CSS.map(read)).then((parts) => parts.join("\n")),
  Promise.all(order.map((m) => wrap(m, sources.get(m)))),
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
console.log(`✔ dist/fab-compendium.html — ${(html.length / 1024).toFixed(0)} Ko (${order.length} modules, ordre déduit des imports)`);
