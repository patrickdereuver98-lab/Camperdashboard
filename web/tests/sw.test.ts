// De service worker (public/sw.js) in een nagebootste omgeving: caches, fetch en events. Tijden gaan 100× sneller.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { beforeEach, test } from "node:test";
import vm from "node:vm";

const ORIGIN = "https://vrijstaan.test";
const SOURCE = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const VERSION = /const VERSION = "([^"]+)"/.exec(SOURCE)![1];
const STAMP = "x-vrijstaan-opgeslagen";

type Req = string | { url: string; method?: string; mode?: string };
const urlOf = (r: Req) => new URL(typeof r === "string" ? r : r.url, ORIGIN);

class FakeCache {
  entries: { url: URL; res: Response }[] = [];
  async match(r: Req, opts: { ignoreSearch?: boolean } = {}) {
    const u = urlOf(r);
    const key = (x: URL) => (opts.ignoreSearch ? x.origin + x.pathname : x.href);
    const hit = this.entries.find((e) => key(e.url) === key(u));
    return hit ? hit.res.clone() : undefined;
  }
  async put(r: Req, res: Response) {
    const u = urlOf(r);
    const body = await res.arrayBuffer();
    this.entries = this.entries.filter((e) => e.url.href !== u.href);
    this.entries.push({ url: u, res: new Response(body, { status: res.status, headers: res.headers }) });
  }
  async keys() {
    return this.entries.map((e) => ({ url: e.url.href }));
  }
  async delete(r: Req) {
    const u = urlOf(r);
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.url.href !== u.href);
    return this.entries.length < before;
  }
}

class FakeCaches {
  map = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.map.has(name)) this.map.set(name, new FakeCache());
    return this.map.get(name)!;
  }
  async keys() {
    return [...this.map.keys()];
  }
  async delete(name: string) {
    return this.map.delete(name);
  }
  async match(r: Req, opts?: { ignoreSearch?: boolean }) {
    for (const c of this.map.values()) {
      const hit = await c.match(r, opts);
      if (hit) return hit;
    }
    return undefined;
  }
}

type Handler = (event: unknown) => void;
let caches: FakeCaches;
let handlers: Record<string, Handler>;
let net: (url: URL) => Promise<Response>;
let fetched: string[];

beforeEach(() => {
  caches = new FakeCaches();
  handlers = {};
  fetched = [];
  net = async () => new Response("netwerk", { status: 200 });
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, h: Handler) => (handlers[type] = h),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  vm.runInNewContext(SOURCE, {
    self,
    caches,
    fetch: (r: Req) => {
      const u = urlOf(r);
      fetched.push(u.pathname + u.search);
      return net(u);
    },
    Response,
    Headers,
    URL,
    Date,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms / 100),
    clearTimeout,
  });
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise<Response>(() => undefined);

async function dispatch(type: string, data: Record<string, unknown>) {
  let response: Promise<Response> | undefined;
  const extend: Promise<unknown>[] = [];
  handlers[type]({
    ...data,
    respondWith: (p: Promise<Response>) => (response = p),
    waitUntil: (p: Promise<unknown>) => extend.push(p),
  });
  const res = response ? await response : undefined;
  // Achtergrondwerk (bewaren in de cache) afmaken; tijden zijn 100× korter
  await Promise.race([Promise.all(extend), wait(200)]);
  await wait(5);
  return res;
}

const navigate = (path: string) => dispatch("fetch", { request: { url: ORIGIN + path, method: "GET", mode: "navigate" } });
const get = (path: string) => dispatch("fetch", { request: { url: ORIGIN + path, method: "GET", mode: "cors" } });

async function seed(cacheName: string, path: string, body: string, ageMs: number) {
  const c = await caches.open(`${VERSION}-${cacheName}`);
  await c.put(path, new Response(body, { headers: { [STAMP]: new Date(Date.now() - ageMs).toISOString() } }));
}

const HOUR = 60 * 60 * 1000;

test("pagina: vers van het netwerk en bewaard met datum", async () => {
  const res = await navigate("/plek/a");
  assert.equal(await res!.text(), "netwerk");
  const hit = await (await caches.open(`${VERSION}-pages`)).match("/plek/a");
  assert.ok(hit?.headers.get(STAMP));
});

test("pagina: traag netwerk, na de time-out de bewaarde versie", async () => {
  await seed("pages", "/plek/a", "bewaard", HOUR);
  net = never;
  const started = Date.now();
  const res = await navigate("/plek/a");
  assert.equal(await res!.text(), "bewaard");
  assert.ok(Date.now() - started < 1000);
});

