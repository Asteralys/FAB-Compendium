/** Fragments réutilisés par plusieurs vues. */

import { html, raw } from "../core/dom.js";
import { heroById, heroColor, heroSubtitle, initials } from "../data/heroes.js";

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

export const crestFor = (heroId, artUrl, size) => crest(heroById(heroId), artUrl, size);

export function heroLine(hero) {
  if (!hero) return "—";
  return html`${hero.name} <span class="faint small">· ${hero.life} PV</span>`;
}

export const subtitle = (hero) => (hero ? heroSubtitle(hero) : "");

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

export const lines = (text) => raw(String(text ?? "").split("\n").filter(Boolean).map((l) => `<li>${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</li>`).join(""));
