import { distanceKm, type LatLng } from "./geo";
import { timeToMinutes } from "./format";
import { perPersonPrice } from "./trip-extras";

export { timeToMinutes };
import type { PlaceKind, PlaceListItem, PlaceSummary } from "./types";

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

// ── Vertrektijden ───────────────────────────────────────────────────────────

/** Vanaf deze vertrektijd noemen we een plek "voor uitslapers" */
export const LATE_CHECKOUT = "12:00";
/** Vanaf deze vertrektijd (tot 12:00) is het "ruim"; daarvoor "vroeg". 10:00 is ongebruikelijk vroeg, 11:00 de norm. */
export const ROOMY_CHECKOUT = "11:00";

/**
 * Groep per plek: zonder vertrektijd (vrij of per 24 uur, niet afgewezen), uitslapers (12:00 of later), ruim (11:00 tot 12:00), vroeg (vóór 11:00) of onbekend.
 * Verdeling okt. 2026 (gepubliceerd, vaste tijd): ±350 uitslapers, ±310 ruim, ±60 vroeg.
 */
export type DepartureKind = "vrij" | "uitslapers" | "ruim" | "vroeg" | "onbekend";
/** Filter: een groep, of "overig" (ruim + vroeg + onbekend) */
export type DepartureGroup = DepartureKind | "overig";

/** Wat we per plek over vertrekken weten */
export type DepartureFacts = Pick<PlaceSummary, "departure" | "checkoutUntil" | "departureCheck">;

const LATE_MIN = timeToMinutes(LATE_CHECKOUT)!;
const ROOMY_MIN = timeToMinutes(ROOMY_CHECKOUT)!;

export function departureKind(p: DepartureFacts): DepartureKind {
  if (p.departure === "vrij" || p.departure === "per24")
    return p.departureCheck === "voorwaardelijk" || p.departureCheck === "afgewezen" ? "onbekend" : "vrij";
  // Als minuten vergelijken: als tekst staat "9:00" na "11:00"
  const min = p.departure === "vast" ? timeToMinutes(p.checkoutUntil) : undefined;
  if (min !== undefined) {
    if (min >= LATE_MIN) return "uitslapers";
    return min >= ROOMY_MIN ? "ruim" : "vroeg";
  }
  return "onbekend";
}

/** Door een mens bevestigd "geen vaste vertrektijd" */
export function departureConfirmed(p: DepartureFacts): boolean {
  return departureKind(p) === "vrij" && p.departureCheck === "bevestigd";
}

/** Tweede sorteersleutel in elke sortering: bevestigd "geen vaste vertrektijd" eerst (bij gelijke stand) */
export function confirmedFirst(a: DepartureFacts, b: DepartureFacts): number {
  return Number(departureConfirmed(b)) - Number(departureConfirmed(a));
}

/**
 * Sorteersleutel voor prijs, met dezelfde regel als de kaart (`cardPrice`): eerst plekken met een nachtprijs,
 * dan plekken met alleen een prijs per persoon (voor twee personen is dat meer dan het bedrag), dan onbekend.
 */
export function priceRank(p: Pick<PlaceSummary, "priceEur" | "priceExtras">): [number, number] {
  if (p.priceEur !== undefined) return [0, p.priceEur];
  const pp = perPersonPrice(p);
  return pp ? [1, pp.amount] : [2, 0];
}

const OTHER: DepartureKind[] = ["ruim", "vroeg", "onbekend"];

export function inDepartureGroup(p: DepartureFacts, g: DepartureGroup): boolean {
  const k = departureKind(p);
  return g === "overig" ? OTHER.includes(k) : k === g;
}

/** De drie pagina's: elke vertrekgroep heeft een eigen adres */
export const DEPARTURE_PAGES = {
  vrij: { path: "/zonder-vertrektijd", title: "Zonder vertrektijd", tab: "Zonder vertrektijd" },
  uitslapers: { path: "/uitslapers", title: "Voor uitslapers", tab: "Uitslapers" },
  overig: { path: "/overige-plekken", title: "Overige plekken", tab: "Overige" },
} as const;
export type DeparturePage = keyof typeof DEPARTURE_PAGES;

