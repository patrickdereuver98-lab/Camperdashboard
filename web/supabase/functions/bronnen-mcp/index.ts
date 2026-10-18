// MCP-server "vrijstaan-bronnen" (dataplan W0.6): de gedeelde ingang voor alle sessies die bronnen lezen.
//
// Sessies pakken werk, laten de server pagina's ophalen (robots.txt, wachttijd per host, alleen openbare adressen),
// en leveren claims met een letterlijk citaat. De database controleert elk citaat tegen de opgeslagen pagina en
// beslist met één regel (bron.decisions). Niets hier schrijft in public.places.
//
// Protocol: MCP via Streamable HTTP, zonder sessiestatus (JSON-antwoord op elke POST).
// Toegang: sleutel BRONNEN_MCP_KEY (edge-secret), als "Authorization: Bearer <sleutel>" of als laatste deel van het
// adres (…/functions/v1/bronnen-mcp/<sleutel>) voor clients die geen headers kunnen meesturen. Een sleutel in het
// adres kan in logs belanden: header heeft de voorkeur, en vervang de sleutel als hij is gedeeld.
// Uitrollen: zonder JWT-controle (de functie controleert zelf de sleutel).

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  cleanSearch, distanceM, FIELDS, filterLines, htmlToText, isPrivateIp, parseRobots, publicUrl, robotsAllows,
  robotsBlocksAll, safeEqual, UA,
} from "./lib.ts";

const VERSION = "0.2.0";
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]; // MCP-protocolversies die deze server spreekt
const KEY = Deno.env.get("BRONNEN_MCP_KEY") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const INSTRUCTIONS = `Werkwijze VrijStaan-bronnen (lees docs/bronnenbeleid.md in de repo):
1. Pak werk met volgend_werk, of werk aan een plek die je met plekken_zoeken vindt.
2. Laat pagina's ophalen met pagina_ophalen; alleen als de server een pagina niet kan lezen gebruik je tekst_insturen.
3. Lever feiten met claims_insturen: elk citaat moet letterlijk in het document staan. Verzin niets; onbekend blijft leeg.
4. Reviews en fora: één claim per vermelding, met mention_ref (post- of reviewnummer) en observed_on (datum van de vermelding). Geen namen of reviewteksten opslaan buiten het citaat.
5. Nieuwe plekken lever je met kandidaten_insturen; de server koppelt ze aan bestaande plekken.
6. Rond werk af met werk_afronden. Krijg je een 403, 429, captcha of inlogmuur: stop, en meld de bron met bron_blokkeren.`;

// ── Hulpjes ────────────────────────────────────────────────────────────────────────────────────────────────────

class ToolError extends Error {}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new ToolError(error.message);
  return data as T;
}

function str(a: Record<string, unknown>, k: string, required = true, max = 2000): string | undefined {
  const v = a[k];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolError(`${k} ontbreekt`);
    return undefined;
  }
  if (typeof v !== "string") throw new ToolError(`${k} moet tekst zijn`);
  return v.slice(0, max);
}

function agentOf(a: Record<string, unknown>): string {
  const v = str(a, "agent")!;
  if (!/^[\w .:@-]{2,80}$/.test(v)) throw new ToolError("agent: 2 tot 80 tekens, letters, cijfers en . : @ -");
  return v;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Veilig ophalen ─────────────────────────────────────────────────────────────────────────────────────────────

/** Wijst de hostnaam alleen naar openbare adressen? (tegen namen als 127.0.0.1.nip.io) */
async function hostIsPublic(host: string): Promise<boolean> {
  const ips: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      ips.push(...(await Deno.resolveDns(host, type)));
    } catch {
      // geen records van dit type
    }
  }
  return ips.length > 0 && ips.every((ip) => !isPrivateIp(ip));
}

