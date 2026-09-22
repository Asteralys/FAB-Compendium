/** Fragments réutilisés par plusieurs vues. */

import { html, raw, esc } from "../core/dom.js";
import { S } from "../core/store.js";
import { allHeroes, heroColor, initials } from "../data/heroes.js";

/**
 * Vignette d'un héros. Si l'illustration ne charge pas (hors-ligne, réseau
 * bloqué), l'image s'efface et le monogramme doré prend le relais.
 */
export function crest(hero, artUrl = null, size = "") {
  if (!hero) return html`<div class="crest ${size}">?</div>`;
  const url = artUrl || hero.arts?.[0]?.url;
  return html`<div class="crest ${size}">
    ${initials(hero.name)}
    ${url ? raw(`<img alt="" loading="lazy" src="${url}" onerror="this.remove()">`) : ""}
    <i class="accent" style="background:${heroColor(hero)}"></i>
  </div>`;
}

/**
 * `<optgroup>` Adultes/Jeunes pour un `<select>` de héros — utilisé par les
 * formulaires qui n'ont pas besoin du sélecteur visuel complet (choisir
 * l'adversaire d'un match ou d'un round de tournoi, par exemple).
 */
export function heroSelectGroups(selectedId = null) {
  const opt = (h) => `<option value="${h.id}" ${h.id === selectedId ? "selected" : ""}>${esc(h.name)}</option>`;
  const adults = allHeroes().filter((h) => !h.young).map(opt).join("");
  const young = allHeroes().filter((h) => h.young).map(opt).join("");
  return raw(`<optgroup label="Adultes">${adults}</optgroup><optgroup label="Jeunes">${young}</optgroup>`);
}

/** `<option>` pour chaque deck du joueur — utilisé par tous les formulaires qui en proposent le choix. */
export function deckOptions(selectedId = null) {
  return raw(S.decks.map((d) => `<option value="${d.id}" ${d.id === selectedId ? "selected" : ""}>${esc(d.name)}</option>`).join(""));
}

/**
 * Liste à puces à partir d'un texte libre, une entrée par ligne ; tiret si
 * vide. Renvoie un Raw plutôt qu'un tableau de fragments : ça reste correct
 * qu'on l'interpole dans un gabarit `html\`\`` ou dans une chaîne brute
 * (feuille ouverte via openSheet), les deux existent selon les vues.
 */
export function bulletList(text) {
  const items = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const body = items.length ? items.map((l) => `<li>${esc(l)}</li>`).join("") : `<li class="faint">—</li>`;
  return raw(body);
}

/* ------------------------------ dates ------------------------------ */

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export const today = () => new Date().toISOString().slice(0, 10);

export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function dayNumber(iso) { return iso ? iso.slice(8, 10) : "–"; }
export function monthLabel(iso) { return iso ? MONTHS[Number(iso.slice(5, 7)) - 1].replace(".", "") : ""; }

/** « dans 3 jours », « demain », « aujourd'hui ». */
export function countdown(iso) {
  if (!iso) return "";
  const days = Math.round((new Date(iso + "T12:00") - new Date(today() + "T12:00")) / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days < 0) return "";
  if (days < 7) return `dans ${days} jours`;
  if (days < 14) return "la semaine prochaine";
  return `dans ${Math.round(days / 7)} semaines`;
}

export const clock = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/* ------------------------------ chiffres --------------------------- */

export function ratePill(rate) {
  if (rate === null) return html`<span class="pill">jamais joué</span>`;
  return html`<span class="pill ${rate >= 50 ? "win" : "loss"}">${rate}%</span>`;
}

export function winBar(label, wins, played) {
  const rate = played ? Math.round((wins / played) * 100) : 0;
  return html`<div class="bar">
    <div class="track"><i style="width:${rate}%"></i><em>${label}</em></div>
    <div class="val">${wins}-${played - wins}</div>
  </div>`;
}
