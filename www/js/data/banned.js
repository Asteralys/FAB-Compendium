/**
 * Cartes bannies, suspendues et restreintes, tous formats officiels
 * confondus. Instantané livré avec l'app, régénéré par `npm run banned`.
 */

const CACHE_KEY = "fab.banned.v1";

let data = null; // { version, cards:[{name, pitch, statuses:[{format, status}]}] }

function adopt(next) {
  data = next;
  return data;
}

export async function loadBanned() {
  if (data) return data;

  if (globalThis.__FAB_BANNED__) return adopt(globalThis.__FAB_BANNED__);

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return adopt(JSON.parse(cached));
  } catch { /* cache illisible */ }

  const res = await fetch("./data/banned.json");
  if (!res.ok) throw new Error("Liste des cartes interdites introuvable");
  return adopt(await res.json());
}

export const bannedData = () => data;

export async function resetBanned() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* rien à faire */ }
  data = null;
  return loadBanned();
}