/** Eén verzoek zonder automatische doorverwijzing, na controle van adres en DNS. */
async function oneFetch(u: URL, accept: string, timeout: number): Promise<Response> {
  if (!publicUrl(u.href)) throw new ToolError("Alleen openbare http(s)-adressen");
  if (!(await hostIsPublic(u.hostname))) throw new ToolError(`${u.hostname} wijst niet naar een openbaar adres`);
  return await fetch(u, {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "nl,en;q=0.5" },
    redirect: "manual",
    signal: AbortSignal.timeout(timeout),
  });
}

const sameSite = (a: URL, b: URL) => a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

// ── robots.txt ─────────────────────────────────────────────────────────────────────────────────────────────────

const robotsCache = new Map<string, { at: number; rules: ReturnType<typeof parseRobots> | "dicht" }>();

async function robotsFor(u: URL) {
  const hit = robotsCache.get(u.host);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.rules;
  let rules: ReturnType<typeof parseRobots> | "dicht" = "dicht";
  try {
    // RFC 9309: maximaal 5 doorverwijzingen volgen, elk adres opnieuw gecontroleerd.
    let url = new URL(`${u.protocol}//${u.host}/robots.txt`);
    for (let hop = 0; hop <= 5; hop++) {
      const res = await oneFetch(url, "text/plain", 6000);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        res.body?.cancel();
        url = new URL(loc, url);
        continue;
      }
      if (res.ok) rules = parseRobots((await res.text()).slice(0, 500_000));
      else if (res.status >= 400 && res.status < 500 && res.status !== 429) rules = []; // geen robots.txt = alles mag
      else res.body?.cancel(); // 5xx of 429: voorlopig niet
      break;
    }
  } catch (e) {
    if (e instanceof ToolError) throw e; // adres of DNS niet openbaar: dat is geen tijdelijke storing
    rules = "dicht";
  }
  robotsCache.set(u.host, { at: Date.now(), rules });
  return rules;
}

async function checkRobots(u: URL, src: Source) {
  const rules = await robotsFor(u);
  if (rules === "dicht") throw new ToolError(`robots.txt van ${u.host} is nu niet bereikbaar; probeer het later`);
  if (robotsBlocksAll(rules)) {
    await rpc("bron_set_robots", { p_source: src.source_id, p_ok: false, p_host: u.hostname });
    throw new ToolError(`robots.txt van ${u.host} sluit alle bots uit; niet gebruiken`);
  }
  if (!robotsAllows(rules, u.pathname + u.search)) throw new ToolError(`robots.txt staat ${u.pathname} niet toe`);
}

// ── Pagina ophalen ─────────────────────────────────────────────────────────────────────────────────────────────

type Source = { source_id: string; kind: string; tier: number; status: string; min_delay_s: number; host: string };

const MAX_TEXT = 60_000; // zoveel slaat de database op; citaten buiten dit stuk zouden toch geweigerd worden

async function fetchText(start: URL, src: Source): Promise<{ url: URL; status: number; text: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    const res = await oneFetch(url, "text/html,application/xhtml+xml,text/plain;q=0.8", 15000);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      res.body?.cancel();
      const next = publicUrl(new URL(loc, url).href);
      if (!next) throw new ToolError("Doorverwijzing naar een adres dat niet mag");
      // Naar een andere site: niet volgen, want bron, tier, robots.txt en wachttijd horen bij die andere site.
      if (!sameSite(next, start)) {
        throw new ToolError(`Doorverwijzing naar een andere site: ${next.href}. Haal dat adres apart op als het bruikbaar is.`);
      }
      await checkRobots(next, src);
      url = next;
      continue;
    }
    if (!res.ok) {
      res.body?.cancel();
      return { url, status: res.status, text: "" };
    }
    const type = res.headers.get("content-type") ?? "";
    if (!/html|text\/plain|xml/.test(type)) {
      res.body?.cancel();
      throw new ToolError(`Geen tekstpagina (${type || "onbekend type"}); PDF's volgen in W2.2`);
    }
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < 2_000_000) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    reader.cancel().catch(() => {});
    const bytes = new Uint8Array(size);
    let o = 0;
    for (const c of chunks) {
      bytes.set(c, o);
      o += c.length;
    }
    const charset = /charset=["']?([\w-]+)/i.exec(type)?.[1] ?? "utf-8";
    let raw: string;
    try {
      raw = new TextDecoder(charset).decode(bytes);
    } catch {
      raw = new TextDecoder().decode(bytes);
    }
    const text = /html|xml/.test(type) ? htmlToText(raw) : raw;
    return { url, status: res.status, text: text.slice(0, MAX_TEXT) };
  }
  throw new ToolError("Te veel doorverwijzingen");
}

