// VrijStaan service worker: app-shell offline, eerder bekeken pagina's en kaarttegels uit de cache.
// Ophogen leegt alle caches van de vorige versie. Gebouwde bestanden staan in een eigen, begrensde cache
// (STATIC), zodat de chunks van oude deploys er vanzelf uit vallen.
const VERSION = "vs-3";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const TILES = `${VERSION}-tiles`;
const DATA = `${VERSION}-data`;
const PRECACHE = ["/", "/zoeken", "/mijn-reis", "/icon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Opruimen kost een rondgang langs alle sleutels: doe dat niet bij elke tegel of chunk
let puts = 0;
const trimSometimes = (name, max) => {
  if (++puts % 50 === 0) trim(name, max);
};

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Kaarttegels en -stijl van OpenFreeMap: cache eerst, beperkt aantal
  if (url.host === "tiles.openfreemap.org") {
    event.respondWith(
      caches.open(TILES).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          cache.put(req, res.clone());
          trimSometimes(TILES, 1500);
        }
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/admin")) return;

  // Plekken en woonplaatsen: direct uit de cache, op de achtergrond verversen (werkt ook zonder bereik)
  if (url.pathname === "/api/places" || url.pathname === "/api/towns") {
    event.respondWith(
      caches.open(DATA).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit ?? Response.error());
        if (hit) {
          event.waitUntil(fresh.then(() => undefined, () => undefined));
          return hit;
        }
        return fresh;
      }),
    );
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  // Gebouwde bestanden zijn onveranderlijk
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          cache.put(req, res.clone());
          trimSometimes(STATIC, 400);
        }
        return res;
      }),
    );
    return;
  }

  // Pagina's: netwerk eerst, bij geen verbinding de laatst bekeken versie
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(req, copy).then(() => trim(PAGES, 80)));
          }
          return res;
        })
        .catch(
          async () =>
            (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match("/mijn-reis")) ?? Response.error(),
        ),
    );
  }
});
