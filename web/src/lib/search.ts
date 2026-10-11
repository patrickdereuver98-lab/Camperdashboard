import { distanceKm, type LatLng } from "./geo";
import type { PlaceKind, PlaceSummary } from "./types";

// ── Filters ─────────────────────────────────────────────────────────────────

export const FACILITIES = [
  { key: "power", param: "stroom", label: "Stroom", icon: "power" },
  { key: "water", param: "water", label: "Water", icon: "water" },
  { key: "dumpStation", param: "lozen", label: "Lozen", icon: "dump" },
  { key: "toilet", param: "toilet", label: "Toilet", icon: "toilet" },
  { key: "shower", param: "douche", label: "Douche", icon: "shower" },
  { key: "wifi", param: "wifi", label: "Wifi", icon: "wifi" },
  { key: "dogs", param: "honden", label: "Honden welkom", icon: "dog" },
] as const;

export type FacilityKey = (typeof FACILITIES)[number]["key"];

export type SortKey = "aanbevolen" | "afstand" | "prijs" | "score";

export interface Filters {
  /** Weergavenaam van de bestemming ("Giethoorn", "Zeeland") */
  where?: string;
  /** Middelpunt als de bestemming een plaats is */
  center?: LatLng;
  radiusKm: number;
  province?: string;
  facilities: FacilityKey[];
  kinds: PlaceKind[];
  free: boolean;
  maxPrice?: number;
  /** Bij een prijsfilter ook plekken tonen waarvan de prijs onbekend is */
  priceUnknown: boolean;
  minLength?: number;
  /** Alleen plekken waarvan de bron zegt dat er geen vaste vertrektijd is (vrij of per 24 uur) */
  noFixedDeparture: boolean;
  openNow: boolean;
  minScore?: number;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  radiusKm: 25,
  facilities: [],
  kinds: [],
  free: false,
  priceUnknown: false,
  noFixedDeparture: false,
  openNow: false,
  sort: "aanbevolen",
};

type Params = { get(name: string): string | null };

