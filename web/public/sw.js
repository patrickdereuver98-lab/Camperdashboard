// VrijStaan service worker: app-shell offline, eerder bekeken pagina's, de plekpagina's van Mijn reis en kaarttegels
// uit de cache. Ophogen leegt alle caches van de vorige versie. Gebouwde bestanden staan in een eigen, begrensde cache
// (STATIC), zodat de chunks van oude deploys er vanzelf uit vallen.
const VERSION = "vs-5";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const TRIP = `${VERSION}-trip`;
const TILES = `${VERSION}-tiles`;
const DATA = `${VERSION}-data`;
const AREA = `${VERSION}-area`;
const PRECACHE = ["/", "/zoeken", "/mijn-reis", "/icon.svg", "/icon-192.png"];

// Wanneer een antwoord in de cache kwam. De site leest dit bij /api/places om "Gegevens van <datum>" te tonen
// (lib/store.ts, CACHED_AT_HEADER); een vers antwoord van het netwerk heeft deze header niet.
const STAMP = "x-vrijstaan-opgeslagen";
// Pagina's: zo lang wachten we op het netwerk voordat de bewaarde versie komt (slecht bereik)
const NAV_TIMEOUT = 3000;
// Plekken en woonplaatsen: binnen 3 uur niet opnieuw ophalen; tot 24 uur direct tonen en op de achtergrond verversen;
// ouder alleen als het netwerk niet werkt (of na DATA_TIMEOUT nog niet antwoordt)
const DATA_FRESH = 3 * 60 * 60 * 1000;
const DATA_MAX_AGE = 24 * 60 * 60 * 1000;
const DATA_TIMEOUT = 8000;
const LIMITS = { [PAGES]: 80, [TRIP]: 60, [AREA]: 40, [STATIC]: 400, [TILES]: 1500 };
// Nooit bewaren: inloggen en accountpagina's (persoonlijk, en een inloglink werkt maar één keer)
const PRIVATE = /^\/(account|inloggen|mijn-camper)(\/|$)/;

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
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Opruimen kost een rondgang langs alle sleutels: doe dat niet bij elke tegel of chunk
let puts = 0;
const trimSometimes = (name) => {
  if (++puts % 50 === 0) trim(name);
};

async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - LIMITS[name]))) await cache.delete(key);
}