async function paginaOphalen(a: Record<string, unknown>) {
  const agent = agentOf(a);
  const u = publicUrl(str(a, "url")!);
  if (!u) throw new ToolError("Alleen openbare http(s)-adressen");
  const placeId = str(a, "place_id", false, 40);
  const src = await rpc<Source>("bron_resolve_source", { p_url: u.href, p_kind: str(a, "soort_bron", false, 20) ?? null, p_place: placeId ?? null });
  if (src.status === "geblokkeerd") throw new ToolError(`Bron ${src.source_id} is geblokkeerd; gebruik deze bron niet`);

  await checkRobots(u, src);
  if (src.kind !== "eigen_site") await rpc("bron_set_robots", { p_source: src.source_id, p_ok: true, p_host: u.hostname });

  let wait = await rpc<number>("bron_fetch_slot", { p_host: u.hostname, p_source: src.source_id });
  if (wait > 0 && wait <= 20) {
    await sleep(wait * 1000);
    wait = await rpc<number>("bron_fetch_slot", { p_host: u.hostname, p_source: src.source_id });
  }
  if (wait > 0) throw new ToolError(`Te snel voor ${u.host}: probeer het over ${wait} seconden`);

  const page = await fetchText(u, src);
  if (page.status === 403 || page.status === 429) {
    throw new ToolError(`HTTP ${page.status} van ${u.host}: stop met deze bron en overweeg bron_blokkeren`);
  }
  if (!page.text.trim()) throw new ToolError(`Geen tekst op deze pagina (HTTP ${page.status})`);
  if (/captcha|cf-challenge|are you a robot|access denied/i.test(page.text.slice(0, 3000)) && page.text.length < 4000) {
    throw new ToolError("De pagina toont een captcha of blokkade; niet omzeilen");
  }

  const docId = await rpc<number>("bron_store_document", {
    p_source: src.source_id, p_url: page.url.href, p_place: placeId ?? null, p_fetched_by: "server",
    p_http_status: page.status, p_published_on: str(a, "gepubliceerd_op", false, 10) ?? null, p_text: page.text,
    p_agent: agent,
  });
  const words = Array.isArray(a.filter) ? (a.filter as unknown[]).filter((w): w is string => typeof w === "string") : [];
  const max = Math.min(Math.max(Number(a.max_tekens) || 20000, 1000), MAX_TEXT);
  const shown = filterLines(page.text, words, 2);
  return {
    document_id: docId, url: page.url.href, bron: src.source_id, soort: src.kind, tier: src.tier,
    tekens: page.text.length, ingekort: shown.length > max, tekst: shown.slice(0, max),
  };
}

// ── Plekken zoeken ─────────────────────────────────────────────────────────────────────────────────────────────

