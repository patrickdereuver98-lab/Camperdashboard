// VrijStaan service worker: app-shell offline, eerder bekeken pagina's en kaarttegels uit de cache.
const VERSION = "vs-2";
const SHELL = `${VERSION}-shell`;
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
        .catch(
          async () =>
            (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match("/mijn-reis")) ?? Response.error(),
        ),
    );
  }
});

// Pushmeldingen (bijvoorbeeld "Camperplaats X is nu rustig"). Alleen voor wie een plek volgt.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VrijStaan", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "VrijStaan", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url === url);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
