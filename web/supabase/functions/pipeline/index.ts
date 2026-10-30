// VrijStaan data-pipeline (Supabase Edge Function, Deno)
//
//   { "action": "parse", "region": "NL-GE", "places_req": 1, "points_req": 2 }
//       → Overpass-antwoorden verwerken die de database via pg_net heeft opgehaald (standaardroute)
//   { "action": "osm", "region": "NL-GE" }  → Overpass rechtstreeks (handmatig; edge-IP's worden soms geweigerd)
//   { "action": "scrape", "n": 6 }          → volgende batch websites
//   { "action": "enqueue" }                 → plekken met website in de scrape-wachtrij
//   { "action": "inspect", "url": "…" }     → diagnose: gekozen pagina's en vertrekzinnen (schrijft niets)
//   { "action": "adres", "n": 40 }          → straat en postcode aanvullen via PDOK (pdok.ts)
//   { "action": "stealth_batch" | "stealth_plan" | "stealth_deeper" | "stealth_apply", … }
//       → stealth-lezer (tools/stealth-lezer, Scrapling): die haalt op, deze functie kiest en leest uit (stealth.ts)
//   { "action": "merge_master", "lists": [[…], […]], "dry_run": true }
//       → lijsten uit tools/data-collectors ontdubbelen en in geo_master zetten (merge_master.ts); eerste lijst wint
//   { "action": "promote", "dry_run": false, "n": 500 }
//       → geo_master naar places volgens de bronregels (promote_geo_master); zonder "dry_run": false alleen een proef
//
// Beveiliging: header `x-pipeline-key` moet gelijk zijn aan internal_secrets.pipeline_key. Sommige acties mogen ook met
// een GitHub-OIDC-token (header `x-github-oidc`) van precies één workflow op main: stealth_* van stealth-lezer.yml,
// merge_master en promote van data_pipeline.yml (workflowForAction in stealth.ts).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { decodeEntities, extract } from "./extract.ts";
import { mapOsm, placesQuery, pointsQuery, REGIONS } from "./osm.ts";
import { runMergeMaster, type MasterDb } from "./merge_master.ts";
import { addressFrom, reverseUrl } from "./pdok.ts";
import { verify, type QuoteAnswer } from "./quote.ts";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.9.6";
import { OIDC_AUDIENCE, OIDC_ISSUER, stealthDeeper, stealthMayWipe, stealthPages, stealthPlan, workflowClaimsOk, workflowForAction } from "./stealth.ts";
import { addExtraPages, decodeHtml, emptySite, deeperLinks, homeCandidates, sameSite, extractLinks, needsSitemap, onePage, parseSitemap, pdfLinks, rankLinks, sitemapsFromRobots } from "./pages.ts";

// Supabase edge runtime: werk na het antwoord laten doorlopen
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// Versie van de extractor. Vond een oudere versie een kernveld dat deze niet meer vindt, dan wist apply_scrape het: zo
// verdwijnen fouten van een oude parser na een volledige run. Ophogen bij elke wijziging in extract.ts.
const PARSER = "43";

const UA = "VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)";
const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

