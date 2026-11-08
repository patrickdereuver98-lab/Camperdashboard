// Dichtbij: welke plekken om je heen passen bij je keuzes, en wat je kunt aanpassen als er niets past (review R51).
import { distanceKm, type LatLng } from "./geo";
import { applyFilters, arrivalClosed, confirmedFirst, DEFAULT_FILTERS, FACILITIES, nowInNL, relaxations, type FacilityKey, type Filters } from "./search";
import { pluralize } from "./format";
import type { PlaceSummary } from "./types";
import { applyVehicle, type Vehicle } from "./vehicle";

export type NearbyChoices = {
  facilities: FacilityKey[];
  /** Verbergt alleen plekken die nu zeker dicht zijn (seizoen voorbij) */
  openNow: boolean;
  /** Verbergt alleen plekken waar de laatste aankomsttijd van vandaag voorbij is */
  arriveNow: boolean;
  departure?: "vrij" | "uitslapers";
  /** Filter op de lengte uit Mijn camper uitgezet */
  lengthOff: boolean;
  /** Alleen plekken met een bekende rijtijd van hooguit 30 minuten */
  within30: boolean;
};

export const NEARBY_DEFAULTS: NearbyChoices = { facilities: [], openNow: true, arriveNow: true, lengthOff: false, within30: false };
export const NEARBY_RADIUS_KM = 80;
export const NEARBY_MAX = 30;
export const WITHIN_SECONDS = 30 * 60;

export type Near = { place: PlaceSummary; km: number };
export type Drive = { km: number; seconds: number };

export function nearbyFilters(c: NearbyChoices, vehicle: Vehicle): Filters {
  return applyVehicle({ ...DEFAULT_FILTERS, facilities: c.facilities, openNow: c.openNow, departure: c.departure, lengthOff: c.lengthOff || undefined }, vehicle);
}

/** Plekken binnen 80 km die bij de keuzes passen, dichtstbij (hemelsbreed) eerst; zonder `max` allemaal */
export function nearestPlaces(places: PlaceSummary[], pos: LatLng, c: NearbyChoices, vehicle: Vehicle, now: Date = nowInNL(), max = NEARBY_MAX): Near[] {
  return applyFilters(places, nearbyFilters(c, vehicle), now)
    .filter((r) => !c.arriveNow || !arrivalClosed(r.place, now))
    .map((r) => ({ place: r.place, km: distanceKm(pos, r.place) }))
    .filter((r) => r.km < NEARBY_RADIUS_KM)
    .sort((a, b) => a.km - b.km || confirmedFirst(a.place, b.place))
    .slice(0, max);
}

/**
 * "Binnen 30 min": alleen plekken met een berekende rijtijd tot 30 minuten. Een plek zonder rijtijd valt dan weg,
 * want we weten niet dat hij binnen 30 minuten ligt. Zonder rijtijden (nog bezig of mislukt) blijft de lijst heel.
 */
export function withinDrive<T extends { place: Pick<PlaceSummary, "slug"> }>(list: T[], drives: Record<string, Drive> | null, on: boolean): T[] {
  if (!on || !drives) return list;
  return list.filter((r) => (drives[r.place.slug]?.seconds ?? Infinity) <= WITHIN_SECONDS);
}

export type Suggestion = { label: string; next: NearbyChoices; count?: number };

/**
 * Wat je met één aanpassing wel vindt. Gebruikt `relaxations()` van Zoeken over de plekken binnen 80 km, plus de
 * twee keuzes die alleen Dichtbij kent (nu nog aankomen, binnen 30 minuten). `farther`: hoeveel plekken "Binnen 30 min"
 * nu wegfiltert. Het aantal staat erbij behalve als "Binnen 30 min" aan blijft: dan zegt een telling op 80 km te weinig.
 */
export function nearbySuggestions(
  places: PlaceSummary[],
  pos: LatLng,
  c: NearbyChoices,
  vehicle: Vehicle,
  { now = nowInNL(), farther = 0, limit = 4 }: { now?: Date; farther?: number; limit?: number } = {},
): Suggestion[] {
  const around = places.filter((p) => distanceKm(pos, p) < NEARBY_RADIUS_KM && (!c.arriveNow || !arrivalClosed(p, now)));
  const out: (Suggestion & { count: number })[] = relaxations(around, nearbyFilters(c, vehicle)).map((r) => ({
    label: r.label,
    count: r.count,
    next: fromFilters(c, r.next),
  }));
  if (c.arriveNow) {
    const next = { ...c, arriveNow: false };
    const count = nearestPlaces(places, pos, next, vehicle, now, Infinity).length;
    if (count > 0) out.push({ label: "Ook waar je nu niet meer binnenkomt", next, count });
  }
  out.sort((a, b) => b.count - a.count);
  const list: Suggestion[] = out.map((s) => (c.within30 ? { label: s.label, next: s.next } : s));
  if (c.within30 && farther > 0) list.unshift({ label: "Ook verder dan 30 minuten", next: { ...c, within30: false }, count: farther });
  return list.slice(0, limit);
}