export function pageOf(g?: DepartureGroup): DeparturePage | undefined {
  if (!g) return undefined;
  return OTHER.includes(g as DepartureKind) ? "overig" : (g as DeparturePage);
}

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
  /** Lengtefilter bewust uitgezet (`lengte=0`): dan zet het camperprofiel het niet automatisch aan */
  lengthOff?: boolean;
  /** Vertrekgroep; bepaalt ook op welke pagina je zit (zie DEPARTURE_PAGES) */
  departure?: DepartureGroup;
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
  openNow: false,
  sort: "aanbevolen",
};

type Params = { get(name: string): string | null };

/** Op een vertrekpagina ligt de groep vast via het adres; op Overige kan nog "vroeg" of "onbekend" gekozen worden */
export function withPage(f: Filters, page?: DeparturePage): Filters {
  if (!page) return f;
  if (page === "overig") return { ...f, departure: f.departure && pageOf(f.departure) === "overig" ? f.departure : "overig" };
  return { ...f, departure: page };
}

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
    lengthOff: p.get("lengte") === "0" || undefined,
    departure: parseDeparture(p.get("vertrek")) ?? (p.get("vrij") === "1" ? "vrij" : undefined),
    openNow: p.get("open") === "1",
    minScore: num("score"),
    sort: sort && ["aanbevolen", "afstand", "prijs", "score"].includes(sort) ? sort : "aanbevolen",
  };
}

const DEPARTURE_VALUES: DepartureGroup[] = ["vrij", "uitslapers", "ruim", "vroeg", "onbekend", "overig"];
function parseDeparture(v: string | null): DepartureGroup | undefined {
  return DEPARTURE_VALUES.includes(v as DepartureGroup) ? (v as DepartureGroup) : undefined;
}

/** Query zonder de vertrekgroep zelf: die zit in het pad (alleen ruim, vroeg en onbekend als verfijning op Overige) */
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
  else if (f.lengthOff) p.set("lengte", "0");
  if (f.departure && OTHER.includes(f.departure as DepartureKind)) p.set("vertrek", f.departure);
  if (f.openNow) p.set("open", "1");
  if (f.minScore) p.set("score", String(f.minScore));
  if (f.sort !== "aanbevolen") p.set("sort", f.sort);
  return p.toString();
}

export function searchPath(f: Pick<Filters, "departure">): string {
  const page = pageOf(f.departure);
  return page ? DEPARTURE_PAGES[page].path : "/zoeken";
}

export function searchHref(f: Partial<Filters>): string {
  const full = { ...DEFAULT_FILTERS, ...f };
  const q = filtersToQuery(full);
  return q ? `${searchPath(full)}?${q}` : searchPath(full);
}

/** Aantal actieve verfijningen (zonder bestemming en sortering) */
/** Aantal verfijningen; de vertrekgroep telt niet mee, die is een eigen pagina met tabbladen */
export function refinementCount(f: Filters): number {
  return (
    f.facilities.length +
    f.kinds.length +
    (f.free ? 1 : 0) +
    (f.maxPrice ? 1 : 0) +
    (f.minLength ? 1 : 0) +
    (f.openNow ? 1 : 0) +
    (f.minScore ? 1 : 0)
  );
}

// ── Seizoen ─────────────────────────────────────────────────────────────────

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** Is de plek op `date` open volgens het seizoen? `undefined` = onbekend. */
/** De huidige datum en tijd in Nederland, als lokale Date (de server draait in UTC) */
export function nowInNL(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
}

/**
 * Kun je hier vandaag zeker niet meer aankomen? Alleen als de laatste aankomsttijd bekend is en voorbij is, en de plek
 * niet dag en nacht open is. Onbekend telt niet als dicht (Dichtbij verbergt alleen wat zeker niet meer kan).
 */
export function arrivalClosed(p: Pick<PlaceSummary, "checkinUntil" | "access24h">, now = nowInNL()): boolean {
  if (!p.checkinUntil || p.access24h) return false;
  const [h, m] = p.checkinUntil.split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}

