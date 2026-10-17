import { cacheLife, cacheTag } from "next/cache";
import snapshot from "@/data/snapshot.json";
import { OFFLINE_BUILD, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { distanceKm } from "./geo";
import { departureKind, inDepartureGroup, isOpenOn } from "./search";
import { PRERENDER_LIMIT, rankForPrerender } from "./prerender";
import { inBbox, type Bbox } from "./bbox";
import { cleanDescription } from "./description";
import { rankPhotos } from "./photos";
import type { Photo, Place, PlaceSummary, Review, Town } from "./types";

// ── Supabase REST ───────────────────────────────────────────────────────────

const PLACE_COLUMNS =
  "id,slug,name,kind,lat,lng,street,postcode,town,province,description,description_source,price_eur,price_note," +
  "tourist_tax_included,power,water,dump_station,toilet,shower,wifi,dogs,capacity,max_length_m,surface,open_all_year," +
  "season,reservation,max_stay_nights,website,phone,email,image_url,image_credit,photos,rating_avg,rating_count," +
  "completeness,verified_at,updated_at,departure,checkout_until,checkin_from,access_hours,access_24h,times_note,price_extras," +
  "departure_check,departure_checked_at,departure_checked_by";

/** Kolommen voor kaarten, zoeken en de kaart: geen foto-lijsten of beschrijvingen */
const SUMMARY_COLUMNS =
  "id,slug,name,kind,lat,lng,town,province,price_eur,price_note,tourist_tax_included,power,water,dump_station,toilet," +
  "shower,wifi,dogs,capacity,max_length_m,open_all_year,season,image_url,image_credit,rating_avg,rating_count," +
  "completeness,departure,checkout_until,price_extras,departure_check,checkin_from,access_24h,access_hours";

class SupabaseError extends Error {
  constructor(readonly status: number, body: string) {
    super(`Supabase ${status}: ${body.slice(0, 300)}`);
  }
}

/** Bij drukte (429) of een haperende database (5xx) één keer opnieuw proberen voordat we op de snapshot terugvallen */
async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (res.ok || attempt >= retries || !(res.status === 429 || res.status >= 500)) return res;
    await new Promise((r) => setTimeout(r, 300 * 2 ** attempt + Math.random() * 200));
  }
}

async function rest<T>(path: string, { all = true } = {}): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const sep = path.includes("?") ? "&" : "?";
    // Een eigen limit in het pad: één verzoek, geen paginering
    const own = /[?&]limit=/.test(path);
    const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${path}${own ? "" : `${sep}limit=1000&offset=${offset}`}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) throw new SupabaseError(res.status, await res.text());
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (own || !all || rows.length < 1000) return out;
  }
}

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

function toCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[camel(k)] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && /(eur|avg|_m)$/.test(k) ? Number(v) : v;
  return out as T;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  position: number;
}

type Snapshot = { places: Place[]; towns: Town[]; faq: FaqItem[]; reviews: (Review & { placeId: string })[] };
const SNAP = snapshot as unknown as Snapshot;

async function withFallback<T>(live: () => Promise<T>, offline: () => T): Promise<T> {
  if (OFFLINE_BUILD) return offline();
  try {
    return await live();
  } catch (err) {
    // Een 4xx is een fout in onze query of het schema, geen storing. Dan niet stil de snapshot tonen (oude prijzen,
    // verborgen plekken die terugkomen): de fout gaat door, en Next.js blijft de laatst goede versie serveren.
    if (err instanceof SupabaseError && err.status < 500) {
      console.error("[vrijstaan] Supabase weigert de query:", err.message);
      throw err;
    }
    console.error("[vrijstaan] Supabase niet bereikbaar, snapshot gebruikt:", (err as Error).message);
    return offline();
  }
}

// ── Plekken ─────────────────────────────────────────────────────────────────


/**
 * Foto's die we mogen tonen: Wikimedia Commons (met naamsvermelding), uploads in onze eigen opslag (bezoekers en
 * eigenaren, met licentie via de voorwaarden) en foto's waarvoor de eigenaar toestemming gaf. Foto's van de website
 * van de plek staan standaard aan (besluit eigenaar, met bronvermelding en verwijdering op verzoek); uit te zetten in beheer.
 */
