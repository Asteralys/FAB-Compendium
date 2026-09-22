/**
 * Téléchargement en masse de toutes les illustrations (cartes + héros) pour
 * un usage hors connexion complet. Sans ça, une image n'est mise en cache
 * qu'après avoir été vue au moins une fois en ligne (voir sw.js, cache
 * MEDIA) : utile au fil de l'eau, mais ça laisse des trous tant qu'on n'a
 * pas ouvert chaque carte au moins une fois.
 *
 * Chaque requête passe par le service worker, qui la met en cache au
 * passage exactement comme s'il s'agissait d'une <img> — après ce
 * téléchargement, plus aucune illustration n'a besoin du réseau.
 */

import { allCards, cardImage } from "./cards.js";
import { allHeroes } from "./heroes.js";

const CONCURRENCY = 6;
const MEDIA_CACHE = "fab-media-v1";

/** Toutes les URL d'illustrations connues (cartes + tirages de héros), sans doublon. */
export function allArtUrls() {
  const urls = new Set();
  for (const c of allCards()) {
    const u = cardImage(c.img);
    if (u) urls.add(u);
  }
  for (const h of allHeroes()) {
    for (const a of h.arts) if (a.url) urls.add(a.url);
  }
  return [...urls];
}

/** Combien de ces URL sont déjà en cache — pour afficher un état avant de lancer le téléchargement. */
export async function cachedArtCount() {
  if (!("caches" in window)) return null;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    return new Set(keys.map((k) => k.url)).size;
  } catch {
    return null;
  }
}

/**
 * Télécharge (et donc met en cache) chaque illustration pas encore connue.
 * `mode: "no-cors"` est nécessaire : ce CDN ne renvoie pas d'en-tête CORS,
 * comme pour les balises <img> qui fonctionnent déjà sans lui.
 * @param {(done:number, total:number)=>void} onProgress
 */
export async function predownloadArt(onProgress = () => {}) {
  const urls = allArtUrls();
  let done = 0;
  onProgress(0, urls.length);

  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      try { await fetch(url, { mode: "no-cors" }); }
      catch { /* hors-ligne ou image disparue : on continue avec les autres */ }
      done++;
      onProgress(done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return urls.length;
}
