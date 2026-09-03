/** Utilitaires de rendu : gabarits balisés, échappement, sélection. */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marque une chaîne comme déjà sûre (pas de ré-échappement). */
export const raw = (s) => new Raw(s);

function part(v) {
  if (v == null || v === false || v === true) return "";
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(part).join("");
  return esc(v);
}

/** html`<p>${valeurÉchappée}</p>` — les tableaux sont concaténés. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new Raw(out);
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Délégation d'évènement : on(root, "click", "[data-x]", handler). */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function toast(message) {
  qsa(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/** Retour haptique léger là où le téléphone le permet. */
export function buzz(ms = 12) {
  try { navigator.vibrate?.(ms); } catch { /* ignoré */ }
}