async function plekkenZoeken(a: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(a.limit) || 20, 1), 100);
  let q = db.from("places")
    .select("id,slug,name,kind,status,town,province,website,phone,lat,lng,departure,checkout_until,price_eur,last_scraped_at")
    .is("merged_into", null);
  const term = typeof a.q === "string" ? cleanSearch(a.q) : "";
  if (term) q = q.or(`name.ilike.%${term}%,town.ilike.%${term}%`);
  if (typeof a.provincie === "string") q = q.eq("province", a.provincie.slice(0, 40));
  if (typeof a.soort === "string") q = q.eq("kind", a.soort.slice(0, 20));
  if (typeof a.id === "string") q = q.eq("id", a.id.slice(0, 40));
  if (typeof a.zonder_veld === "string") {
    if (!(FIELDS as readonly string[]).includes(a.zonder_veld)) throw new ToolError("zonder_veld: onbekend veld");
    q = q.is(a.zonder_veld, null);
  }
  const lat = Number(a.lat), lng = Number(a.lng);
  const near = Number.isFinite(lat) && Number.isFinite(lng) && a.lat !== undefined && a.lng !== undefined;
  const radius = Math.min(Math.max(Number(a.straal_m) || 5000, 50), 50000);
  if (near) {
    const dLat = radius / 111_000, dLng = radius / (111_000 * Math.cos((lat * Math.PI) / 180));
    q = q.gte("lat", lat - dLat).lte("lat", lat + dLat).gte("lng", lng - dLng).lte("lng", lng + dLng);
  }
  const { data, error } = await q.limit(near ? 500 : limit);
  if (error) throw new ToolError(error.message);
  let rows = (data ?? []) as Array<Record<string, unknown> & { lat: number; lng: number }>;
  if (near) {
    rows = rows
      .map((r) => ({ ...r, afstand_m: Math.round(distanceM(lat, lng, r.lat, r.lng)) }))
      .filter((r) => r.afstand_m <= radius)
      .sort((x, y) => x.afstand_m - y.afstand_m)
      .slice(0, limit);
  }
  return { aantal: rows.length, plekken: rows };
}

// ── Tools ──────────────────────────────────────────────────────────────────────────────────────────────────────

const AGENT = { type: "string", description: "Naam van je sessie, bv. 'ontdek-drenthe-1' (steeds dezelfde)" };

