/* Service worker : l'app doit rester utilisable en salle de tournoi, sans réseau. */

const CACHE = "fab-compendium-v5";
const MEDIA = "fab-media-v1";   // illustrations de cartes et polices

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/duel.css",
  "./css/views.css",
  "./js/main.js",
  "./js/core/dom.js",
  "./js/core/store.js",
  "./js/core/nav.js",
  "./js/data/heroes.js",
  "./js/data/cards.js",
  "./js/data/rules.js",
  "./js/data/offline.js",
  "./js/data/banned.js",
  "./js/data/legend.js",
  "./js/data/ll-parse.js",
  "./js/data/slim.js",
  "./js/ui/components.js",
  "./js/ui/heropicker.js",
  "./js/ui/icons.js",
  "./js/ui/settings.js",
  "./js/ui/sheet.js",
  "./js/views/duel.js",
  "./js/views/decks.js",
  "./js/views/stats.js",
  "./js/views/tournaments.js",
  "./js/views/news.js",
  "./js/views/banlist.js",
  "./data/heroes.json",
  "./data/cards.json",
  "./data/living-legend.json",
  "./data/banned.json",
  "./icons/icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Illustrations et polices : cache d'abord, puis réseau, et on garde une
  // copie — y compris les réponses opaques, qui s'affichent très bien dans
  // une balise <img>. En cas d'échec on renvoie une vraie réponse d'erreur :
  // rendre `undefined` ferait disparaître l'image définitivement.
  if (url.origin !== location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(MEDIA);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone()).catch(() => {});
        return res;
      } catch {
        return hit || Response.error();
      }
    })());
    return;
  }

  // Coquille applicative : réseau d'abord (pour recevoir les mises à jour),
  // cache en secours dès que la connexion manque.
  e.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./index.html")))
  );
});
