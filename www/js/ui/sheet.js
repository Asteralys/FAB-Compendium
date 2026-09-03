/**
 * Feuilles modales glissant depuis le bas — le geste attendu sur mobile.
 * Elles s'empilent : ouvrir le sélecteur de héros par-dessus un formulaire
 * ne doit pas faire perdre ce qui a déjà été saisi.
 */

import { qsa } from "../core/dom.js";

const stack = [];

function unlockIfEmpty() {
  if (!stack.length) document.body.style.overflow = "";
}

/** Ferme la feuille du dessus. */
export function closeSheet() {
  const top = stack.pop();
  if (!top) return;
  top.el.remove();
  top.onClose?.();
  unlockIfEmpty();
}

/** Ferme toute la pile (changement d'onglet, réinitialisation). */
export function closeAllSheets() {
  while (stack.length) closeSheet();
  qsa(".sheet").forEach((s) => s.remove());
  unlockIfEmpty();
}

/**
 * openSheet(contenuHTML) → l'élément .sheet-inner, pour brancher les évènements.
 * Fermeture : clic sur le fond, bouton [data-close], touche Échap.
 */
export function openSheet(content, { onClose } = {}) {
  const el = document.createElement("div");
  el.className = "sheet";
  el.style.zIndex = String(60 + stack.length * 2);
  el.innerHTML = `<div class="sheet-inner" role="dialog" aria-modal="true"><div class="grab"></div>${content}</div>`;

  el.addEventListener("click", (e) => {
    if (e.target === el || e.target.closest("[data-close]")) closeSheet();
  });

  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  stack.push({ el, onClose });

  el.querySelector("input, select, textarea, button:not([data-close])")?.focus?.({ preventScroll: true });
  return el.querySelector(".sheet-inner");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && stack.length) closeSheet();
});

/** Confirmation courte, sans bloquer le fil d'exécution du navigateur. */
export function confirmSheet(title, message, confirmLabel = "Confirmer") {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const inner = openSheet(
      `<h3>${title}</h3><p class="muted small">${message}</p>
       <div class="actions">
         <button class="btn" data-close>Annuler</button>
         <button class="btn danger" data-confirm>${confirmLabel}</button>
       </div>`,
      { onClose: () => done(false) }
    );

    inner.querySelector("[data-confirm]").addEventListener("click", () => {
      done(true);
      closeSheet();
    });
  });
}
