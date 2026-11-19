// Hoe Mijn reis op dit toestel wordt opgeslagen. Met een versienummer, zodat een latere vorm oude opslag kan omzetten.
//
// Versie 1 (tot november 2026): een losse lijst `[{ slug, nights }]`, zonder controle op het aantal nachten.
// Versie 2: `{ v: 2, stops: [{ slug, nights }] }`; nachten heel, 1 tot en met 21 (standaard 1), elke plek één keer.
// Versie 3 (november 2026): ook 0 nachten (tussenstop) en een notitie per stop (`note`). In versie 1 en 2 bestond 0
// niet; een 0 uit die opslag wordt 1.
// Versie 4 (19 november 2026): meerdere reizen naast elkaar, alleen op dit toestel:
//   `{ v: 4, active, trips: [{ id, name, stops }] }`. Een stop kan een eigen punt zijn (`point`), en heeft een lijst
//   notities (`notes`, standaard privé). Oude opslag wordt de eerste reis ("Mijn reis"); de oude notitie wordt een
//   privénotitie.
import { clampNights, MAX_NIGHTS, MIN_NIGHTS, mergeTrips, randomKey, type Stop } from "./trip-merge";
import type { PlaceSummary } from "./types";

export const TRIP_VERSION = 4;
/** Versie van de kopie van de plekgegevens (`vrijstaan:reis-plekken`); staat los van de versie van de reis */
export const TRIP_PLACES_VERSION = 3;
export const MAX_TRIPS = 20;
export const MAX_TRIP_NAME = 60;
export const DEFAULT_TRIP_NAME = "Mijn reis";
/** Sleutel van de eerste reis bij het omzetten van oude opslag */
export const FIRST_TRIP_ID = "reis-1";
export { clampNights, MAX_NIGHTS, MIN_NIGHTS };

export type Trip = { id: string; name: string; stops: Stop[] };
export type TripList = { active: string; trips: Trip[] };

const TRIP_ID = /^[a-z0-9-]{1,40}$/;

export const newTripId = () => `reis-${randomKey(8)}`;

/** Naam van een reis: ingekort, en leeg wordt "Mijn reis" */
export function cleanTripName(v: unknown): string {
  const name = typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, MAX_TRIP_NAME) : "";
  return name || DEFAULT_TRIP_NAME;
}

/** Opgeslagen reis van versie 1 tot en met 3 naar een nette lijst stops; undefined als het geen reis is */
export function decodeTrip(stored: unknown): Stop[] | undefined {
  // Vóór versie 3 bestond een tussenstop niet: 0 nachten wordt dan 1
  const legacy = (list: unknown[]) => list.map((s) => (typeof s === "object" && s !== null && Number((s as Stop).nights) === 0 ? { ...(s as Stop), nights: 1 } : s));
  // Versie 1: de lijst zelf
  if (Array.isArray(stored)) return mergeTrips(legacy(stored), []);
  if (typeof stored === "object" && stored !== null && Array.isArray((stored as { stops?: unknown }).stops)) {
    const { v, stops } = stored as { v?: unknown; stops: unknown[] };
    return mergeTrips(typeof v === "number" && v >= 3 ? stops : legacy(stops), []);
  }
  return undefined;
}

export const emptyTripList = (): TripList => ({ active: FIRST_TRIP_ID, trips: [{ id: FIRST_TRIP_ID, name: DEFAULT_TRIP_NAME, stops: [] }] });

/** Opgeslagen reizen (elke versie) naar een nette lijst met minstens één reis; undefined als het geen reis is */
export function decodeTrips(stored: unknown): TripList | undefined {
  if (typeof stored === "object" && stored !== null && !Array.isArray(stored) && Array.isArray((stored as { trips?: unknown }).trips)) {
    const o = stored as { active?: unknown; trips: unknown[] };
    const trips: Trip[] = [];
    const ids = new Set<string>();
    for (const t of o.trips) {
      if (typeof t !== "object" || t === null) continue;
      const r = t as Record<string, unknown>;
      let id = typeof r.id === "string" && TRIP_ID.test(r.id) ? r.id : newTripId();
      if (ids.has(id)) id = newTripId();
      ids.add(id);
      trips.push({ id, name: cleanTripName(r.name), stops: mergeTrips(Array.isArray(r.stops) ? r.stops : [], []) });
      if (trips.length >= MAX_TRIPS) break;
    }
    if (!trips.length) return emptyTripList();
    const active = typeof o.active === "string" && ids.has(o.active) ? o.active : trips[0].id;
    return { active, trips };
  }
  // Versie 1 tot en met 3: één reis, die wordt de eerste
  const stops = decodeTrip(stored);
  if (!stops) return undefined;
  return { active: FIRST_TRIP_ID, trips: [{ id: FIRST_TRIP_ID, name: DEFAULT_TRIP_NAME, stops }] };
}

