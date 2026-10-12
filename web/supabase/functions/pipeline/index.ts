// VrijStaan data-pipeline (Supabase Edge Function, Deno)
//
//   { "action": "parse", "region": "NL-GE", "places_req": 1, "points_req": 2 }
//       → Overpass-antwoorden verwerken die de database via pg_net heeft opgehaald (standaardroute)
//   { "action": "osm", "region": "NL-GE" }  → Overpass rechtstreeks (handmatig; edge-IP's worden soms geweigerd)
//   { "action": "scrape", "n": 6 }          → volgende batch websites
//   { "action": "enqueue" }                 → plekken met website in de scrape-wachtrij
//   { "action": "discover", "n": 6 }        → websites zoeken voor plekken zonder website (zie discover.ts)
//
// Beveiliging: header `x-pipeline-key` moet gelijk zijn aan internal_secrets.pipeline_key.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { type Candidate, domains, matches } from "./discover.ts";
import { extract } from "./extract.ts";
import { mapOsm, placesQuery, pointsQuery, REGIONS } from "./osm.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const UA = "VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function log(level: string, message: string, context: Record<string, unknown> = {}) {
  await db.from("app_logs").insert({ level, source: "pipeline", message: message.slice(0, 2000), context });
}

async function overpass(query: string) {
  const errors: string[] = [];
  for (const url of OVERPASS) {
    try {
      const res = await fetch(`${url}?data=${encodeURIComponent(query)}`, {
        // Geen Accept-header: overpass-api.de antwoordt daarop met 406
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(115_000),
      });
      if (res.ok) return (await res.json()).elements as Record<string, unknown>[];
      errors.push(`${new URL(url).host}: HTTP ${res.status} ${(await res.text()).slice(0, 160).replace(/\s+/g, " ")}`);
    } catch (e) {
      errors.push(`${new URL(url).host}: ${e}`);
    }
  }
  throw new Error(errors.join(" | "));
}

type Element = Record<string, unknown>;

/** OSM-elementen van één provincie in de wachtrij zetten (verwerking: pg_cron → process_osm_staging) */
async function stageOsm(region: string, elements: Element[], pointElements: Element[]) {
  const province = REGIONS[region];
  if (!province) throw new Error(`Onbekende regio ${region}`);
  const { data: run } = await db.from("ingest_runs").insert({ kind: `osm ${region}` }).select("id").single();
  try {
    const rows = elements.map(mapOsm).filter(Boolean).map((r) => ({ ...r, province }));
    const points = pointElements.map((e) => ({
      lat: e.lat ?? (e.center as { lat: number })?.lat,
      lng: e.lon ?? (e.center as { lon: number })?.lon,
      type: (e.tags as Record<string, string>)?.amenity === "sanitary_dump_station" ? "dump" : "water",
      water: (e.tags as Record<string, string>)?.water_point === "yes",
    }));
    const staged = [...rows.map((row) => ({ kind: "place", row })), ...points.map((row) => ({ kind: "point", row }))];
    for (let i = 0; i < staged.length; i += 1000) {
      const { error } = await db.from("osm_staging").insert(staged.slice(i, i + 1000));
      if (error) throw error;
    }
    const stats = { region, elements: elements.length, places: rows.length, service_points: points.length };
    await db.from("ingest_runs").update({ status: "ok", finished_at: new Date().toISOString(), stats }).eq("id", run!.id);
    await log("info", `OSM ${province}: ${rows.length} plekken en ${points.length} servicepunten in de wachtrij`, stats);
    return stats;
  } catch (e) {
    await db.from("ingest_runs").update({ status: "error", finished_at: new Date().toISOString(), stats: { error: String(e) } }).eq("id", run!.id);
    await log("error", `OSM-import ${province} mislukt: ${e}`);
    throw e;
  }
}

/** Overpass-antwoorden die de database zelf heeft opgehaald (pg_net) verwerken */
async function runParse(region: string, placesReq: number, pointsReq: number) {
  const [a, b] = await Promise.all([
    db.rpc("osm_response", { p_id: placesReq }),
    db.rpc("osm_response", { p_id: pointsReq }),
  ]);
  if (a.error || b.error || !a.data || !b.data) throw new Error(`Overpass-antwoord niet gevonden (${a.error?.message ?? b.error?.message ?? "leeg"})`);
  return stageOsm(region, JSON.parse(a.data).elements, JSON.parse(b.data).elements);
}

/** Rechtstreeks via Overpass (handmatig, als de database-route niet beschikbaar is) */
async function runOsm(region: string) {
  return stageOsm(region, await overpass(placesQuery(region)), await overpass(pointsQuery(region)));
}

// ── Scraper ────────────────────────────────────────────────────────────────

const robotsCache = new Map<string, string[]>();

async function allowed(url: URL): Promise<boolean> {
  if (!robotsCache.has(url.host)) {
    let disallow: string[] = [];
    try {
      const res = await fetch(`${url.protocol}//${url.host}/robots.txt`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        let applies = false;
        for (const raw of (await res.text()).split(/\r?\n/)) {
          const line = raw.split("#")[0].trim();
          const [k, ...rest] = line.split(":");
          const v = rest.join(":").trim();
          if (/^user-agent$/i.test(k)) applies = v === "*" || /vrijstaan/i.test(v);
          else if (applies && /^disallow$/i.test(k) && v) disallow.push(v);
        }
      }
    } catch {
      disallow = [];
    }
    robotsCache.set(url.host, disallow);
  }
  return !robotsCache.get(url.host)!.some((p) => url.pathname.startsWith(p));
}