async function log(level: string, message: string, context: Record<string, unknown> = {}) {
  const { error } = await db.from("app_logs").insert({ level, source: "pipeline", message: message.slice(0, 2000), context });
  // Kan de log zelf niet weg, dan in elk geval in de functielogs van Supabase
  if (error) console.error(`app_logs: ${error.message}; ${level}: ${message}`);
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
const sitemapCache = new Map<string, string[]>();

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
        const robots = await res.text();
        sitemapCache.set(url.host, sitemapsFromRobots(robots));
        for (const raw of robots.split(/\r?\n/)) {
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

/**
 * Subpagina's van één site: hoogstens 3 tegelijk, en bij een fout (geen 404) na een korte pauze nog één poging.
 * Tot 11 verzoeken tegelijk naar dezelfde server werd door veel kleine sites en hostingpartijen geblokkeerd, waardoor
 * alleen de homepage binnenkwam en de pagina met de vertrektijd ontbrak.
 */
/** Subpagina's ophalen. Een pagina die ook na een tweede poging niet lukt (geen 404) komt in `failed`: dan haperde de
 *  site, en mag apply_scrape niets wissen wat deze keer ontbreekt. */
async function fetchPages(hrefs: string[], failed: string[] = []): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(hrefs.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < hrefs.length) {
      const i = next++;
      const url = new URL(hrefs[i]);
      try {
        out[i] = await fetchPage(url);
      } catch (e) {
        if (/HTTP 4(04|10)/.test(String(e))) continue;
        await new Promise((r) => setTimeout(r, 800));
        out[i] = await fetchPage(url).catch((e2) => {
          if (!/HTTP 4(04|10)/.test(String(e2))) failed.push(hrefs[i]);
          return null;
        });
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

async function fetchPage(url: URL, accept: "html" | "xml" = "html", timeout = 9000): Promise<string | null> {
  if (!/^https?:$/.test(url.protocol)) return null;
  if (!(await allowed(url))) return null;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "nl,en;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (accept === "html" ? !type.includes("html") : !/xml|text\/plain/.test(type)) return null;
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
  return decodeHtml(concat(chunks), type);
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

/** Pagina-adressen uit de sitemap (robots.txt of /sitemap.xml), hoogstens twee niveaus diep */
async function sitemapPages(home: URL): Promise<{ url: string; text: string }[]> {
  const queue = [...(sitemapCache.get(home.host) ?? []), `${home.origin}/sitemap.xml`];
  const pages: string[] = [];
  for (let i = 0; i < queue.length && i < 4 && pages.length < 500; i++) {
    // "Sitemap: /sitemap.xml" in robots.txt is relatief; een kapot adres mag de plek niet laten mislukken
    let url: URL;
    try {
      url = new URL(queue[i], home);
    } catch {
      continue;
    }
    const xml = await fetchPage(url, "xml").catch(() => null);
    if (!xml) continue;
    const sm = parseSitemap(xml);
    pages.push(...sm.pages);
    // Bij een index eerst de sitemaps met pagina's (niet die met berichten of producten)
    queue.push(...sm.sitemaps.sort((a, b) => Number(/page|pagina/i.test(b)) - Number(/page|pagina/i.test(a))));
  }
  return pages.map((url) => ({ url, text: "" }));
}

/** Tekst uit een PDF (reglement, tarieven), als eenvoudige HTML zodat de extractor hem net zo leest als een pagina */
async function fetchPdf(url: URL): Promise<string | null> {
  if (!(await allowed(url))) return null;
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(12000) });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) return null;
  return pdfHtml(new Uint8Array(await res.arrayBuffer()));
}

async function pdfHtml(buf: Uint8Array): Promise<string | null> {
  if (buf.length > 3_000_000) return null;
  const { extractText, getDocumentProxy } = await import("npm:unpdf@1.8.1");
  const { text } = await extractText(await getDocumentProxy(buf), { mergePages: true });
  const t = String(text).slice(0, 60_000).replace(/[<>&]/g, " ");
  return t.trim() ? `<html><body><p>${t}</p></body></html>` : null;
}

/** De startpagina, met terugval (zie homeCandidates); bij een time-out één keer opnieuw met meer tijd */
async function fetchHome(website: string): Promise<{ home: URL; html: string }> {
  let first: unknown;
  for (const [n, href] of homeCandidates(website).entries()) {
    const url = new URL(href);
    // Alleen het eigen adres krijgt een tweede, langere poging; de terugvaladressen één korte
    for (const timeout of n === 0 ? [9000, 15000] : [7000]) {
      try {
        const html = await fetchPage(url, "html", timeout);
        if (html) return { home: url, html };
        first ??= new Error("Geen HTML of geblokkeerd door robots.txt");
        break;
      } catch (e) {
        first ??= e;
        if (!(e instanceof DOMException && e.name === "TimeoutError")) break;
      }
    }
  }
  throw first;
}

async function collectPages(website: string) {
  const { home, html } = await fetchHome(website);
  const links = extractLinks(html, home);
  let picked = rankLinks(links, home);
  // Site van één pagina (menu met "#prijzen"): de sitemap proberen mag, maar de tien vaste adressen raden is zinloos
  const single = onePage(html) && links.length <= 2;
  // Menu in JavaScript (geen bruikbare links)? Dan de sitemap erbij, en anders vaste adressen proberen. Dit beoordeelt
  // alleen de herkende pagina's: de kleine-site-regel hieronder mag de sitemap en de vaste adressen niet overslaan
  // (parser 42, eerste versie: 21 plekken raakten daardoor hun vertrektijd kwijt)
  const viaSitemap = needsSitemap(picked);
  if (viaSitemap) picked = rankLinks([...links, ...(await sitemapPages(home))], home);
  picked = addExtraPages(picked, links, home, needsSitemap(picked), single);
  const failed: string[] = [];
  const subs = await fetchPages(picked, failed);
  const read = subs.filter((x): x is string => !!x);
  // Tweede laag: vanaf de FAQ en huisregels de links die naar aankomst en vertrek wijzen
  const deeper = deeperLinks([html, ...read], home, [home.href, ...picked]);
  const more = await fetchPages(deeper, failed);
  // PDF's met het reglement of de tarieven: alleen de adressen; lezen gebeurt pas als de pagina's niets opleveren
  const pdfs = [...new Set([html, ...read].flatMap((h) => pdfLinks(h, home)))].slice(0, 2);
  return { home, html, links: links.length, picked: [...picked, ...deeper], pdfs, viaSitemap, subs: [...subs, ...more], failed };
}

const pageText = (pages: string[]) =>
  pages
    .join(" ")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

// Zoekagenten (handmatige multi-agentronde): een agent levert per plek een letterlijke zin en de bron-URL. We halen die
// URL hier zelf op en nemen het alleen over als de zin er echt staat (zie quote.ts). Van de eigen
// website wordt het een kandidaat (zoals de scraper); van een andere bron (gids, review, forum) alleen een inzending
// voor Beheer, want daar is het een aanwijzing, geen feit.
type Finding = { id: string; url: string; departure: QuoteAnswer["departure"]; checkout: string | null; quote: string | null };

async function verifyFinding(f: Finding) {
  const url = new URL(f.url);
  const raw = /\.pdf($|\?)/i.test(url.pathname) ? await fetchPdf(url) : await fetchPage(url);
  if (!raw) return { id: f.id, ok: false, reason: "pagina niet te lezen" };
  const fields = verify({ departure: f.departure, checkout: f.checkout, quote: f.quote }, decodeEntities(pageText([raw])));
  if (!fields) return { id: f.id, ok: false, reason: "zin niet letterlijk op de pagina of zonder tijd" };
  const { data: place } = await db.from("places").select("website, departure, sources").eq("id", f.id).single();
  if (!place) return { id: f.id, ok: false, reason: "plek onbekend" };
  const quote = String(fields.times_note);
  let own = false;
  try {
    own = !!place.website && sameSite(new URL(place.website).host, url.host);
  } catch {
    own = false;
  }
  // sources.beheer is een lijst met velden die Beheer heeft vastgezet (oudere rijen: een object)
  const beheer = place.sources?.beheer;
  const managed = Array.isArray(beheer) ? beheer.includes("departure") : !!beheer?.departure;
  if (own && place.departure === null && !managed) {
    const { error } = await db
      .from("places")
      .update({ ...fields, times_note: `${quote} (bron: ${url.href})`.slice(0, 480) })
      .eq("id", f.id)
      .is("departure", null);
    if (error) throw error;
    return { id: f.id, ok: true, applied: "kandidaat" };
  }
  const { error } = await db.from("submissions").insert({
    kind: "correctie",
    place_id: f.id,
    contact_name: "Zoekagent (automatisch)",
    payload: {
      veld: "vertrektijd",
      voorstel: fields.departure === "vast" ? `vast, uiterlijk ${fields.checkout_until}` : String(fields.departure),
      citaat: quote,
      bron: url.href,
      toelichting: own
        ? "Gevonden op de eigen website, maar de plek heeft al een vertrekregel: vergelijk beide."
        : "Gevonden buiten de eigen website (gids, review of forum). Controleer bij de plek zelf voordat je iets overneemt.",
    },
  });
  if (error) throw error;
  return { id: f.id, ok: true, applied: "inzending" };
}

async function scrapeOne(place: { id: string; website: string }) {
  const { home, html, subs, pdfs, failed, links } = await collectPages(place.website);
  const pages = [html];
  for (const sub of subs) if (sub) pages.push(sub);
  return extractAll(pages, home, () => Promise.all(pdfs.map((href) => fetchPdf(new URL(href)).catch(() => null))), failed.length, links);
}

/** Uitlezen zoals de scraper dat doet, ook voor pagina's die de stealth-lezer aanlevert */
async function extractAll(pages: string[], home: URL, loadPdfs: () => Promise<(string | null)[]>, failed: number, links: number) {
  let data = extract(pages, home) as Record<string, unknown> & { fields?: string[] };
  // Geen vertrektijd op de pagina's? Dan de PDF's (reglement, tarieven) erbij; dat kost meer rekentijd
  if (data.departure === undefined) {
    const extra = (await loadPdfs()).filter((x): x is string => !!x);
    if (extra.length) {
      pages.push(...extra);
      data = extract(pages, home) as typeof data;
    }
  }
  // Haperende site: apply_scrape wist dan niets wat deze keer ontbreekt
  if (failed) data._pages_failed = failed;
  else if (emptySite(links, data.fields?.length ?? 0)) data._pages_failed = 1;
  data._parser = PARSER;
  return data;
}

// ── Stealth-lezer (bronnenbeleid §3a) ──────────────────────────────────────

const homeUrl = (v: unknown) => {
  const u = new URL(String(v));
  if (!/^https?:$/.test(u.protocol)) throw new Error("Alleen http(s)");
  return u;
};

function b64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const githubKeys = createRemoteJWKSet(new URL(`${OIDC_ISSUER}/.well-known/jwks`));

/** Komt dit verzoek van de stealth-workflow op main? Handtekening, uitgever, publiek en vervaldatum via jose. */
async function fromWorkflow(token: string | null, file: string) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, githubKeys, { issuer: OIDC_ISSUER, audience: OIDC_AUDIENCE });
    return workflowClaimsOk(payload as Record<string, unknown>, file);
  } catch {
    return false;
  }
}