/** Kopie van een antwoord met het moment van bewaren erbij */
function stamp(res) {
  const headers = new Headers(res.headers);
  headers.set(STAMP, new Date().toISOString());
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function ageOf(res) {
  const t = Date.parse(res.headers.get(STAMP) || "");
  return Number.isNaN(t) ? Infinity : Date.now() - t;
}

/** Wacht hoogstens `ms` op een belofte; daarna een afwijzing (de belofte zelf loopt door) */
function within(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("time-out")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Laat de service worker leven tot het bewaren klaar is (mag zolang het antwoord nog onderweg is) */
function keepAlive(event, promise) {
  const quiet = promise.then(
    () => undefined,
    () => undefined,
  );
  try {
    event.waitUntil(quiet);
  } catch {
    /* het event is al afgerond: dan loopt het bewaren gewoon door zolang de worker leeft */
  }
}

const escapeHtml =(s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Eigen pagina als een niet-bewaarde pagina zonder verbinding wordt geopend (in plaats van stil een andere pagina) */
function offlinePage(url) {
  const again = escapeHtml(url.pathname + url.search);
  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Geen verbinding | VrijStaan</title>
<style>
:root{--paper:#f5f0e6;--surface:#fffcf6;--ink:#1f2b24;--ink-2:#46524a;--line:#e0d7c5;--forest:#2d5a43;--on-forest:#fffcf6;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--paper:#111713;--surface:#18201b;--ink:#ece7db;--ink-2:#c7c2b6;--line:#2c3730;--forest:#8dbf9f;--on-forest:#0f1612}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;align-items:flex-start;justify-content:center;padding:15vh 16px 32px}
main{width:100%;max-width:28rem;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:24px}
h1{margin:0 0 8px;font-size:1.5rem;line-height:1.25}
p{margin:0 0 20px;color:var(--ink-2)}
a{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:6px;font-weight:600;text-decoration:none;margin-top:8px}
.main{background:var(--forest);color:var(--on-forest)}
.second{border:1px solid var(--line);color:var(--ink)}
</style>
</head>
<body>
<main>
<h1>Geen verbinding</h1>
<p>Deze pagina staat nog niet op je toestel. Pagina's die je eerder hebt bekeken en de plekken in Mijn reis werken wel zonder bereik.</p>
<a class="main" href="${again}">Opnieuw proberen</a>
<a class="second" href="/mijn-reis">Naar Mijn reis</a>
</main>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  });
}

/** Plekken en woonplaatsen: begrensd verversen, en oude gegevens alleen als het netwerk niet werkt */
async function data(event, req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const age = hit ? ageOf(hit) : Infinity;
  const refresh = () =>
    fetch(req).then((res) => {
      if (res.ok) {
        const saved = cache.put(req, stamp(res.clone())).then(() => (LIMITS[name] ? trim(name) : undefined));
        keepAlive(event, saved);
        return res;
      }
      // Een serverfout: dan liever de bewaarde versie (met datum) dan niets
      return hit || res;
    });
  if (hit && age < DATA_FRESH) return hit;
  if (hit && age < DATA_MAX_AGE) {
    event.waitUntil(refresh().then(() => undefined, () => undefined));
    return hit;
  }
  const network = refresh();
  if (!hit) return network.catch(() => Response.error());
  // Ouder dan een dag: alleen als het netwerk het niet doet (of te traag is) de oude versie, met zijn datum
  event.waitUntil(network.then(() => undefined, () => undefined));
  return within(network, DATA_TIMEOUT).catch(() => hit);
}

/** Pagina's: netwerk eerst; na NAV_TIMEOUT of zonder verbinding de bewaarde versie, anders de offline-pagina */
async function page(event, req, url) {
  const keep = !PRIVATE.test(url.pathname);
  const network = fetch(req);
  // Ook na een time-out het nieuwe antwoord nog bewaren (de kopie meteen maken, vóór de pagina het antwoord leest)
  event.waitUntil(
    network
      .then(async (res) => {
        if (!keep || !res.ok) return;
        const copy = stamp(res.clone());
        await (await caches.open(PAGES)).put(req, copy);
        await trim(PAGES);
      })
      .catch(() => undefined),
  );
  try {
    return await within(network, keep ? NAV_TIMEOUT : 60000);
  } catch {
    const hit = keep ? await caches.match(req, { ignoreSearch: true, ignoreVary: true }) : undefined;
    if (hit) return hit;
    // Geen bewaarde versie: verder wachten op het netwerk, en lukt dat niet de offline-pagina
    return network.catch(() => offlinePage(url));
  }
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
          trimSometimes(TILES);
        }
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/admin")) return;

  // Plekken en woonplaatsen. Een kaartuitsnede (?bbox=) in een eigen, kleine cache
  if (url.pathname === "/api/places" || url.pathname === "/api/towns") {
    event.respondWith(data(event, req, url.search ? AREA : DATA));
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
          trimSometimes(STATIC);
        }
        return res;
      }),
    );
    return;
  }

  // Supportpagina's nooit bewaren (het token in het adres geeft toegang tot het ticket); de terugkeer na inloggen
  // ook niet (een code die maar één keer werkt)
  if (url.pathname.startsWith("/support/") || url.pathname.startsWith("/auth/")) return;

  if (req.mode === "navigate") event.respondWith(page(event, req, url));
});

// Mijn reis vraagt de plekpagina's van de reis vast op te halen, zodat ze onderweg ook zonder bereik openen.
// De cache TRIP houdt precies de plekken van de huidige reis; wat eruit is, gaat weg.
const PLACE_PATH = /^\/plek\/[a-z0-9-]{1,120}$/;

async function keepTripPages(paths) {
  const cache = await caches.open(TRIP);
  const wanted = new Set(paths);
  for (const key of await cache.keys()) if (!wanted.has(new URL(key.url).pathname)) await cache.delete(key);
  for (const path of paths) {
    const hit = await cache.match(path, { ignoreVary: true });
    if (hit && ageOf(hit) < DATA_MAX_AGE) continue;
    try {
      const res = await fetch(path, { credentials: "same-origin" });
      if (res.ok) await cache.put(path, stamp(res));
    } catch {
      return; // geen bereik: de volgende keer verder
    }
  }
}

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "bewaar-plekken" || !Array.isArray(msg.paths)) return;
  const paths = [...new Set(msg.paths.filter((p) => typeof p === "string" && PLACE_PATH.test(p)))].slice(0, LIMITS[TRIP]);
  event.waitUntil(keepTripPages(paths));
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
