/**
 * Changement d'onglet depuis n'importe quelle vue (ex. lancer un round de
 * tournoi bascule sur Duel, terminer ce duel revient sur Tournois) sans que
 * ces vues aient à importer main.js — ça créerait un import circulaire avec
 * le bundler mono-fichier, qui n'a pas de liaison vive entre modules.
 */

let handler = null;

/** Appelé une fois par main.js au démarrage. */
export function registerTabSwitcher(fn) { handler = fn; }

export function goToTab(id) { handler?.(id); }