async function stealthApply(body: Record<string, unknown>) {
  const id = String(body.id);
  if (body.error) {
    const { error } = await db.rpc("apply_stealth", { p_id: id, p_data: {}, p_error: String(body.error).slice(0, 300) });
    if (error) throw new Error(`apply_stealth: ${error.message}`);
    return { id, ok: false };
  }
  const home = homeUrl(body.home);
  const pages = stealthPages(body.pages);
  if (!pages.length) throw new Error("Geen pagina's");
  const pdfs = Array.isArray(body.pdfs) ? (body.pdfs as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 2) : [];
  const data = await extractAll(
    pages,
    home,
    () => Promise.all(pdfs.map((x) => pdfHtml(b64(x)).catch(() => null))),
    Number(body.failed) || 0,
    Number(body.links) || 0,
  );
  if (!stealthMayWipe(pages.length, data.fields?.length ?? 0)) data._pages_failed ??= 1;
  const meta = { robots_disallows: body.robots_disallows === true, pages: pages.length, proxy: body.proxy === true };
  const { error } = await db.rpc("apply_stealth", { p_id: id, p_data: data, p_error: null, p_meta: meta });
  if (error) throw new Error(`apply_stealth: ${error.message}`);
  return { id, ok: true, fields: data.fields ?? [] };
}