export function isOpenOn(p: Pick<PlaceSummary, "openAllYear" | "season">, date = nowInNL()): boolean | undefined {
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
export function openStatus(p: Pick<PlaceSummary, "openAllYear" | "season">, date = nowInNL()): { open: boolean; label: string } | undefined {
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
  place: PlaceListItem;
  km?: number;
}

// "Aanbevolen": volledigheid van de gegevens, reviews (pas zwaar vanaf 5), een foto, geen vaste vertrektijd (0,3)
// of uitslapen (0,15).
// Bij een bestemming telt de afstand mee. Betaalde plaatsing bestaat niet.
function recommendScore(p: PlaceListItem): number {
  const rating = p.ratingAvg ? (p.ratingAvg / 10) * Math.min(1, p.ratingCount / 5) : 0;
  const kind = departureKind(p);
  // Door beheer bevestigd staat boven een regel die alleen uit de bron komt (+10); zichtbaar verschil is er niet meer
  const confirmed = departureConfirmed(p) ? 10 : 0;
  return confirmed + p.completeness * 2 + rating + (p.imageUrl ? 0.3 : 0) + (kind === "vrij" ? 0.3 : kind === "uitslapers" ? 0.15 : 0);
}

export function applyFilters(places: PlaceListItem[], f: Filters): Result[] {
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
    // "Gratis" en "tot € X" gaan over de nachtprijs van de plek. Alleen een prijs per persoon zegt niet wat je met
    // z'n tweeën betaalt; zo'n plek telt hier als prijs onbekend (wel zichtbaar met "ook onbekende prijs").
    const unknownPriceOk = f.priceUnknown && p.priceEur === undefined;
    if (f.free && p.priceEur !== 0 && !unknownPriceOk) continue;
    if (f.maxPrice && !unknownPriceOk && (p.priceEur === undefined || p.priceEur > f.maxPrice)) continue;
    if (f.minLength && p.maxLengthM !== undefined && p.maxLengthM < f.minLength) continue;
    if (f.departure && !inDepartureGroup(p, f.departure)) continue;
    // "Nu open" verbergt alleen plekken die volgens hun seizoen zeker dicht zijn; onbekend blijft staan
    if (f.openNow && isOpenOn(p, now) === false) continue;
    if (f.minScore && (p.ratingAvg ?? 0) < f.minScore) continue;
    results.push({ place: p, km });
  }

  // De gekozen sortering gaat voor; bij gelijke stand staat bevestigd "geen vaste vertrektijd" eerst
  const byPrice = (a: Result, b: Result) => {
    const [ta, va] = priceRank(a.place);
    const [tb, vb] = priceRank(b.place);
    return ta - tb || va - vb;
  };
  switch (f.sort) {
    case "afstand":
      results = results.sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || confirmedFirst(a.place, b.place));
      break;
    case "prijs":
      results = results.sort((a, b) => byPrice(a, b) || confirmedFirst(a.place, b.place) || recommendScore(b.place) - recommendScore(a.place));
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
export function relaxations(places: PlaceListItem[], f: Filters): { label: string; next: Filters; count: number }[] {
  const options: { label: string; next: Filters }[] = [
    ...f.facilities.map((k) => ({ label: `Zonder "${FACILITIES.find((x) => x.key === k)!.label}"`, next: { ...f, facilities: f.facilities.filter((x) => x !== k) } })),
    ...f.kinds.map((k) => ({ label: `Ook andere soorten dan ${k}`, next: { ...f, kinds: f.kinds.filter((x) => x !== k) } })),
    ...(f.free ? [{ label: "Tot € 10 per nacht", next: { ...f, free: false, maxPrice: 10 } }] : []),
    ...(f.free || f.maxPrice ? [{ label: "Ook met onbekende prijs", next: { ...f, priceUnknown: true } }] : []),
    ...(f.maxPrice ? [{ label: "Zonder prijsgrens", next: { ...f, maxPrice: undefined } }] : []),
    ...(f.minLength ? [{ label: "Zonder lengtefilter", next: { ...f, minLength: undefined, lengthOff: true } }] : []),
    ...(f.departure === "vrij" ? [{ label: "Bekijk uitslapers", next: { ...f, departure: "uitslapers" as const } }] : []),
    ...(f.departure ? [{ label: "Alle vertrektijden", next: { ...f, departure: undefined } }] : []),
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
/** Aantal tikfouten tussen twee woorden (Levenshtein); Infinity zodra het meer dan `max` wordt */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return Infinity;
    prev = cur;
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity;
}

export function closeEnough(a: string, b: string, max = 2): boolean {
  return editDistance(a, b, max) <= max;
}
