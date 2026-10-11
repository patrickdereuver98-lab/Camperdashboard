import { cacheLife, cacheTag } from "next/cache";
import snapshot from "@/data/snapshot.json";
import { OFFLINE_BUILD, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import { distanceKm } from "./geo";
import type { Place, PlaceSummary, Review, Town } from "./types";

// ── Supabase REST ───────────────────────────────────────────────────────────

const PLACE_COLUMNS =
  "id,slug,name,kind,lat,lng,street,postcode,town,province,description,description_source,price_eur,price_note," +
  "tourist_tax_included,power,water,dump_station,toilet,shower,wifi,dogs,capacity,max_length_m,surface,open_all_year," +
  "season,reservation,max_stay_nights,website,phone,email,image_url,image_credit,photos,rating_avg,rating_count," +
  "completeness,verified_at,updated_at";

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

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

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
  return withFallback(
    async () =>
      (await rest<Record<string, unknown>>(`places?select=${PLACE_COLUMNS}&status=eq.published&order=slug`)).map(
        (r) => toCamel<Place>(r),
      ),
    () => SNAP.places,
  );
}

const SUMMARY_KEYS: (keyof PlaceSummary)[] = [
  "id", "slug", "name", "kind", "lat", "lng", "town", "province", "priceEur", "power", "water", "dumpStation",
  "toilet", "shower", "wifi", "dogs", "capacity", "maxLengthM", "openAllYear", "season", "imageUrl", "ratingAvg",
  "ratingCount", "completeness",
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
    power: places.filter((p) => p.power).length,
    dump: places.filter((p) => p.dumpStation).length,
    dogs: places.filter((p) => p.dogs).length,
    withPhoto: places.filter((p) => p.imageUrl).length,
    byProvince,
  };
}

// ── Instellingen uit de beheeromgeving ─────────────────────────────────────

export type SiteSettings = { contact: { email: string; response_days: number }; announcement: { text: string; enabled: boolean } };
const DEFAULT_SETTINGS: SiteSettings = { contact: { email: "hallo@vrijstaan.nl", response_days: 2 }, announcement: { text: "", enabled: false } };

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("minutes");
  return withFallback(async () => {
    const rows = await rest<{ key: string; value: unknown }>("site_settings?select=key,value");
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...map } as SiteSettings;
  }, () => DEFAULT_SETTINGS);
}
