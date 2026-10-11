// VrijStaan service worker: app-shell offline, eerder bekeken pagina's en kaarttegels uit de cache.
const VERSION = "vs-1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const TILES = `${VERSION}-tiles`;
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
          trim(TILES, 1500);
        }
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) return;

  // Gebouwde bestanden zijn onveranderlijk
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
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
        .catch(async () => (await caches.match(req)) ?? (await caches.match("/mijn-reis")) ?? Response.error()),
    );
  }
});
