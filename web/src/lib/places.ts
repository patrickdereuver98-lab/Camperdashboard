import { cacheLife, cacheTag } from "next/cache";
import snapshot from "@/data/snapshot.json";
import { OFFLINE_BUILD, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { distanceKm } from "./geo";
import { departureKind, isOpenOn } from "./search";
import type { Place, PlaceSummary, Review, Town } from "./types";

// ── Supabase REST ───────────────────────────────────────────────────────────

const PLACE_COLUMNS =
  "id,slug,name,kind,lat,lng,street,postcode,town,province,description,description_source,price_eur,price_note," +
  "tourist_tax_included,power,water,dump_station,toilet,shower,wifi,dogs,capacity,max_length_m,surface,open_all_year," +
  "season,reservation,max_stay_nights,website,phone,email,image_url,image_credit,photos,rating_avg,rating_count," +
  "completeness,verified_at,updated_at,departure,checkout_until,checkin_from,access_hours,access_24h,times_note,price_extras";

async function rest<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=1000&offset=${offset}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
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
    console.warn("[vrijstaan] Supabase niet bereikbaar, snapshot gebruikt:", (err as Error).message);
    return offline();
  }
}

// ── Plekken ─────────────────────────────────────────────────────────────────

export async function getPlaces(): Promise<Place[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  const { website_photos } = await getSettings();
  return withFallback(
    async () =>
      (await rest<Record<string, unknown>>(`places?select=${PLACE_COLUMNS}&status=eq.published&order=slug`)).map(
        (r) => normalize(toCamel<Place>(r), website_photos),
      ),
    () => SNAP.places.map((p) => normalize(p, website_photos)),
  );
}

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

function normalize(p: Place, websitePhotos = false): Place {
  const photos = (p.photos ?? [])
    .map((ph) => ({ ...ph, url: decodeEntities(ph.url) }))
    .filter((ph) => /^https:\/\//.test(ph.url) && photoAllowed(ph.url, ph.permission, websitePhotos))
    .map((ph) => ({ ...ph, credit: ph.credit?.replace(/^www\./, "") ?? sourceCredit(ph.url) }));
  const image = p.imageUrl ? decodeEntities(p.imageUrl) : undefined;
  const imageUrl = image && /^https:\/\//.test(image) && photoAllowed(image, p.photos?.find((ph) => ph.url === p.imageUrl)?.permission, websitePhotos) ? image : photos[0]?.url;
  return {
    ...p,
    photos,
    imageUrl,
    imageCredit: imageUrl ? (imageUrl === image ? (p.imageCredit?.replace(/^www\./, "") ?? sourceCredit(image)) : photos[0]?.credit) : undefined,
    // "vanaf € x": de laagste genoemde prijs, er zijn duurdere tarieven
    priceFrom: p.priceEur !== undefined && p.priceEur > 0 && /^vanaf/i.test(p.priceNote ?? "") ? true : undefined,
  };
}

const SUMMARY_KEYS: (keyof PlaceSummary)[] = [
  "id", "slug", "name", "kind", "lat", "lng", "town", "province", "priceEur", "power", "water", "dumpStation",
  "toilet", "shower", "wifi", "dogs", "capacity", "maxLengthM", "openAllYear", "season", "imageUrl", "ratingAvg",
  "ratingCount", "completeness", "priceFrom", "touristTaxIncluded", "departure", "checkoutUntil", "priceExtras",
];

export function toSummary(p: Place): PlaceSummary {
  const out: Record<string, unknown> = {};
  for (const k of SUMMARY_KEYS) if (p[k] !== undefined) out[k] = p[k];
  return out as PlaceSummary;
}

export async function getSummaries(): Promise<PlaceSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("places");
  return (await getPlaces()).map(toSummary);
}

export async function getPlace(slug: string): Promise<Place | undefined> {
  return (await getPlaces()).find((p) => p.slug === slug);
}

export async function getNearby(place: Pick<Place, "id" | "lat" | "lng">, limit = 6) {
  return (await getSummaries())
    .filter((p) => p.id !== place.id)
    .map((p) => ({ place: p, km: distanceKm(place, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
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
  const places = await getPlaces();
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
    otherDeparture: places.filter((p) => ["vroeg", "onbekend"].includes(departureKind(p))).length,
    withPhoto: places.filter((p) => p.imageUrl).length,
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