const TOOLS = [
  {
    name: "status",
    description: "Stand van de bronnenlaag: bronnen, documenten, kandidaten, claims, besluiten en werk.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "volgend_werk",
    description: "Pak het volgende werkitem (lease van een uur). Geeft null als er niets open is.",
    inputSchema: {
      type: "object", required: ["agent"],
      properties: {
        agent: AGENT,
        soorten: { type: "array", items: { type: "string", enum: ["ontdek_gemeenten", "ontdek_jachthavens", "ontdek_boerderij", "ontdek_fora", "ontdek_directory", "aanvullen", "koppelen", "controle"] } },
      },
    },
  },
  {
    name: "werk_afronden",
    description: "Rond een werkitem af. Status 'open' geeft het terug zonder resultaat.",
    inputSchema: {
      type: "object", required: ["agent", "id", "status"],
      properties: {
        agent: AGENT, id: { type: "integer" },
        status: { type: "string", enum: ["klaar", "mislukt", "geblokkeerd", "open"] },
        notitie: { type: "string", description: "Wat je deed en wat je vond (max 4000 tekens)" },
        resultaat: { type: "object", description: "Bijvoorbeeld aantallen kandidaten en claims" },
      },
    },
  },
  {
    name: "plekken_zoeken",
    description: "Zoek bestaande plekken (alleen lezen): op naam of plaats, provincie, soort, rond een punt, of plekken waar een veld nog ontbreekt.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string" }, provincie: { type: "string" }, id: { type: "string" },
        soort: { type: "string", enum: ["camperplaats", "camping", "parkeerplaats", "boerderij", "jachthaven"] },
        lat: { type: "number" }, lng: { type: "number" }, straal_m: { type: "number" },
        zonder_veld: { type: "string", enum: [...FIELDS] }, limit: { type: "integer", maximum: 100 },
      },
    },
  },
  {
    name: "pagina_ophalen",
    description: "Laat de server een openbare pagina ophalen (robots.txt en wachttijd worden gerespecteerd) en bewaren. Geeft document_id en de tekst; gebruik 'filter' om alleen regels met bepaalde woorden terug te krijgen.",
    inputSchema: {
      type: "object", required: ["agent", "url"],
      properties: {
        agent: AGENT, url: { type: "string" },
        place_id: { type: "string", description: "Plek waar de pagina over gaat (nodig om de eigen site van een plek te herkennen)" },
        soort_bron: { type: "string", enum: ["directory", "forum", "reviews"], description: "Voor een onbekend domein" },
        gepubliceerd_op: { type: "string", description: "Datum van de pagina (JJJJ-MM-DD) als die bekend is" },
        filter: { type: "array", items: { type: "string" }, description: "Bv. ['vertrek','uur','€','prijs']" },
        max_tekens: { type: "integer", maximum: 60000 },
      },
    },
  },
  {
    name: "tekst_insturen",
    description: "Alleen als pagina_ophalen een openbare pagina niet kan lezen (JavaScript): stuur de tekst zelf in. Besluiten die alleen hierop steunen krijgen 'controle'.",
    inputSchema: {
      type: "object", required: ["agent", "url", "tekst"],
      properties: {
        agent: AGENT, url: { type: "string" }, tekst: { type: "string", description: "Letterlijke tekst van de pagina, max 60.000 tekens" },
        place_id: { type: "string" }, soort_bron: { type: "string", enum: ["directory", "forum", "reviews"] },
        gepubliceerd_op: { type: "string" },
      },
    },
  },
  {
    name: "claims_insturen",
    description: "Lever feiten uit één document. Elk citaat moet letterlijk in het document staan. Velden: " + FIELDS.join(", ") + ", gesloten. Tijden als 'uu:mm', departure als 'vrij', 'per24' of 'vast'.",
    inputSchema: {
      type: "object", required: ["agent", "document_id", "claims"],
      properties: {
        agent: AGENT, document_id: { type: "integer" },
        claims: {
          type: "array", maxItems: 100,
          items: {
            type: "object", required: ["field", "value", "evidence"],
            properties: {
              place_id: { type: "string" }, candidate_id: { type: "integer" },
              field: { type: "string" }, value: {}, evidence: { type: "string", description: "Letterlijke zin uit het document (3 tot 500 tekens)" },
              mention_ref: { type: "string", description: "Review- of postnummer: maakt van twee reviews op één pagina twee vermeldingen" },
              observed_on: { type: "string", description: "Datum van de vermelding (JJJJ-MM-DD)" },
            },
          },
        },
      },
    },
  },
  {
    name: "kandidaten_insturen",
    description: "Lever gevonden plekken. De server koppelt ze aan bestaande plekken (zelfde website, of dichtbij met een lijkende naam).",
    inputSchema: {
      type: "object", required: ["agent", "document_id", "kandidaten"],
      properties: {
        agent: AGENT, document_id: { type: "integer", description: "Document waarin je de plekken vond" },
        kandidaten: {
          type: "array", maxItems: 100,
          items: {
            type: "object", required: ["name"],
            properties: {
              name: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, town: { type: "string" },
              province: { type: "string" }, website: { type: "string" }, phone: { type: "string" },
              kind_hint: { type: "string", enum: ["camperplaats", "camping", "parkeerplaats", "boerderij", "jachthaven"] },
              external_ref: { type: "string", description: "Vaste verwijzing in de bron (id of pad)" },
            },
          },
        },
      },
    },
  },
  {
    name: "besluiten",
    description: "Wat de beslisregel nu zegt voor een plek, naast de huidige waarde in places (alleen lezen).",
    inputSchema: { type: "object", required: ["place_id"], properties: { place_id: { type: "string" } } },
  },
  {
    name: "bron_blokkeren",
    description: "Meld een bron als geblokkeerd (403, 429, captcha, inlogmuur of een verzoek om te stoppen). Openzetten doet een mens.",
    inputSchema: {
      type: "object", required: ["agent", "bron", "reden"],
      properties: { agent: AGENT, bron: { type: "string" }, reden: { type: "string" } },
    },
  },
];