export function encodeTrips(list: TripList): { v: typeof TRIP_VERSION; active: string; trips: Trip[] } {
  return {
    v: TRIP_VERSION,
    active: list.active,
    trips: list.trips.map((t) => ({ id: t.id, name: cleanTripName(t.name), stops: mergeTrips(t.stops, []) })),
  };
}

/** De reis die nu open staat */
export const activeTrip = (list: TripList): Trip => list.trips.find((t) => t.id === list.active) ?? list.trips[0];

// ── Kopie van de plekgegevens, voor Mijn reis zonder bereik ─────────────────

export type TripPlacesCopy = {
  places: PlaceSummary[];
  /** Wanneer deze gegevens van de server kwamen (ISO); null bij oude opslag zonder datum */
  savedAt: string | null;
};

/** Versie 1 was een losse lijst plekken zonder datum; daarna `{ v, savedAt, places }` */
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
  return { v: TRIP_PLACES_VERSION, savedAt, places: places.filter((p) => wanted.has(p.slug)) };
}

// ── Bewerkingen op de lijst met reizen (puur; store.ts schrijft het resultaat weg) ──

export type RemovedTrip = { trip: Trip; index: number; wasActive: boolean };

/** Nieuwe reis achteraan, en meteen open; undefined als er al MAX_TRIPS zijn */
export function addTrip(list: TripList, name: string, stops: Stop[] = [], id: string = newTripId()): TripList | undefined {
  if (list.trips.length >= MAX_TRIPS) return undefined;
  return { active: id, trips: [...list.trips, { id, name: cleanTripName(name), stops: mergeTrips(stops, []) }] };
}

export const renameTrip = (list: TripList, id: string, name: string): TripList => ({
  ...list,
  trips: list.trips.map((t) => (t.id === id ? { ...t, name: cleanTripName(name) } : t)),
});

export const selectTrip = (list: TripList, id: string): TripList => (list.trips.some((t) => t.id === id) ? { ...list, active: id } : list);

/**
 * Reis verwijderen. Was hij open, dan gaat de reis ervoor open (of de nieuwe eerste). De laatste reis blijft altijd
 * bestaan: die wordt leeggemaakt.
 */
export function deleteTrip(list: TripList, id: string): { list: TripList; removed: RemovedTrip } | undefined {
  const index = list.trips.findIndex((t) => t.id === id);
  if (index < 0) return undefined;
  const trip = list.trips[index];
  const wasActive = activeTrip(list).id === id;
  const removed = { trip, index, wasActive };
  if (list.trips.length === 1) return { list: { active: id, trips: [{ ...trip, stops: [] }] }, removed };
  const trips = list.trips.filter((t) => t.id !== id);
  return { list: { active: wasActive ? trips[Math.max(0, index - 1)].id : list.active, trips }, removed };
}

/** Verwijderde reis terugzetten op dezelfde plaats ("Ongedaan maken") */
export function restoreTrip(list: TripList, r: RemovedTrip): TripList {
  // Intussen weer 20 reizen: niet terugzetten, anders valt er een andere reis weg
  if (list.trips.length >= MAX_TRIPS && !list.trips.some((t) => t.id === r.trip.id)) return list;
  const rest = list.trips.filter((t) => t.id !== r.trip.id);
  const trips = [...rest.slice(0, r.index), r.trip, ...rest.slice(r.index)];
  return { active: r.wasActive ? r.trip.id : list.active, trips };
}

/** Stops van één reis vervangen (opgeschoond); onbekende reis: niets */
export const setTripStops = (list: TripList, id: string, stops: Stop[]): TripList => ({
  ...list,
  trips: list.trips.map((t) => (t.id === id ? { ...t, stops: mergeTrips(stops, []) } : t)),
});