function photoAllowed(url: string, permission: boolean | undefined, websitePhotos: boolean) {
  if (websitePhotos || permission) return true;
  return /^https:\/\/(commons|upload)\.wikimedia\.org\//.test(url) || url.startsWith(`${SUPABASE_URL}/storage/`);
}

/** Bronvermelding voor een foto zonder credit: "website camping-x.nl" */
function sourceCredit(url: string): string | undefined {
  if (/^https:\/\/(commons|upload)\.wikimedia\.org\//.test(url) || url.startsWith(`${SUPABASE_URL}/storage/`)) return undefined;
  try {
    return `website ${new URL(url).hostname.replace(/^www\./, "")}`;
  } catch {
    return undefined;
  }
}

/** Sommige sites geven foto-URL's met HTML-entiteiten (https&#x3A;&#x2F;…) */
const decodeEntities = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d))).replace(/&amp;/g, "&");

/**
 * Foto-adres opschonen: HTML-entiteiten en dubbel geplakte adressen ("https://site.nl/https://cdn…/foto.jpg",
 * ontstaan doordat de site zelf een volledig adres als relatief pad gebruikt).
 */
function cleanUrl(u: string): string {
  const s = decodeEntities(u);
  const last = s.lastIndexOf("http");
  return last > 0 && /^https?:\/\//.test(s.slice(last)) ? s.slice(last) : s;
}

/** Bestandsnamen die geen foto van de plek zijn: logo's, knoppen, iconen, keurmerken */
const NOT_A_PHOTO = /(logo|icon|favicon|\/fav\.|button|knop|reserv|placeholder|sprite|badge|keurmerk|payment|ideal|zoover|acsi|anwb-|flag)[^/]*$/i;

function normalize(p: Place, websitePhotos = false): Place {
  const image = p.imageUrl ? cleanUrl(p.imageUrl) : undefined;
  const allowed = (ph: Photo) => /^https:\/\//.test(ph.url) && !NOT_A_PHOTO.test(ph.url) && photoAllowed(ph.url, ph.permission, websitePhotos);
  // Hoofdfoto en galerij samen sorteren: een echte foto van de plek vooraan, keurmerken en miniaturen eruit
  const candidates: Photo[] = (p.photos ?? []).map((ph) => ({ ...ph, url: cleanUrl(ph.url) }));
  if (image && !candidates.some((ph) => ph.url === image)) candidates.unshift({ url: image, credit: p.imageCredit });
  const photos = rankPhotos(candidates.filter(allowed)).map((ph) => ({ ...ph, credit: ph.credit?.replace(/^www\./, "") ?? sourceCredit(ph.url) }));
  // Kaarten en zoeken halen geen fotolijst op: dan alleen de hoofdfoto, als die de toets doorstaat
  const cover = photos[0];
  return {
    ...p,
    description: cleanDescription(p.description),
    // Alleen gewone weblinks: OSM en websites zijn door iedereen te bewerken (geen javascript:- of data:-links)
    website: p.website && /^https?:\/\//i.test(p.website) ? p.website : undefined,
    photos,
    imageUrl: cover?.url,
    imageCredit: cover?.credit,
    // "vanaf € x": de laagste genoemde prijs, er zijn duurdere tarieven
    priceFrom: p.priceEur !== undefined && p.priceEur > 0 && /^vanaf/i.test(p.priceNote ?? "") ? true : undefined,
  };
}

const SUMMARY_KEYS: (keyof PlaceSummary)[] = [
  "id", "slug", "name", "kind", "lat", "lng", "town", "province", "priceEur", "power", "water", "dumpStation",
  "toilet", "shower", "wifi", "dogs", "capacity", "maxLengthM", "openAllYear", "season", "imageUrl", "ratingAvg",
  "ratingCount", "completeness", "priceFrom", "touristTaxIncluded", "departure", "checkoutUntil", "departureCheck", "priceExtras", "imageCredit",
  "checkinFrom", "access24h", "accessHours",
];

