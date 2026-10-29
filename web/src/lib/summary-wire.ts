import type { PlaceSummary } from "./types";

/**
 * Compact formaat voor `/api/places?f=compact` (verbeterplan F2). Kolommen in plaats van een object per plek,
 * herhaalde teksten in een woordenlijst, ja/nee als 1/0, coördinaten op 5 decimalen (±1 m), geen id, en de fotobron
 * weggelaten als die gelijk is aan de domeinnaam van de foto. Gemeten op 680 plekken: 31% kleiner met brotli, 33% met
 * gzip. `decodeSummaries` geeft dezelfde plekken terug (zonder id); er wordt niets bijgevuld.
 */
export interface SummaryWire {
  v: 1;
  /** Kolomnamen in de volgorde van elke rij */
  k: (keyof PlaceSummary)[];
  /** Woordenlijst per kolom met herhaalde teksten; de rij bevat dan de index */
  d: Partial<Record<keyof PlaceSummary, string[]>>;
  r: unknown[][];
}

const DICT: (keyof PlaceSummary)[] = [
  "kind",
  "town",
  "province",
  "departure",
  "departureCheck",
  "season",
  "checkoutUntil",
  "checkinFrom",
  "checkinUntil",
  "accessHours",
  "imageCredit",
];

/** In de kolom imageCredit: de bron is de domeinnaam van de foto (zonder www.) */
const SAME_HOST = -1;

export function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

export function encodeSummaries(places: PlaceSummary[]): SummaryWire {
  // Zonder id: een uuid laat zich niet inpakken en was een derde van de verpakte grootte
  const keys = [...new Set(places.flatMap((p) => Object.keys(p)))].filter((k) => k !== "id") as (keyof PlaceSummary)[];
  const dicts: Partial<Record<keyof PlaceSummary, string[]>> = {};
  const index: Partial<Record<keyof PlaceSummary, Map<string, number>>> = {};
  for (const k of DICT) {
    dicts[k] = [];
    index[k] = new Map();
  }
  const rows = places.map((p) => {
    const row = keys.map((k) => {
      const v = p[k];
      if (v === undefined || v === null) return null;
      if (k === "lat" || k === "lng") return round5(v as number);
      if (typeof v === "boolean") return v ? 1 : 0;
      if (k === "imageCredit" && v === hostOf(p.imageUrl)) return SAME_HOST;
      const map = index[k];
      if (map && typeof v === "string") {
        let i = map.get(v);
        if (i === undefined) {
          i = dicts[k]!.push(v) - 1;
          map.set(v, i);
        }
        return i;
      }
      return v;
    });
    while (row.length && row[row.length - 1] === null) row.pop();
    return row;
  });
  for (const k of DICT) if (!dicts[k]!.length) delete dicts[k];
  return { v: 1, k: keys, d: dicts, r: rows };
}

/** Ja/nee-kolommen: die komen als 1/0 en moeten weer true/false worden */
const BOOL = new Set<keyof PlaceSummary>([
  "priceFrom",
  "touristTaxIncluded",
  "power",
  "water",
  "dumpStation",
  "toilet",
  "shower",
  "wifi",
  "dogs",
  "openAllYear",
  "access24h",
]);

export function decodeSummaries(wire: SummaryWire): PlaceSummary[] {
  return wire.r.map((row) => {
    const p: Record<string, unknown> = {};
    wire.k.forEach((k, i) => {
      const v = row[i];
      if (v === null || v === undefined) return;
      if (BOOL.has(k)) p[k] = v === 1;
      else if (k === "imageCredit" && v === SAME_HOST) p[k] = SAME_HOST;
      else if (wire.d[k] && typeof v === "number") p[k] = wire.d[k]![v];
      else p[k] = v;
    });
    // Pas na de hele rij: de kolom met de foto kan na de bron staan
    if (p.imageCredit === SAME_HOST) p.imageCredit = hostOf(p.imageUrl as string | undefined);
    return p as PlaceSummary;
  });
}