/** Een versoepeld filter van Zoeken terug naar de keuzes van Dichtbij */
function fromFilters(c: NearbyChoices, f: Filters): NearbyChoices {
  return {
    ...c,
    facilities: f.facilities,
    openNow: f.openNow,
    departure: f.departure === "vrij" || f.departure === "uitslapers" ? f.departure : undefined,
    lengthOff: c.lengthOff || !!f.lengthOff,
  };
}

/** Zonder rijtijden geldt een plek verder dan dit (hemelsbreed) als ver weg */
export const CLOSE_KM = 25;

/**
 * Ligt de dichtstbijzijnde plek ver weg? Met rijtijden: geen enkele plek in de lijst binnen 30 minuten ("rijtijd").
 * Zonder rijtijden (of zonder rijtijd voor een plek): de dichtste plek verder dan 25 km hemelsbreed ("hemelsbreed").
 * Anders, en bij een lege lijst, `false`.
 */
export function nearestIsFar(list: Near[], drives: Record<string, Drive> | null): "rijtijd" | "hemelsbreed" | false {
  if (!list.length) return false;
  const known = drives ? list.map((r) => drives[r.place.slug]?.seconds).filter((t): t is number => t != null) : [];
  if (known.length) return Math.min(...known) > WITHIN_SECONDS ? "rijtijd" : false;
  return Math.min(...list.map((r) => r.km)) > CLOSE_KM ? "hemelsbreed" : false;
}

/**
 * Er zijn plekken, maar de dichtste ligt ver weg: welke ene aanpassing levert een plek dichterbij op? Telt alleen
 * plekken die hemelsbreed dichterbij liggen dan de dichtste nu én binnen 25 km. Rijtijden van die plekken kennen we
 * nog niet, dus het voorstel zegt "dichterbij" (hemelsbreed) en noemt geen minuten.
 */
export function closerSuggestions(
  places: PlaceSummary[],
  pos: LatLng,
  c: NearbyChoices,
  vehicle: Vehicle,
  nearestKm: number,
  { now = nowInNL(), limit = 2 }: { now?: Date; limit?: number } = {},
): Suggestion[] {
  const maxKm = Math.min(CLOSE_KM, nearestKm);
  const close = places.filter((p) => distanceKm(pos, p) < maxKm);
  const out: { label: string; next: NearbyChoices; count: number }[] = relaxations(
    close.filter((p) => !c.arriveNow || !arrivalClosed(p, now)),
    nearbyFilters(c, vehicle),
  ).map((r) => ({ label: r.label, count: r.count, next: fromFilters(c, r.next) }));
  if (c.arriveNow) {
    const next = { ...c, arriveNow: false };
    const count = nearestPlaces(close, pos, next, vehicle, now, Infinity).length;
    if (count > 0) out.push({ label: "Ook waar je nu niet meer binnenkomt", next, count });
  }
  return out
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((s) => ({ label: `${s.label}: ${pluralize(s.count, "plek", "plekken")} dichterbij`, next: s.next, count: s.count }));
}

/** De keuzes die nu iets wegfilteren, in de volgorde van de chips */
export function activeFilterLabels(c: NearbyChoices, vehicle: Vehicle): string[] {
  return [
    c.openNow && "Nu open",
    c.arriveNow && "Nu nog aankomen",
    c.within30 && "Binnen 30 min",
    vehicle.lengthM && !c.lengthOff && "Mijn camper",
    c.departure === "vrij" && "Zonder vertrektijd",
    c.departure === "uitslapers" && "Uitslapers",
    ...FACILITIES.filter((f) => c.facilities.includes(f.key)).map((f) => f.label),
  ].filter((x): x is string => !!x);
}

/** "Wis filters": alles uit, ook de keuzes die standaard aan staan */
export function clearedChoices(vehicle: Vehicle): NearbyChoices {
  return { facilities: [], openNow: false, arriveNow: false, departure: undefined, lengthOff: !!vehicle.lengthM, within30: false };
}