/** Diagnose (alleen lezen): welke pagina's kiest de scraper en welke zinnen over vertrekken staan erop */
// Diagnose per veld: zinnen rond deze woorden, om te zien welke formuleringen de extractor mist
const INSPECT_TERMS: Record<string, RegExp> = {
  lengte: /lengte|meter lang|\d ?m(eter)?\b.{0,20}(camper|lang)|max(imaal|\.)? ?\d/gi,
  plekken: /\d{1,3} (camper|kampeer|stand|staan|plaats|plek)/gi,
  honden: /hond|huisdier/gi,
  water: /water/gi,
  reserveren: /reserve|boek/gi,
  seizoen: /seizoen|geopend|jaarrond|hele jaar|gesloten/gi,
  prijs: /€|euro|tarie|prijs/gi,
};

async function inspect(website: string, field?: string) {
  const c = await collectPages(website);
  const pdfTexts = await Promise.all(c.pdfs.map((href) => fetchPdf(new URL(href)).catch(() => null)));
  const pages = [c.html, ...c.subs.filter((x): x is string => !!x), ...pdfTexts.filter((x): x is string => !!x)];
  const text = pages.join(" ").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const term = field && INSPECT_TERMS[field] ? INSPECT_TERMS[field].source : "vertrek|uitcheck|check-?out|abreise|per 24 uur|24 uur";
  const snippets = [...text.matchAll(new RegExp(`[^.]{0,90}(${term})[^.]{0,90}`, "gi"))].slice(0, 8).map((m) => m[0].trim());
  const data = extract(pages, c.home) as Record<string, unknown>;
  return {
    links: c.links, viaSitemap: c.viaSitemap, picked: c.picked, fetched: c.subs.map((x) => !!x),
    departure: data.departure ?? null, checkout: data.checkout_until ?? null, pdfs: c.pdfs, snippets,
    ...(field ? { fields: Object.fromEntries(Object.entries(data).filter(([k]) => !["description", "photos", "times_note"].includes(k))) } : {}),
  };
}