test("pagina: zonder verbinding en niet bewaard geeft de offline-pagina, niet stil Mijn reis", async () => {
  await (await caches.open(`${VERSION}-shell`)).put("/mijn-reis", new Response("mijn reis"));
  net = async () => {
    throw new TypeError("Failed to fetch");
  };
  const res = await navigate("/plek/onbekend?x=1");
  assert.equal(res!.status, 503);
  const html = await res!.text();
  assert.match(html, /Geen verbinding/);
  assert.match(html, /href="\/plek\/onbekend\?x=1"/);
  assert.doesNotMatch(html, /mijn reis$/);
});

test("pagina: traag netwerk zonder bewaarde versie blijft wachten op het netwerk", async () => {
  net = () => wait(60).then(() => new Response("laat maar goed"));
  const res = await navigate("/plek/b");
  assert.equal(await res!.text(), "laat maar goed");
});

test("account, inloggen en mijn-camper worden niet bewaard; /auth/ niet onderschept", async () => {
  for (const path of ["/account", "/inloggen", "/mijn-camper", "/inloggen?next=/mijn-reis"]) await navigate(path);
  assert.equal((await caches.open(`${VERSION}-pages`)).entries.length, 0);
  assert.equal(await navigate("/auth/callback?code=x"), undefined);
});

test("dataset: binnen 3 uur uit de cache zonder netwerk", async () => {
  await seed("data", "/api/places", "[1]", HOUR);
  const res = await get("/api/places");
  assert.equal(await res!.text(), "[1]");
  assert.ok(res!.headers.get(STAMP), "de site ziet dat het uit de cache komt");
  assert.deepEqual(fetched, []);
});

test("dataset: tussen 3 en 24 uur uit de cache en op de achtergrond verversen", async () => {
  await seed("data", "/api/places", "[1]", 5 * HOUR);
  net = async () => new Response("[2]");
  const res = await get("/api/places");
  assert.equal(await res!.text(), "[1]");
  assert.deepEqual(fetched, ["/api/places"]);
  const fresh = await (await caches.open(`${VERSION}-data`)).match("/api/places");
  assert.equal(await fresh!.text(), "[2]");
});

test("dataset: ouder dan 24 uur niet gebruiken als het netwerk werkt", async () => {
  await seed("data", "/api/places", "[oud]", 30 * HOUR);
  net = async () => new Response("[nieuw]");
  const res = await get("/api/places");
  assert.equal(await res!.text(), "[nieuw]");
  assert.equal(res!.headers.get(STAMP), null, "vers: geen datum nodig");
});

test("dataset: ouder dan 24 uur wel als er geen netwerk is, met datum", async () => {
  await seed("data", "/api/places", "[oud]", 30 * HOUR);
  net = async () => {
    throw new TypeError("offline");
  };
  const res = await get("/api/places");
  assert.equal(await res!.text(), "[oud]");
  assert.ok(res!.headers.get(STAMP));
});

test("kaartuitsneden in een eigen begrensde cache", async () => {
  for (let i = 0; i < 45; i++) await get(`/api/places?bbox=${i},0,1,1`);
  assert.equal((await caches.open(`${VERSION}-area`)).entries.length, 40);
  assert.equal((await caches.open(`${VERSION}-data`)).entries.length, 0);
});

test("Mijn reis: plekpagina's van de reis vast bewaren, rommel weigeren, oude stops opruimen", async () => {
  await seed("trip", "/plek/oud", "oud", HOUR);
  await seed("trip", "/plek/al", "al", HOUR);
  await dispatch("message", { data: { type: "bewaar-plekken", paths: ["/plek/a", "/plek/al", "/admin", "https://x.nl/plek/b", "/plek/../x", 3] } });
  assert.deepEqual(fetched, ["/plek/a"], "alleen wat nog niet (vers) bewaard is");
  const trip = await caches.open(`${VERSION}-trip`);
  assert.deepEqual(trip.entries.map((e) => e.url.pathname).sort(), ["/plek/a", "/plek/al"]);
});

test("activeren ruimt caches van oudere versies op", async () => {
  await caches.open("vs-4-pages");
  await caches.open(`${VERSION}-pages`);
  await dispatch("activate", {});
  assert.deepEqual(await caches.keys(), [`${VERSION}-pages`]);
});
