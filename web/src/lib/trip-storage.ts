// Hoe Mijn reis op dit toestel wordt opgeslagen. Met een versienummer, zodat een latere vorm oude opslag kan omzetten.
//
// Versie 1 (tot november 2026): een losse lijst `[{ slug, nights }]`, zonder controle op het aantal nachten.
// Versie 2: `{ v: 2, stops: [{ slug, nights }] }`; nachten heel, 1 tot en met 21 (standaard 1), elke plek één keer.
// Versie 3 (november 2026): ook 0 nachten (tussenstop) en een notitie per stop. In versie 1 en 2 bestond 0 niet;
// een 0 uit die opslag wordt 1.
import { clampNights, cleanNote, MAX_NIGHTS, MIN_NIGHTS, mergeTrips, type Stop } from "./trip-merge";
import type { PlaceSummary } from "./types";

export const TRIP_VERSION = 3;
export { clampNights, MAX_NIGHTS, MIN_NIGHTS };

/** Opgeslagen reis (elke versie) naar een nette lijst stops; undefined als het geen reis is */
export function decodeTrip(stored: unknown): Stop[] | undefined {
  // Vóór versie 3 bestond een tussenstop niet: 0 nachten wordt dan 1
  const legacy = (list: unknown[]) => list.map((s) => (typeof s === "object" && s !== null && Number((s as Stop).nights) === 0 ? { ...(s as Stop), nights: 1 } : s));
  // Versie 1: de lijst zelf
  if (Array.isArray(stored)) return mergeTrips([], legacy(stored));
  if (typeof stored === "object" && stored !== null && Array.isArray((stored as { stops?: unknown }).stops)) {
    const { v, stops } = stored as { v?: unknown; stops: unknown[] };
    // Versie 2 of 3, of een latere versie met dezelfde lijst: alleen de stops gebruiken we
    return mergeTrips([], typeof v === "number" && v >= 3 ? stops : legacy(stops));
  }
  return undefined;
}

export function encodeTrip(stops: Stop[]): { v: typeof TRIP_VERSION; stops: Stop[] } {
  return { v: TRIP_VERSION, stops: stops.map((s) => {
    const note = cleanNote(s.note);
    return note ? { slug: s.slug, nights: clampNights(s.nights), note } : { slug: s.slug, nights: clampNights(s.nights) };
  }) };
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
