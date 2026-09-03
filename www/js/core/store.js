/** État applicatif persisté sur l'appareil (aucun envoi réseau). */

const KEY = "fab.compendium.v2";
const BACKUP_KEY = "fab.compendium.backup";
const LEGACY_KEY = "fab_compendium_v1";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

function empty() {
  return {
    decks: [],
    matches: [],
    tournaments: [],
    duel: null,
    prefs: {
      skin: "ombre",       // ombre | vellum
      faceToFace: true,    // panneau adverse retourné à 180°
      keepAwake: true,
      roundLimit: 40,      // minutes, pour l'alerte de chrono
      artByHero: {}         // heroId → illustration préférée, mémorisée au fil des choix
    },
    lastUpdateCheck: 0
  };
}

function read() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Fusion en profondeur des préférences : un ancien enregistrement sans
      // les derniers réglages (ex. artByHero) ne doit pas perdre leurs valeurs par défaut.
      return { ...empty(), ...parsed, prefs: { ...empty().prefs, ...(parsed.prefs || {}) } };
    }
    // Reprise silencieuse de la première version de l'app.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy);
      return { ...empty(), decks: old.decks || [], matches: old.matches || [], tournaments: old.tournaments || [] };
    }
  } catch { /* stockage indisponible : on repart à vide */ }
  return empty();
}

export const S = read();

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const isEmpty = (d) => !d?.decks?.length && !d?.matches?.length && !d?.tournaments?.length;

export function save() {
  try {
    const next = JSON.stringify(S);

    // Filet de sécurité : avant d'écraser des données par un état vide
    // (mauvais appui sur « tout effacer », import raté), on garde une copie.
    if (isEmpty(S)) {
      const previous = localStorage.getItem(KEY);
      if (previous && !isEmpty(JSON.parse(previous))) localStorage.setItem(BACKUP_KEY, previous);
    }

    localStorage.setItem(KEY, next);
  } catch { /* quota plein ou mode privé */ }
}

/** Contenu de la copie de secours, s'il y en a une. */
export function backup() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return isEmpty(data) ? null : data;
  } catch { return null; }
}

export function restoreBackup() {
  const data = backup();
  if (!data) return false;
  Object.assign(S, empty(), data, { duel: null, prefs: { ...empty().prefs, ...(data.prefs || {}) } });
  commit();
  return true;
}

/** Enregistre puis redessine. */
export function commit() {
  save();
  listeners.forEach((fn) => fn());
}

export function replaceAll(data) {
  Object.assign(S, empty(), data, { duel: null, prefs: { ...empty().prefs, ...(data.prefs || {}) } });
  commit();
}

export const deckById = (id) => S.decks.find((d) => d.id === id) || null;
export const tournamentById = (id) => S.tournaments.find((t) => t.id === id) || null;

/** Bilan victoires/défaites, filtrable. */
export function record(filter = () => true) {
  const list = S.matches.filter(filter);
  const wins = list.filter((m) => m.result === "W").length;
  return {
    played: list.length,
    wins,
    losses: list.length - wins,
    rate: list.length ? Math.round((wins / list.length) * 100) : null
  };
}