/** Straat en postcode aanvullen via PDOK voor plekken zonder adres (zie pdok.ts); ook "niets gevonden" wordt vastgelegd */
async function runAdres(n: number) {
  const { data: batch, error } = await db.rpc("next_pdok_batch", { p_limit: n });
  if (error) throw error;
  const results = await Promise.all(
    (batch ?? []).map(async (p: { id: string; lat: number; lng: number }) => {
      try {
        const res = await fetch(reverseUrl(p.lat, p.lng), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const a = addressFrom((await res.json()).response?.docs?.[0]);
        const { error } = await db.rpc("apply_pdok", {
          p_id: p.id,
          p_street: a?.street ?? null,
          p_postcode: a?.postcode ?? null,
          p_afstand: a?.afstand ?? null,
        });
        if (error) throw new Error(`apply_pdok: ${error.message}`);
        return { id: p.id, found: !!a };
      } catch (e) {
        // Niet vastgelegd, dus de volgende ronde probeert het opnieuw
        await log("warn", `PDOK-adres ${p.id}: ${e}`);
        return { id: p.id, error: String(e).slice(0, 120) };
      }
    }),
  );
  return { processed: results.length, found: results.filter((r) => "found" in r && r.found).length };
}

async function runScrape(n: number) {
  const { data: batch, error } = await db.rpc("next_scrape_batch", { p_limit: n });
  if (error) throw error;
  const results = await Promise.all(
    (batch ?? []).map(async (p: { id: string; website: string }) => {
      try {
        // Eén trage of dode site mag de batch niet ophouden (pg_net wacht op de traagste aanroep)
        const data = await Promise.race([
          scrapeOne(p),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Site te traag (45 s)")), 45_000)),
        ]);
        const { error } = await db.rpc("apply_scrape", { p_id: p.id, p_data: data });
        if (error) throw new Error(`apply_scrape: ${error.message}`);
        return { id: p.id, ok: true, fields: data.fields };
      } catch (e) {
        const { error } = await db.rpc("apply_scrape", { p_id: p.id, p_data: {}, p_error: String(e).slice(0, 300) });
        // Ook de foutregistratie mislukt: dan blijft de rij in de wachtrij hangen, dus in elk geval loggen
        if (error) await log("error", `apply_scrape (fout vastleggen) mislukt voor ${p.id}: ${error.message}`, { scrape: String(e).slice(0, 300) });
        return { id: p.id, ok: false, error: String(e).slice(0, 120) };
      }
    }),
  );
  return { processed: results.length, results };
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const key = req.headers.get("x-pipeline-key");
  const { data: secret } = key ? await db.from("internal_secrets").select("value").eq("name", "pipeline_key").single() : { data: null };
  const byKey = !!key && !!secret && key === secret.value;
  const workflow = workflowForAction(body.action);
  const byWorkflow = !byKey && workflow !== null && (await fromWorkflow(req.headers.get("x-github-oidc"), workflow));
  if (!byKey && !byWorkflow) return new Response("Forbidden", { status: 403 });

  try {
    let result: unknown;
    if (body.action === "osm") result = await runOsm(String(body.region));
    else if (body.action === "parse") result = await runParse(String(body.region), Number(body.places_req), Number(body.points_req));
    else if (body.action === "scrape" && body.background) {
      // Meteen antwoorden en op de achtergrond doorwerken: pg_net wacht dan niet op de traagste site van de batch, zodat
      // de workers het tempo bepalen. Fouten komen via apply_scrape in de wachtrij en via log() in app_logs.
      EdgeRuntime.waitUntil(runScrape(Math.min(8, Number(body.n) || 4)).catch((e) => log("error", `Pipeline-fout (scrape): ${e}`)));
      return Response.json({ started: true }, { status: 202 });
    } else if (body.action === "scrape") result = await runScrape(Math.min(8, Number(body.n) || 4));
    else if (body.action === "adres" && body.background) {
      EdgeRuntime.waitUntil(runAdres(Math.min(50, Number(body.n) || 20)).catch((e) => log("error", `Pipeline-fout (adres): ${e}`)));
      return Response.json({ started: true }, { status: 202 });
    } else if (body.action === "adres") result = await runAdres(Math.min(50, Number(body.n) || 20));
    else if (body.action === "probe")
      result = await overpass('[out:json][timeout:25];node["tourism"="caravan_site"](52.0,5.0,52.2,5.3);out 3;').then(
        (e) => ({ ok: true, count: e.length }),
        (e) => ({ ok: false, error: String(e) }),
      );
    else if (body.action === "stealth_batch") {
      // Meerdere lezers tegelijk: elk een vast deel van de hosts (shard), zodat er per host maar één lezer is
      const shards = Math.min(10, Math.max(1, Number(body.shards) || 1));
      const limit = Math.min(20, Number(body.n) || 5);
      const { data, error } = shards > 1
        ? await db.rpc("next_stealth_batch", { p_limit: limit, p_shard: Math.min(shards - 1, Math.max(0, Number(body.shard) || 0)), p_shards: shards })
        : await db.rpc("next_stealth_batch", { p_limit: limit });
      if (error) throw error;
      result = data;
    } else if (body.action === "stealth_plan")
      result = stealthPlan(homeUrl(body.home), String(body.html ?? ""), Array.isArray(body.sitemaps) ? body.sitemaps.map(String) : []);
    else if (body.action === "stealth_deeper")
      result = stealthDeeper(homeUrl(body.home), stealthPages(body.pages), Array.isArray(body.seen) ? body.seen.map(String) : []);
    else if (body.action === "stealth_apply") result = await stealthApply(body);
    else if (body.action === "inspect") result = await inspect(String(body.url), body.field ? String(body.field) : undefined);
    else if (body.action === "verify")
      result = await Promise.all(
        (body.items as Finding[]).slice(0, 25).map((f) => verifyFinding(f).catch((e) => ({ id: f.id, ok: false, reason: String(e).slice(0, 120) }))),
      );
    else if (body.action === "merge_master") {
      if (!Array.isArray(body.lists) || !body.lists.every(Array.isArray)) return new Response("lists: lijst van lijsten", { status: 400 });
      result = await runMergeMaster(db as unknown as MasterDb, body.lists, { dryRun: body.dry_run === true });
    } else if (body.action === "promote") {
      // Veilig standaard: alleen met "dry_run": false wordt er echt in places geschreven
      const { data, error } = await db.rpc("promote_geo_master", {
        p_dry_run: body.dry_run !== false,
        p_limit: Math.min(5000, Math.max(1, Number(body.n) || 500)),
      });
      if (error) throw new Error(`promote_geo_master: ${error.message}`);
      result = data;
    } else if (body.action === "enqueue") {
      const { data, error } = await db.rpc("enqueue_scrape", { p_only_missing: body.all !== true });
      if (error) throw error;
      result = data;
    }
    else return new Response("Onbekende actie", { status: 400 });
    return Response.json(result);
  } catch (e) {
    await log("error", `Pipeline-fout (${body.action}): ${e}`);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
