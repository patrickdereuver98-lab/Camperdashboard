// Zoekvak "waar": adressen, postcodes, woonplaatsen en gemeenten via de PDOK Locatieserver (Kadaster, gratis, geen sleutel).
// Alleen onze server praat met PDOK (`/api/locatie`); de browser niet, zodat PDOK geen IP-adressen van bezoekers ziet.
// Ligt PDOK plat, dan valt het zoekvak terug op de eigen lijst woonplaatsen (`nl_towns`).
import { normalize, searchForm } from "./search";
import type { Town } from "./types";

const BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
const TYPES = ["woonplaats", "postcode", "adres", "gemeente"] as const;
const UA = "VrijStaan/1.0 (+https://vrijstaan.nl)";
const TIMEOUT_MS = 4000;

export type LocationType = (typeof TYPES)[number];

export interface Location {
  /** id bij PDOK (voor lookup); ontbreekt bij de lokale terugval */
  id?: string;
  type: LocationType;
  /** Weergavenaam zoals PDOK hem geeft ("Damrak 1, 1012LG Amsterdam") */
  label: string;
  province?: string;
  lat?: number;
  lng?: number;
}

export interface SuggestAnswer {
  bron: "pdok" | "lokaal";
  resultaten: Location[];
}

export const LOCATION_KIND: Record<LocationType, string> = {
  adres: "Adres",
  postcode: "Postcode",
  woonplaats: "Woonplaats",
  gemeente: "Gemeente",
};

/** Zoekterm schoonmaken: 2 tot 80 tekens, alleen letters, cijfers, spaties en . , ' ’ - / */
export function cleanQuery(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 80) return null;
  return /^[\p{L}\p{N} .,'’\-/]+$/u.test(q) ? q : null;
}

export function isLocationId(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && /^[a-z]{3}-[A-Za-z0-9]{1,64}$/.test(raw);
}

/** "POINT(lon lat)" naar { lat, lng }; alleen binnen een ruim kader om Nederland */
export function parsePoint(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw !== "string") return null;
  const m = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/.exec(raw.trim());
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  if (lat < 50 || lat > 54 || lng < 3 || lng > 7.5) return null;
  return { lat, lng };
}

export function suggestUrl(q: string): string {
  const p = new URLSearchParams({
    q,
    fq: `type:(${TYPES.join(" OR ")})`,
    rows: "8",
    fl: "id,weergavenaam,type,centroide_ll",
  });
  return `${BASE}/suggest?${p}`;
}

export function lookupUrl(id: string): string {
  return `${BASE}/lookup?${new URLSearchParams({ id, fl: "weergavenaam,centroide_ll,type" })}`;
}

function toLocation(d: Record<string, unknown>, id = d.id): Location | null {
  if (!isLocationId(typeof id === "string" ? id : null)) return null;
  if (!TYPES.includes(d.type as LocationType)) return null;
  if (typeof d.weergavenaam !== "string" || !d.weergavenaam.trim()) return null;
  const point = parsePoint(d.centroide_ll);
  return { id: id as string, type: d.type as LocationType, label: d.weergavenaam.trim(), ...(point ?? {}) };
}

async function getDocs(url: string, fetchImpl: typeof fetch): Promise<Record<string, unknown>[]> {
  const res = await fetchImpl(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`PDOK ${res.status}`);
  const data = (await res.json()) as { response?: { docs?: unknown } };
  const docs = data?.response?.docs;
  if (!Array.isArray(docs)) throw new Error("PDOK: onverwacht antwoord");
  return docs.filter((d): d is Record<string, unknown> => !!d && typeof d === "object");
}

export async function fetchSuggest(q: string, fetchImpl: typeof fetch = fetch): Promise<Location[]> {
  const docs = await getDocs(suggestUrl(q), fetchImpl);
  return docs.map((d) => toLocation(d)).filter((l): l is Location => l !== null);
}

export async function fetchLookup(id: string, fetchImpl: typeof fetch = fetch): Promise<Location | null> {
  const [d] = await getDocs(lookupUrl(id), fetchImpl);
  const loc = d ? toLocation(d, id) : null;
  return loc && loc.lat !== undefined ? loc : null;
}

/** Terugval: woonplaatsen uit de eigen lijst die beginnen met of de zoekterm bevatten */
export function townsMatching(towns: Town[], q: string, max = 8): Location[] {
  const n = searchForm(q);
  if (n.length < 2) return [];
  const hits: { t: Town; rank: number }[] = [];
  for (const t of towns) {
    const name = normalize(t.name);
    const rank = name === n ? 0 : name.startsWith(n) ? 1 : n.length > 2 && name.includes(n) ? 2 : -1;
    if (rank >= 0) hits.push({ t, rank });
  }
  hits.sort((a, b) => a.rank - b.rank || a.t.name.localeCompare(b.t.name, "nl"));
  return hits.slice(0, max).map(({ t }) => ({ type: "woonplaats", label: t.name, province: t.province, lat: t.lat, lng: t.lng }));
}

/** PDOK eerst; bij elke fout de lokale lijst. Geeft nooit een fout terug. */
export async function answerSuggest(
  q: string,
  deps: { suggest: (q: string) => Promise<Location[]>; towns: () => Promise<Town[]> },
): Promise<SuggestAnswer> {
  try {
    return { bron: "pdok", resultaten: await deps.suggest(q) };
  } catch {
    try {
      return { bron: "lokaal", resultaten: townsMatching(await deps.towns(), q) };
    } catch {
      return { bron: "lokaal", resultaten: [] };
    }
  }
}

/** Woonplaatsen die het zoekvak al uit de eigen lijst toont, niet nog eens van PDOK */
export function withoutKnownTowns(remote: Location[], known: Iterable<string>): Location[] {
  const seen = new Set([...known].map(normalize));
  return remote.filter((r) => r.type !== "woonplaats" || !seen.has(normalize(r.label.split(",")[0])));
}
