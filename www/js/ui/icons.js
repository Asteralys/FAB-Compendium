/** Pictogrammes au trait — dessinés à la main pour rester dans la DA. */

import { raw } from "../core/dom.js";

const paths = {
  duel: '<path d="M4 3l9 9M20 3l-4.5 4.5M13 12l-2.5 2.5M6.5 14.5L4 17l3 3 2.5-2.5"/><path d="M14.5 14.5L20 20l-3 1-1-3"/>',
  decks: '<rect x="8" y="8" width="13" height="14" rx="1.8"/><path d="M5.5 15V5.8A1.8 1.8 0 0 1 7.3 4H16"/>',
  stats: '<path d="M4 19V11M9.3 19V5M14.6 19v-6M20 19V8"/>',
  events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  news: '<path d="M4 5h11v14H4z"/><path d="M15 9h4a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2h-3"/><path d="M7 8.5h5M7 12h5M7 15.5h3"/>',

  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 5v6h-6"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4.5l3 1.8"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4.2l2.6 1.6M9.5 2h5"/>',
  flag: '<path d="M6 21V4"/><path d="M6 4.5h11l-2.2 3.6L17 12H6z"/>',
  undo: '<path d="M4 9h11a5 5 0 1 1 0 10h-4"/><path d="M8 5L4 9l4 4"/>',
  swap: '<path d="M7 4v14M7 4L4 7.5M7 4l3 3.5"/><path d="M17 20V6M17 20l3-3.5M17 20l-3-3.5"/>',
  cog: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.2 7.2l2.3 1.3M17.5 15.5l2.3 1.3M4.2 16.8l2.3-1.3M17.5 8.5l2.3-1.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5A2.5 2.5 0 0 0 7 9.5M17 6h2.5A2.5 2.5 0 0 1 17 9.5"/><path d="M12 14v3M8.5 20h7l-.7-3h-5.6z"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 18.5V6"/>',
  scroll: '<path d="M6 4h11v13a3 3 0 0 0 3 3H8a3 3 0 0 1-3-3V6"/><path d="M9 8h5M9 11.5h5"/>',
  cards: '<rect x="8" y="3" width="10" height="14" rx="1.5"/><path d="M5.5 6.5v12a2 2 0 0 0 2 2H15"/>',
  heart: '<path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20z"/>',
  warn: '<path d="M12 4.3L21.5 20H2.5z"/><path d="M12 9.8v4.2M12 17v.1"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6.6 6.6l10.8 10.8"/>'
};

/** icon("duel") → <svg …> prêt à être injecté. */
export function icon(name, size) {
  const d = paths[name] || "";
  const attr = size ? ` width="${size}" height="${size}"` : "";
  return raw(`<svg viewBox="0 0 24 24"${attr} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
}
