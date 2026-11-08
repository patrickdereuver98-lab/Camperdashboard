// Hoe Mijn reis op dit toestel wordt opgeslagen. Met een versienummer, zodat een latere vorm oude opslag kan omzetten.
//
// Versie 1 (tot november 2026): een losse lijst `[{ slug, nights }]`, zonder controle op het aantal nachten.
// Versie 2: `{ v: 2, stops: [{ slug, nights }] }`; nachten heel, 1 tot en met 21 (standaard 1), elke plek één keer.
import { mergeTrips, type Stop } from "./trip-merge";
import type { PlaceSummary } from "./types";

export const TRIP_VERSION = 2;
export const MIN_NIGHTS = 1;
export const MAX_NIGHTS = 21;

/** Aantal nachten begrenzen: heel getal van 1 tot en met 21, en 1 als het geen getal is */
export function clampNights(n: unknown): number {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return MIN_NIGHTS;
  return Math.max(MIN_NIGHTS, Math.min(MAX_NIGHTS, x));
}

/** Opgeslagen reis (elke versie) naar een nette lijst stops; undefined als het geen reis is */
export function decodeTrip(stored: unknown): Stop[] | undefined {
  // Versie 1: de lijst zelf
  if (Array.isArray(stored)) return mergeTrips([], stored);
  if (typeof stored === "object" && stored !== null && Array.isArray((stored as { stops?: unknown }).stops)) {
    // Versie 2, of een latere versie met dezelfde lijst: alleen de stops gebruiken we
    return mergeTrips([], (stored as { stops: unknown[] }).stops);
  }
  return undefined;
}

export function encodeTrip(stops: Stop[]): { v: typeof TRIP_VERSION; stops: Stop[] } {
  return { v: TRIP_VERSION, stops: stops.map((s) => ({ slug: s.slug, nights: clampNights(s.nights) })) };
}

// ── Kopie van de plekgegevens, voor Mijn reis zonder bereik ─────────────────

export type TripPlacesCopy = {
  places: PlaceSummary[];
  /** Wanneer deze gegevens van de server kwamen (ISO); null bij oude opslag zonder datum */
  savedAt: string | null;
};

/** Versie 1 was een losse lijst plekken zonder datum; versie 2 `{ v: 2, savedAt, places }` */
export function decodeTripPlaces(stored: unknown): TripPlacesCopy {
  if (Array.isArray(stored)) return { places: stored as PlaceSummary[], savedAt: null };
  if (typeof stored === "object" && stored !== null) {
    const o = stored as { places?: unknown; savedAt?: unknown };
    if (Array.isArray(o.places)) {
      const ok = typeof o.savedAt === "string" && !Number.isNaN(Date.parse(o.savedAt));
      return { places: o.places as PlaceSummary[], savedAt: ok ? (o.savedAt as string) : null };
    }
  }
  return { places: [], savedAt: null };
}

export function encodeTripPlaces(places: PlaceSummary[], slugs: string[], savedAt: string) {
  const wanted = new Set(slugs);
  return { v: TRIP_VERSION, savedAt, places: places.filter((p) => wanted.has(p.slug)) };
}