export function parseFilters(p: Params): Filters {
  const num = (k: string) => {
    const v = Number(p.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  const facilityParams = (p.get("v") ?? "").split(",");
  const sort = p.get("sort") as SortKey | null;
  return {
    where: p.get("waar") ?? undefined,
    center: Number.isFinite(lat) && Number.isFinite(lng) && lat && lng ? { lat, lng } : undefined,
    radiusKm: num("straal") ?? DEFAULT_FILTERS.radiusKm,
    province: p.get("provincie") ?? undefined,
    facilities: FACILITIES.filter((f) => facilityParams.includes(f.param)).map((f) => f.key),
    kinds: (p.get("type") ?? "").split(",").filter(Boolean) as PlaceKind[],
    free: p.get("gratis") === "1",
    maxPrice: num("maxprijs"),
    priceUnknown: p.get("onbekend") === "1",
    minLength: num("lengte"),
    noFixedDeparture: p.get("vrij") === "1",
    openNow: p.get("open") === "1",
    minScore: num("score"),
    sort: sort && ["aanbevolen", "afstand", "prijs", "score"].includes(sort) ? sort : "aanbevolen",
  };
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.where) p.set("waar", f.where);
  if (f.center) {
    p.set("lat", f.center.lat.toFixed(5));
    p.set("lng", f.center.lng.toFixed(5));
    if (f.radiusKm !== DEFAULT_FILTERS.radiusKm) p.set("straal", String(f.radiusKm));
  }
  if (f.province) p.set("provincie", f.province);
  if (f.facilities.length)
    p.set("v", FACILITIES.filter((x) => f.facilities.includes(x.key)).map((x) => x.param).join(","));
  if (f.kinds.length) p.set("type", f.kinds.join(","));
  if (f.free) p.set("gratis", "1");
  if (f.maxPrice) p.set("maxprijs", String(f.maxPrice));
  if (f.priceUnknown && (f.free || f.maxPrice)) p.set("onbekend", "1");
  if (f.minLength) p.set("lengte", String(f.minLength));
  if (f.noFixedDeparture) p.set("vrij", "1");
  if (f.openNow) p.set("open", "1");
  if (f.minScore) p.set("score", String(f.minScore));
  if (f.sort !== "aanbevolen") p.set("sort", f.sort);
  return p.toString();
}

export function searchHref(f: Partial<Filters>): string {
  const q = filtersToQuery({ ...DEFAULT_FILTERS, ...f });
  return q ? `/zoeken?${q}` : "/zoeken";
}

/** Aantal actieve verfijningen (zonder bestemming en sortering) */
export function refinementCount(f: Filters): number {
  return (
    f.facilities.length +
    f.kinds.length +
    (f.free ? 1 : 0) +
    (f.maxPrice ? 1 : 0) +
    (f.minLength ? 1 : 0) +
    (f.noFixedDeparture ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.minScore ? 1 : 0)
  );
}

// ── Seizoen ─────────────────────────────────────────────────────────────────

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** Is de plek op `date` open volgens het seizoen? `undefined` = onbekend. */
export function isOpenOn(p: Pick<PlaceSummary, "openAllYear" | "season">, date = new Date()): boolean | undefined {
  if (p.openAllYear) return true;
  if (!p.season) return undefined;
  const m = /(?:(\d{1,2}) )?([a-z]+) – (?:(\d{1,2}) )?([a-z]+)/.exec(p.season.toLowerCase());
  if (!m) return undefined;
  const from = MONTHS.indexOf(m[2]);
  const to = MONTHS.indexOf(m[4]);
  if (from < 0 || to < 0) return undefined;
  const start = new Date(date.getFullYear(), from, Number(m[1] ?? 1));
  const end = new Date(date.getFullYear(), to, Number(m[3] ?? new Date(date.getFullYear(), to + 1, 0).getDate()), 23, 59);
  return start <= end ? date >= start && date <= end : date >= start || date <= end;
}

const MONTH_SHORT = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** Korte status voor kaarten: alleen als het seizoen bekend is */
export function openStatus(p: Pick<PlaceSummary, "openAllYear" | "season">, date = new Date()): { open: boolean; label: string } | undefined {
  if (p.openAllYear) return { open: true, label: "Hele jaar open" };
  const open = isOpenOn(p, date);
  if (open === undefined || !p.season) return undefined;
  const [from, to] = p.season.split(" – ");
  if (open) return { open: true, label: `Open t/m ${to}` };
  const month = MONTH_SHORT.find((m) => from.toLowerCase().includes(m));
  return { open: false, label: month ? `Gesloten tot ${month}` : "Nu gesloten" };
}

// ── Toepassen ───────────────────────────────────────────────────────────────

export interface Result {
  place: PlaceSummary;
  km?: number;
}

/** Geen vaste vertrektijd volgens de bron: vrij vertrekken of betalen per 24 uur */
export const freeDeparture = (p: Pick<PlaceSummary, "departure">) => p.departure === "vrij" || p.departure === "per24";

// "Aanbevolen": volledigheid van de gegevens, reviews (pas zwaar vanaf 5), een foto en geen vaste vertrektijd.
// Bij een bestemming telt de afstand mee. Betaalde plaatsing bestaat niet.
function recommendScore(p: PlaceSummary): number {
  const rating = p.ratingAvg ? (p.ratingAvg / 10) * Math.min(1, p.ratingCount / 5) : 0;
  return p.completeness * 2 + rating + (p.imageUrl ? 0.3 : 0) + (freeDeparture(p) ? 0.3 : 0);
}

export function applyFilters(places: PlaceSummary[], f: Filters): Result[] {
  const now = new Date();
  let results: Result[] = [];
  for (const p of places) {
    if (f.province && p.province !== f.province) continue;
    let km: number | undefined;
    if (f.center) {
      km = distanceKm(f.center, p);
      if (km > f.radiusKm) continue;
    }
    if (f.facilities.some((k) => p[k] !== true)) continue;
    if (f.kinds.length && (!p.kind || !f.kinds.includes(p.kind))) continue;
    const unknownPriceOk = f.priceUnknown && p.priceEur === undefined;
    if (f.free && p.priceEur !== 0 && !unknownPriceOk) continue;
    if (f.maxPrice && !unknownPriceOk && (p.priceEur === undefined || p.priceEur > f.maxPrice)) continue;
    if (f.minLength && p.maxLengthM !== undefined && p.maxLengthM < f.minLength) continue;
    if (f.noFixedDeparture && !freeDeparture(p)) continue;
    // "Nu open" verbergt alleen plekken die volgens hun seizoen zeker dicht zijn; onbekend blijft staan
    if (f.openNow && isOpenOn(p, now) === false) continue;
    if (f.minScore && (p.ratingAvg ?? 0) < f.minScore) continue;
    results.push({ place: p, km });
  }

  const byPrice = (r: Result) => r.place.priceEur ?? Number.POSITIVE_INFINITY;
  switch (f.sort) {
    case "afstand":
      results = results.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
      break;
    case "prijs":
      results = results.sort((a, b) => byPrice(a) - byPrice(b));
      break;
    case "score":
      results = results.sort((a, b) => (b.place.ratingAvg ?? 0) - (a.place.ratingAvg ?? 0) || recommendScore(b.place) - recommendScore(a.place));
      break;
    default:
      results = results.sort(
        (a, b) =>
          recommendScore(b.place) - recommendScore(a.place) -
          (f.center ? ((b.km ?? 0) - (a.km ?? 0)) / Math.max(10, f.radiusKm) : 0),
      );
  }
  // Plekken die nu zeker gesloten zijn altijd onderaan (volgorde verder gelijk)
  return [...results.filter((r) => isOpenOn(r.place, now) !== false), ...results.filter((r) => isOpenOn(r.place, now) === false)];
}

/** Welke ene verfijning weghalen levert de meeste plekken op? Voor lege resultaten en de filtersheet. */
export function relaxations(places: PlaceSummary[], f: Filters): { label: string; next: Filters; count: number }[] {
  const options: { label: string; next: Filters }[] = [
    ...f.facilities.map((k) => ({ label: `Zonder "${FACILITIES.find((x) => x.key === k)!.label}"`, next: { ...f, facilities: f.facilities.filter((x) => x !== k) } })),
    ...f.kinds.map((k) => ({ label: `Ook andere soorten dan ${k}`, next: { ...f, kinds: f.kinds.filter((x) => x !== k) } })),
    ...(f.free ? [{ label: "Tot € 10 per nacht", next: { ...f, free: false, maxPrice: 10 } }] : []),
    ...(f.free || f.maxPrice ? [{ label: "Ook met onbekende prijs", next: { ...f, priceUnknown: true } }] : []),
    ...(f.maxPrice ? [{ label: "Zonder prijsgrens", next: { ...f, maxPrice: undefined } }] : []),
    ...(f.minLength ? [{ label: "Zonder lengtefilter", next: { ...f, minLength: undefined } }] : []),
    ...(f.noFixedDeparture ? [{ label: "Ook plekken met vertrektijd of onbekend", next: { ...f, noFixedDeparture: false } }] : []),
    ...(f.openNow ? [{ label: "Ook gesloten plekken", next: { ...f, openNow: false } }] : []),
    ...(f.minScore ? [{ label: "Zonder minimale score", next: { ...f, minScore: undefined } }] : []),
    ...(f.center && f.radiusKm < 100 ? [{ label: `Binnen ${f.radiusKm * 2} km`, next: { ...f, radiusKm: f.radiusKm * 2 } }] : []),
    ...(f.province || f.center ? [{ label: "In heel Nederland", next: { ...f, where: undefined, center: undefined, province: undefined } }] : []),
  ];
  return options
    .map((o) => ({ ...o, count: applyFilters(places, o.next).length }))
    .filter((o) => o.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ── Bestemmingen ────────────────────────────────────────────────────────────

export function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spreektaal en schrijfwijzen naar de officiële naam (beide genormaliseerd) */
const ALIASES: Record<string, string> = {
  "den bosch": "s hertogenbosch",
  "s bosch": "s hertogenbosch",
  "fryslan": "friesland",
  "noord brabant": "noord brabant",
  "brabant": "noord brabant",
  "den haag": "s gravenhage",
  "the hague": "s gravenhage",
};

/** Zoekvorm van een vraag: normaliseren, "st" → "sint", bekende aliassen */
export function searchForm(q: string): string {
  let n = normalize(q).replace(/\bst\b/g, "sint");
  if (ALIASES[n]) n = ALIASES[n];
  return n;
}

/** Levenshtein-afstand, afgekapt: alleen interessant of het ≤ max is */
export function closeEnough(a: string, b: string, max = 2): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}
