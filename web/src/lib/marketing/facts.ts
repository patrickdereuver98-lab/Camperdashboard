/**
 * Feitenbank (plan §3.1): de cijfers uit public.marketing_facts() die content mag gebruiken. Pure functies, zodat
 * de contentcontrole en de sjablonen ze ook in tests en in de GitHub Action kunnen gebruiken.
 */

export type Facts = {
  measured_at: string;
  places: number;
  provinces: { province: string; places: number }[];
  departure: { known: number; vrij: number; uitslapers: number; ruim: number; vroeg: number };
  price: { known: number; free: number; median: number | null };
  facilities: { power: number; water: number; dump: number; dogs: number };
  new_7d: number;
  new_30d: number;
  checked_30d: number;
  reviews: { count: number; avg: number | null };
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : 0);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

/** JSON uit de database veilig omzetten; ontbrekende velden worden 0 (nooit een verzonnen getal) */
export function parseFacts(raw: unknown): Facts | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const o = (k: string) => (r[k] && typeof r[k] === "object" ? (r[k] as Record<string, unknown>) : {});
  return {
    measured_at: typeof r.measured_at === "string" ? r.measured_at : new Date(0).toISOString(),
    places: num(r.places),
    provinces: Array.isArray(r.provinces)
      ? r.provinces
          .filter((p): p is { province: string; places: unknown } => !!p && typeof p === "object" && typeof (p as { province?: unknown }).province === "string")
          .map((p) => ({ province: p.province, places: num(p.places) }))
      : [],
    departure: { known: num(o("departure").known), vrij: num(o("departure").vrij), uitslapers: num(o("departure").uitslapers), ruim: num(o("departure").ruim), vroeg: num(o("departure").vroeg) },
    price: { known: num(o("price").known), free: num(o("price").free), median: numOrNull(o("price").median) },
    facilities: { power: num(o("facilities").power), water: num(o("facilities").water), dump: num(o("facilities").dump), dogs: num(o("facilities").dogs) },
    new_7d: num(r.new_7d),
    new_30d: num(r.new_30d),
    checked_30d: num(r.checked_30d),
    reviews: { count: num(o("reviews").count), avg: numOrNull(o("reviews").avg) },
  };
}

/** "2.186" */
export const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(n);

/** "2 november 2026" */
export const factDate = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });

/**
 * Drempel voor publieke cijfers (plan O5): een klein aantal klinkt in een advertentie al snel als overdrijving of als
 * gebrek. Onder de drempel noemen we de functie, niet het aantal.
 */
export const PUBLIC_MIN = 50;

export type FactLine = { key: string; label: string; value: number; text: string; public: boolean };

/** De feiten als regels, voor het overzicht, de prompt en de sjablonen */
export function factLines(f: Facts): FactLine[] {
  const lines: Omit<FactLine, "public">[] = [
    { key: "places", label: "Camperplaatsen", value: f.places, text: `${nl(f.places)} camperplaatsen in Nederland` },
    { key: "provinces", label: "Provincies", value: f.provinces.length, text: `in ${nl(f.provinces.length)} provincies` },
    { key: "departure_known", label: "Met bekende vertrektijd", value: f.departure.known, text: `${nl(f.departure.known)} plekken met bekende vertrektijd` },
    { key: "uitslapers", label: "Vertrek 12:00 of later", value: f.departure.uitslapers, text: `${nl(f.departure.uitslapers)} plekken waar je tot 12:00 of later mag blijven` },
    { key: "vrij", label: "Geen vaste vertrektijd", value: f.departure.vrij, text: `${nl(f.departure.vrij)} plekken zonder vaste vertrektijd` },
    { key: "price_known", label: "Met prijs", value: f.price.known, text: `${nl(f.price.known)} plekken met prijs` },
    { key: "free", label: "Gratis", value: f.price.free, text: `${nl(f.price.free)} gratis plekken` },
    { key: "power", label: "Met stroom", value: f.facilities.power, text: `${nl(f.facilities.power)} plekken met stroom` },
    { key: "dogs", label: "Honden welkom", value: f.facilities.dogs, text: `${nl(f.facilities.dogs)} plekken waar honden welkom zijn` },
    { key: "checked_30d", label: "Gecontroleerd (30 dagen)", value: f.checked_30d, text: `${nl(f.checked_30d)} plekken de afgelopen maand gecontroleerd` },
    { key: "new_30d", label: "Nieuw (30 dagen)", value: f.new_30d, text: `${nl(f.new_30d)} nieuwe plekken deze maand` },
  ];
  return lines.map((l) => ({ ...l, public: l.key === "provinces" ? l.value > 0 : l.value >= PUBLIC_MIN }));
}

/**
 * Vaste getallen uit de app, alleen in hun eigen patroon (DATA-15): de vertrektijden 11:00 en 12:00, "2 personen"
 * (de standaardsituatie van de prijs) en "24 uur". Een losse "2" of "12" ("12 gratis plekken") is geen vast getal.
 */
export const FIXED_NUMBER_PATTERNS: RegExp[] = [
  /(?<![\w.,:])(?:11|12)[:.]00(?![\d:])/g,
  /(?<![\w.,])2 (?:personen|volwassenen)\b/gi,
  /(?<![\w.,])24 uur\b/gi,
];

/** Tekst zonder de vaste patronen, zodat alleen de overige getallen tegen de feitenbank worden gecontroleerd */
export function maskFixedNumbers(text: string): string {
  return FIXED_NUMBER_PATTERNS.reduce((t, re) => t.replace(re, " "), text);
}

/**
 * Alle getallen die in content mogen staan: de feiten zelf. Met `text` ook de vaste getallen (2, 11, 12, 24), maar
 * alleen als ze in die tekst uitsluitend in hun vaste patroon staan (12:00, 2 personen, 24 uur); een losse "12"
 * ernaast maakt ze niet toegestaan. Zonder `text`: zoals vroeger, met de vaste getallen (voor bestaande aanroepers).
 * Beter: controleer `maskFixedNumbers(text)` tegen `allowedNumbers(f, "")`.
 */
export function allowedNumbers(f: Facts, text?: string): Set<number> {
  const set = new Set<number>(text === undefined ? [2, 11, 12, 24] : fixedNumbersAllowed(text));
  for (const l of factLines(f)) if (l.public) set.add(l.value);
  for (const p of f.provinces) if (p.places >= PUBLIC_MIN) set.add(p.places);
  if (f.price.median !== null) set.add(f.price.median);
  if (f.reviews.avg !== null && f.reviews.count >= PUBLIC_MIN) set.add(f.reviews.avg);
  return set;
}

/** De vaste getallen die in `text` alleen in hun patroon voorkomen (staat er ook een losse "12", dan niet 12) */
function fixedNumbersAllowed(text: string): number[] {
  const loose = new Set<number>();
  for (const m of maskFixedNumbers(text).matchAll(/(?<![\w.,])(\d+)(?![.,]?\d)/g)) loose.add(Number(m[1]));
  const inPattern = new Set<number>();
  for (const re of FIXED_NUMBER_PATTERNS) for (const m of text.matchAll(re)) inPattern.add(Number(/\d+/.exec(m[0])![0]));
  return [...inPattern].filter((n) => !loose.has(n));
}
