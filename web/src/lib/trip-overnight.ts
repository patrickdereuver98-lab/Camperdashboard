// Overnachten voorstellen als een reisdag te lang wordt (besluit 19 november 2026). Alleen plekken uit onze eigen data,
// rond het punt op de route waar je de rijtijd van die dag hebt opgemaakt; plekken zonder vaste vertrektijd eerst.
// Dit zijn alleen voorstellen: toevoegen doet de bezoeker zelf. Rekent in de browser, met de routelijn die er al is.
import type { LatLng } from "./geo";
import { placesAlongRoute, type CorridorHit } from "./route-corridor";
import { departureKind } from "./search";
import type { LegPlan } from "./trip-plan";
import type { PlaceSummary } from "./types";

export const MAX_SUGGESTIONS = 3;
/** Strook langs de route: eerst smal, en breder als er te weinig plekken liggen */
export const OVERNIGHT_WIDTHS_KM = [5, 10] as const;
/** Zoveel km vóór het punt waar de dag vol is mag een voorstel liggen, en zoveel erna */
export const WINDOW_BEFORE_KM = 60;
export const WINDOW_AFTER_KM = 15;

type Pt = [lng: number, lat: number];

/**
 * Op welke etappes de dag vol raakt: de etappes boven je grens, maar per dag alleen de eerste (rijd je na een
 * tussenstop verder, dan is de volgende etappe op die dag ook te lang; daar stellen we niets dubbel voor).
 * Geeft de posities in `legs` terug.
 */
export function fullDayLegs(legs: (LegPlan | undefined)[]): number[] {
  const out: number[] = [];
  const days = new Set<number>();
  legs.forEach((l, i) => {
    if (!l?.overLimit || days.has(l.day)) return;
    days.add(l.day);
    out.push(i);
  });
  return out;
}

/**
 * Hoe ver in de etappe (0 tot 1) de dag vol is: wat er van je rijtijd per dag over was bij het begin van deze etappe,
 * gedeeld door de rijtijd van de etappe (met pauzes). Undefined als de etappe niet te lang is of geen grens geldt.
 */
export function dayFullFraction(lp: LegPlan, maxDriveMin: number): number | undefined {
  if (!lp.overLimit || maxDriveMin <= 0) return undefined;
  const legMin = lp.driveMin + lp.pauseMin;
  if (legMin <= 0) return undefined;
  const before = lp.dayDriveMin - legMin;
  return Math.max(0, Math.min(1, (maxDriveMin - before) / legMin));
}

type SuggestPlace = LatLng & Pick<PlaceSummary, "slug" | "departure" | "checkoutUntil" | "departureCheck">;

/** 0 = geen vaste vertrektijd (bevestigd), 1 = onbekend, 2 = vaste vertrektijd */
export function departureRank(p: Pick<PlaceSummary, "departure" | "checkoutUntil" | "departureCheck">): number {
  const k = departureKind(p);
  return k === "vrij" ? 0 : k === "onbekend" ? 1 : 2;
}

/**
 * Hoogstens drie plekken rond `fullKm` (km vanaf het begin van de route) op etappe `leg`: tussen WINDOW_BEFORE_KM
 * ervoor en WINDOW_AFTER_KM erna. Plekken zonder vaste vertrektijd eerst, dan onbekend, dan met vaste vertrektijd;
 * daarbinnen het dichtst bij het punt. Begint smal (5 km van de route) en zoekt breder (10 km) als dat te weinig geeft.
 */
export function pickOvernight<T extends SuggestPlace>(
  hitsByWidth: CorridorHit<T>[][],
  leg: number,
  fullKm: number,
  limit = MAX_SUGGESTIONS,
): CorridorHit<T>[] {
  let best: CorridorHit<T>[] = [];
  for (const hits of hitsByWidth) {
    const near = hits
      .filter((h) => h.leg === leg && h.alongKm >= fullKm - WINDOW_BEFORE_KM && h.alongKm <= fullKm + WINDOW_AFTER_KM)
      .sort((a, b) => departureRank(a.item) - departureRank(b.item) || Math.abs(a.alongKm - fullKm) - Math.abs(b.alongKm - fullKm) || a.offKm - b.offKm)
      .slice(0, limit);
    best = near;
    if (near.length >= limit) break;
  }
  return best;
}

/** Alleen plekken binnen het kader van de route (plus marge): scheelt rekenwerk bij duizenden plekken */
export function nearRoute<T extends LatLng>(geometry: Pt[], items: T[], marginKm = 12): T[] {
  if (!geometry.length) return [];
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of geometry) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  const dLat = marginKm / 111;
  const dLng = marginKm / (111 * Math.max(0.2, Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))));
  return items.filter((p) => p.lat >= minLat - dLat && p.lat <= maxLat + dLat && p.lng >= minLng - dLng && p.lng <= maxLng + dLng);
}

export interface OvernightInput<T extends SuggestPlace> {
  geometry: Pt[];
  waypoints: LatLng[];
  /** Km langs de route waar elke etappe begint (`legStartKm`) */
  legStarts: number[];
  /** Plekken uit onze data die niet al in de reis staan */
  places: T[];
  /** Te lange etappes: positie in de route (0 = eerste etappe van de lijn) en de dagplanning */
  legs: { routeLeg: number; plan: LegPlan }[];
  maxDriveMin: number;
}

/** Per te lange etappe (positie in de route) de voorstellen en hoe ver in de etappe de dag vol is */
export function overnightSuggestions<T extends SuggestPlace>({ geometry, waypoints, legStarts, places, legs, maxDriveMin }: OvernightInput<T>) {
  const out = new Map<number, { fraction: number; fullKm: number; hits: CorridorHit<T>[] }>();
  if (!legs.length || geometry.length < 2) return out;
  const candidates = nearRoute(geometry, places);
  const hitsByWidth = OVERNIGHT_WIDTHS_KM.map((w) => placesAlongRoute(geometry, waypoints, candidates, w));
  for (const { routeLeg, plan } of legs) {
    const fraction = dayFullFraction(plan, maxDriveMin);
    if (fraction === undefined) continue;
    const startKm = legStarts[routeLeg] ?? 0;
    // Elk routepunt heeft een begin in `legStarts`, dus ook het eind van de laatste etappe
    const endKm = legStarts[routeLeg + 1] ?? startKm;
    const fullKm = startKm + fraction * Math.max(0, endKm - startKm);
    out.set(routeLeg, { fraction, fullKm, hits: pickOvernight(hitsByWidth, routeLeg, fullKm) });
  }
  return out;
}