export function toSummary(p: Place): PlaceSummary {
  const out: Record<string, unknown> = {};
  for (const k of SUMMARY_KEYS) if (p[k] !== undefined) out[k] = p[k];
  return out as PlaceSummary;
}

/**
 * Alle plekken als lichte samenvatting. Haalt alleen de kolommen voor kaarten op, zodat pagina's die dit
 * gebruiken (start, zoeken, provincies) geen megabytes aan foto-lijsten en teksten in hun cache meenemen.
 */
export async function getSummaries(): Promise<PlaceSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  const { website_photos } = await getSettings();
  return withFallback(
    async () =>
      (await rest<Record<string, unknown>>(`places?select=${SUMMARY_COLUMNS}&status=eq.published&order=slug`)).map((r) =>
        toSummary(normalize(toCamel<Place>(r), website_photos)),
      ),
    () => SNAP.places.map((p) => toSummary(normalize(p, website_photos))),
  );
}

/** Nieuwe slug van een plek die is samengevoegd met een andere; undefined als er niets is samengevoegd */
export async function getRedirect(slug: string): Promise<string | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places", `plek-${slug}`);
  if (OFFLINE_BUILD || !/^[a-z0-9-]{1,120}$/.test(slug)) return undefined;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_redirect`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const target = (await res.json()) as string | null;
    return target && target !== slug ? target : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Plekken binnen een (op het raster afgeronde) bounding box, via PostGIS (`places_in_bbox`, GIST-index).
 * Gecachet per bbox: bezoekers die hetzelfde gebied bekijken delen één database-aanvraag.
 */
export async function getSummariesInBbox(bbox: Bbox): Promise<PlaceSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  const [w, s, e, n] = bbox;
  const { website_photos } = await getSettings();
  return withFallback(
    async () =>
      (
        await rest<Record<string, unknown>>(
          `rpc/places_in_bbox?min_lng=${w}&min_lat=${s}&max_lng=${e}&max_lat=${n}&select=${SUMMARY_COLUMNS}`,
        )
      ).map((r) => toSummary(normalize(toCamel<Place>(r), website_photos))),
    () => SNAP.places.filter((p) => inBbox(p, bbox)).map((p) => toSummary(normalize(p, website_photos))),
  );
}

/**
 * Eén plek. Bewust een eigen query en geen filter op de hele lijst: elke plekpagina bewaart de cache die hij
 * leest, en met 1.300 pagina's maal de hele dataset liep de build vast ("Invalid string length").
 */
export async function getPlace(slug: string): Promise<Place | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places", `plek-${slug}`);
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return undefined;
  const { website_photos } = await getSettings();
  return withFallback(
    async () => {
      const [row] = await rest<Record<string, unknown>>(
        `places?select=${PLACE_COLUMNS}&status=eq.published&slug=eq.${encodeURIComponent(slug)}`,
        { all: false },
      );
      return row ? normalize(toCamel<Place>(row), website_photos) : undefined;
    },
    () => {
      const p = SNAP.places.find((x) => x.slug === slug);
      return p ? normalize(p, website_photos) : undefined;
    },
  );
}

export async function getTopPlaceSlugs(limit = PRERENDER_LIMIT): Promise<string[]> {
  return rankForPrerender(await getSummaries(), limit).map((p) => p.slug);
}

/** Plekken in de buurt: alleen een vak rond de plek ophalen (±55 km), niet de hele lijst */
export async function getNearby(place: Pick<Place, "id" | "lat" | "lng">, limit = 6) {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  const { website_photos } = await getSettings();
  const box =
    `lat=gte.${(place.lat - 0.5).toFixed(3)}&lat=lte.${(place.lat + 0.5).toFixed(3)}` +
    `&lng=gte.${(place.lng - 0.8).toFixed(3)}&lng=lte.${(place.lng + 0.8).toFixed(3)}`;
  const candidates = await withFallback(
    async () =>
      (await rest<Record<string, unknown>>(`places?select=${SUMMARY_COLUMNS}&status=eq.published&${box}`, { all: false })).map(
        (r) => toSummary(normalize(toCamel<Place>(r), website_photos)),
      ),
    () => SNAP.places.map((p) => toSummary(normalize(p, website_photos))),
  );
  return candidates
    .filter((p) => p.id !== place.id)
    .map((p) => ({ place: p, km: distanceKm(place, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/** Voor de sitemap: alleen adres en datum */
export async function getSlugs(): Promise<{ slug: string; verifiedAt?: string }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("places");
  return withFallback(
    async () =>
      (await rest<Record<string, unknown>>("places?select=slug,verified_at&status=eq.published&order=slug")).map((r) =>
        toCamel<{ slug: string; verifiedAt?: string }>(r),
      ),
    () => SNAP.places.map((p) => ({ slug: p.slug, verifiedAt: p.verifiedAt })),
  );
}

/** Datum van de laatst gecontroleerde plek, voor "Laatste update" bovenaan lijstpagina's */
export async function getLastUpdate(): Promise<string | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  return withFallback(
    async () =>
      (
        await rest<{ verified_at?: string }>("places?select=verified_at&status=eq.published&verified_at=not.is.null&order=verified_at.desc&limit=1", {
          all: false,
        })
      )[0]?.verified_at,
    () => SNAP.places.reduce<string | undefined>((m, p) => (p.verifiedAt && (!m || p.verifiedAt > m) ? p.verifiedAt : m), undefined),
  );
}

export async function getReviews(placeId: string): Promise<Review[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`reviews-${placeId}`);
  return withFallback(
    async () =>
      (
        await rest<Record<string, unknown>>(
          `reviews?select=id,author_name,rating,score_location,score_quiet,score_facilities,score_value,title,body,vehicle,visited_month,created_at&place_id=eq.${placeId}&status=eq.approved&order=created_at.desc`,
        )
      ).map((r) => toCamel<Review>(r)),
    () => SNAP.reviews.filter((r) => r.placeId === placeId),
  );
}

export async function getTowns(): Promise<Town[]> {
  "use cache";
  cacheLife("days");
  return withFallback(() => rest<Town>("nl_towns?select=name,province,lat,lng&order=name"), () => SNAP.towns);
}

// ── FAQ en statistieken ─────────────────────────────────────────────────────

export async function getFaq(): Promise<FaqItem[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("faq");
  return withFallback(
    () => rest<FaqItem>("faq?select=id,category,question,answer,position&published=eq.true&order=category,position"),
    () => SNAP.faq,
  );
}

export async function getStats() {
  "use cache";
  cacheLife("minutes");
  const [places, updatedAt] = await Promise.all([getSummaries(), getLastUpdate()]);
  const byProvince: Record<string, number> = {};
  for (const p of places) byProvince[p.province] = (byProvince[p.province] ?? 0) + 1;
  return {
    total: places.length,
    free: places.filter((p) => p.priceEur === 0).length,
    openNow: places.filter((p) => isOpenOn(p) === true).length,
    power: places.filter((p) => p.power).length,
    dump: places.filter((p) => p.dumpStation).length,
    dogs: places.filter((p) => p.dogs).length,
    freeDeparture: places.filter((p) => departureKind(p) === "vrij").length,
    lateCheckout: places.filter((p) => departureKind(p) === "uitslapers").length,
    roomyCheckout: places.filter((p) => departureKind(p) === "ruim").length,
    unknownDeparture: places.filter((p) => departureKind(p) === "onbekend").length,
    otherDeparture: places.filter((p) => inDepartureGroup(p, "overig")).length,
    withPhoto: places.filter((p) => p.imageUrl).length,
    updatedAt,
    byProvince,
  };
}

// ── Instellingen uit de beheeromgeving ─────────────────────────────────────

export type SiteSettings = {
  contact: { email: string; response_days: number };
  announcement: { text: string; enabled: boolean };
  /** Foto's van de websites van plekken tonen (standaard aan, met bronvermelding) */
  website_photos: boolean;
};
const DEFAULT_SETTINGS: SiteSettings = {
  contact: { email: "hallo@vrijstaan.nl", response_days: 2 },
  announcement: { text: "", enabled: false },
  website_photos: true,
};

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("minutes");
  return withFallback(async () => {
    const rows = await rest<{ key: string; value: unknown }>("site_settings?select=key,value");
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...map } as SiteSettings;
  }, () => DEFAULT_SETTINGS);
}