async function callTool(name: string, a: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "status":
      return rpc("bron_overview", {});
    case "volgend_werk":
      return rpc("bron_lease_work", {
        p_agent: agentOf(a),
        p_kinds: Array.isArray(a.soorten) && a.soorten.length ? a.soorten : null,
      });
    case "werk_afronden":
      return rpc("bron_finish_work", {
        p_id: Number(a.id), p_agent: agentOf(a), p_status: str(a, "status")!,
        p_note: str(a, "notitie", false, 4000) ?? null, p_result: (a.resultaat as object) ?? null,
      });
    case "plekken_zoeken":
      return plekkenZoeken(a);
    case "pagina_ophalen":
      return paginaOphalen(a);
    case "tekst_insturen": {
      const agent = agentOf(a);
      const u = publicUrl(str(a, "url")!);
      if (!u) throw new ToolError("Alleen openbare http(s)-adressen");
      const tekst = str(a, "tekst", true, 60000)!;
      const placeId = str(a, "place_id", false, 40) ?? null;
      const src = await rpc<Source>("bron_resolve_source", { p_url: u.href, p_kind: str(a, "soort_bron", false, 20) ?? null, p_place: placeId });
      if (src.status === "geblokkeerd") throw new ToolError(`Bron ${src.source_id} is geblokkeerd`);
      const id = await rpc<number>("bron_store_document", {
        p_source: src.source_id, p_url: u.href, p_place: placeId, p_fetched_by: "agent", p_http_status: null,
        p_published_on: str(a, "gepubliceerd_op", false, 10) ?? null, p_text: tekst, p_agent: agent,
      });
      return { document_id: id, bron: src.source_id, tier: src.tier };
    }
    case "claims_insturen":
      return rpc("bron_submit_claims", { p_document: Number(a.document_id), p_claims: a.claims ?? [], p_agent: agentOf(a) });
    case "kandidaten_insturen":
      return rpc("bron_submit_candidates", {
        p_source: null, p_document: Number(a.document_id), p_items: a.kandidaten ?? [], p_agent: agentOf(a),
      });
    case "besluiten":
      return rpc("bron_decisions", { p_place: str(a, "place_id", true, 40) });
    case "bron_blokkeren":
      await rpc("bron_block_source", { p_source: str(a, "bron", true, 63), p_reason: str(a, "reden", true, 400), p_agent: agentOf(a) });
      return { ok: true };
    default:
      throw new ToolError(`Onbekende tool: ${name}`);
  }
}

// ── JSON-RPC ───────────────────────────────────────────────────────────────────────────────────────────────────

type Msg = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

async function handle(m: Msg): Promise<object | null> {
  const reply = (result: unknown) => ({ jsonrpc: "2.0", id: m.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: m.id ?? null, error: { code, message } });
  if (m.id === undefined) return null; // notificatie
  switch (m.method) {
    case "initialize":
      return reply({
        protocolVersion: VERSIONS.includes(String(m.params?.protocolVersion)) ? String(m.params?.protocolVersion) : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "vrijstaan-bronnen", version: VERSION },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(m.params?.name ?? "");
      const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await callTool(name, args);
        return reply({ content: [{ type: "text", text: JSON.stringify(out ?? null, null, 1) }] });
      } catch (e) {
        const msg = e instanceof ToolError ? e.message : `Interne fout: ${(e as Error).message}`;
        if (!(e instanceof ToolError)) console.error("bronnen-mcp", name, e);
        return reply({ content: [{ type: "text", text: msg }], isError: true });
      }
    }
    default:
      return fail(-32601, `Onbekende methode: ${m.method}`);
  }
}

Deno.serve(async (req) => {
  if (!KEY) return new Response("BRONNEN_MCP_KEY ontbreekt", { status: 503 });
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const pathKey = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!safeEqual(bearer, KEY) && !safeEqual(pathKey, KEY)) return new Response("Geen toegang", { status: 401 });
  if (req.method === "GET" || req.method === "DELETE") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Geen geldige JSON" } }, { status: 400 });
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Msg[];
  const invalid = (message: string) =>
    Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message } }, { status: 400 });
  if (!msgs.length) return invalid("Lege batch");
  if (msgs.length > 20) return invalid("Te veel berichten");
  if (msgs.some((m) => !m || typeof m !== "object" || Array.isArray(m) || typeof m.method !== "string")) {
    return invalid("Elk bericht is een JSON-RPC-object met een method");
  }
  const out = (await Promise.all(msgs.map(handle))).filter((x) => x !== null);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(batch ? out : out[0], { headers: { "Cache-Control": "no-store" } });
});