async function fetchPage(url: URL, timeout = 9000): Promise<string | null> {
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!(await allowed(url))) return null;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "nl,en;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;
  const charset = /charset=([\w-]+)/i.exec(type)?.[1] ?? "utf-8";
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < 1_200_000) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => {});
  try {
    return new TextDecoder(charset).decode(concat(chunks));
  } catch {
    return new TextDecoder().decode(concat(chunks));
  }
}

function concat(chunks: Uint8Array[]) {
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

// Subpagina's met de meeste kans op prijzen, voorzieningen en seizoen (hoogste prioriteit eerst)
const SUBPAGES: RegExp[] = [
  /tarie|prijs|prijzen|kosten|preise|tarife|prices|rates/i,
  /camper|stellplatz|motorhome|wohnmobil/i,
  /aankomst|vertrek|check-?in|check-?out|inchecken|huisregel|reglement|regels|praktisch|faq|veelgestelde|vragen|anreise|platzordnung/i,
  /faciliteit|voorzien|ausstattung|facilities|sanitair/i,
  /info|openingstijden|seizoen/i,
  /over-ons|contact|ueber-uns|about/i,
];

async function scrapeOne(place: { id: string; website: string }) {
  const home = new URL(place.website);
  const html = await fetchPage(home);
  if (!html) throw new Error("Geen HTML of geblokkeerd door robots.txt");
  const pages = [html];
  const links = [
    ...new Set(
      [...html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["']/gi)]
        .map((m) => {
          try {
            return new URL(m[1], home);
          } catch {
            return null;
          }
        })
        .filter((u): u is URL => !!u && u.host === home.host && u.pathname !== home.pathname && !/\.(pdf|jpe?g|png|zip)$/i.test(u.pathname))
        .map((u) => u.origin + u.pathname),
    ),
  ];
  // Hoogstens twee pagina's per soort, zodat ook de huisregels (aankomst- en vertrektijden) aan bod komen
  const perRank = new Map<number, number>();
  const ranked = links
    .map((href) => ({ href, rank: SUBPAGES.findIndex((re) => re.test(new URL(href).pathname)) }))
    .filter((l) => l.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.href.length - b.href.length)
    .filter((l) => {
      const n = perRank.get(l.rank) ?? 0;
      perRank.set(l.rank, n + 1);
      return n < 2;
    })
    .slice(0, 6);
  const subs = await Promise.all(ranked.map((l) => fetchPage(new URL(l.href)).catch(() => null)));
  for (const sub of subs) if (sub) pages.push(sub);
  return extract(pages, home);
}

async function runScrape(n: number) {
  const { data: batch, error } = await db.rpc("next_scrape_batch", { p_limit: n });
  if (error) throw error;
  const results = await Promise.all(
    (batch ?? []).map(async (p: { id: string; website: string }) => {
      try {
        const data = await scrapeOne(p);
        await db.rpc("apply_scrape", { p_id: p.id, p_data: data });
        return { id: p.id, ok: true, fields: data.fields };
      } catch (e) {
        await db.rpc("apply_scrape", { p_id: p.id, p_data: {}, p_error: String(e).slice(0, 300) });
        return { id: p.id, ok: false, error: String(e).slice(0, 120) };
      }
    }),
  );
  return { processed: results.length, results };
}

// ── Websites zoeken ────────────────────────────────────────────────────────

async function discoverOne(c: Candidate): Promise<string | null> {
  for (const d of domains(c.name, c.town)) {
    // www en zonder www tegelijk; de eerste die past wint
    const tries = await Promise.all(
      [`https://www.${d}/`, `https://${d}/`].map(async (u) => {
        try {
          const html = await fetchPage(new URL(u), 6000);
          return html && matches(c, html) ? u : null;
        } catch {
          return null;
        }
      }),
    );
    const hit = tries.find(Boolean);
    if (hit) return hit;
  }
  return null;
}

async function runDiscover(n: number) {
  const { data: batch, error } = await db.rpc("next_discover_batch", { p_limit: n });
  if (error) throw error;
  const results = await Promise.all(
    (batch ?? []).map(async (c: Candidate) => {
      const url = await discoverOne(c).catch(() => null);
      await db.rpc("apply_discovery", { p_id: c.id, p_url: url });
      return { id: c.id, name: c.name, url };
    }),
  );
  const found = results.filter((r) => r.url);
  if (found.length) await log("info", `Websites gevonden: ${found.map((r) => `${r.name} → ${r.url}`).join("; ")}`.slice(0, 2000));
  return { processed: results.length, found: found.length, results };
}

Deno.serve(async (req) => {
  const key = req.headers.get("x-pipeline-key");
  const { data: secret } = await db.from("internal_secrets").select("value").eq("name", "pipeline_key").single();
  if (!key || !secret || key !== secret.value) return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => ({}));
  try {
    let result: unknown;
    if (body.action === "osm") result = await runOsm(String(body.region));
    else if (body.action === "parse") result = await runParse(String(body.region), Number(body.places_req), Number(body.points_req));
    else if (body.action === "scrape") result = await runScrape(Math.min(8, Number(body.n) || 4));
    else if (body.action === "discover") result = await runDiscover(Math.min(8, Number(body.n) || 4));
    else if (body.action === "probe")
      result = await overpass('[out:json][timeout:25];node["tourism"="caravan_site"](52.0,5.0,52.2,5.3);out 3;').then(
        (e) => ({ ok: true, count: e.length }),
        (e) => ({ ok: false, error: String(e) }),
      );
    else if (body.action === "enqueue") result = (await db.rpc("enqueue_scrape", { p_only_missing: body.all !== true })).data;
    else return new Response("Onbekende actie", { status: 400 });
    return Response.json(result);
  } catch (e) {
    await log("error", `Pipeline-fout (${body.action}): ${e}`);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
