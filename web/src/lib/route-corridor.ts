// Plekken langs de route: welke plekken liggen dicht bij de lijn over de weg, op welke etappe, en hoe ver onderweg.
// Gebruikt alleen de routelijn die we al hebben en de plekken die al in de browser staan; niets gaat naar een server.
import type { LatLng } from "./geo";

type Pt = [lng: number, lat: number];

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

/** Punt naar platte km-coördinaten rond een referentiebreedte (nauwkeurig genoeg binnen een paar honderd km) */
function project(p: Pt, cosLat: number): [number, number] {
  return [rad(p[0]) * R * cosLat, rad(p[1]) * R];
}

export interface CorridorHit<T> {
  item: T;
  /** Kortste afstand tot de route in km */
  offKm: number;
  /** Hoeveel km vanaf het begin van de route */
  alongKm: number;
  /** Op welke etappe (0 = van het eerste punt naar het tweede) */
  leg: number;
}

/**
 * Voor elk routepunt (begin, stops, eind) het dichtstbijzijnde punt op de lijn, oplopend: zo weten we waar een etappe
 * begint en eindigt in de lijn.
 */
export function legBreaks(geometry: Pt[], waypoints: LatLng[]): number[] {
  if (!geometry.length) return [];
  const cosLat = Math.cos(rad(geometry[0][1]));
  const g = geometry.map((p) => project(p, cosLat));
  const out: number[] = [];
  let from = 0;
  // Elk punt zoeken we vooruit vanaf het vorige, zodat een route die terugkomt niet in de war raakt
  waypoints.forEach((w) => {
    const [x, y] = project([w.lng, w.lat], cosLat);
    let best = from;
    let bestD = Infinity;
    for (let i = from; i < g.length; i++) {
      const d = (g[i][0] - x) ** 2 + (g[i][1] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    out.push(best);
    from = best;
  });
  return out;
}

/** Plekken binnen `maxKm` van de route, met hun positie langs de route; gesorteerd van begin naar eind */
export function placesAlongRoute<T extends LatLng>(geometry: Pt[], waypoints: LatLng[], items: T[], maxKm: number): CorridorHit<T>[] {
  if (geometry.length < 2) return [];
  const cosLat = Math.cos(rad(geometry[0][1]));
  const g = geometry.map((p) => project(p, cosLat));
  const cum = [0];
  for (let i = 1; i < g.length; i++) cum.push(cum[i - 1] + Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]));
  const breaks = legBreaks(geometry, waypoints);
  // Grof filter op het vak om de route, met marge
  const dLat = maxKm / 111;
  const dLng = maxKm / (111 * Math.max(0.2, cosLat));
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of geometry) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  const out: CorridorHit<T>[] = [];
  for (const item of items) {
    if (item.lat < minLat - dLat || item.lat > maxLat + dLat || item.lng < minLng - dLng || item.lng > maxLng + dLng) continue;
    const [px, py] = project([item.lng, item.lat], cosLat);
    let bestD = Infinity;
    let bestAlong = 0;
    let bestSeg = 0;
    for (let i = 1; i < g.length; i++) {
      const [ax, ay] = g[i - 1];
      const [bx, by] = g[i];
      const vx = bx - ax, vy = by - ay;
      const len2 = vx * vx + vy * vy;
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
      if (d < bestD) {
        bestD = d;
        bestAlong = cum[i - 1] + t * Math.sqrt(len2);
        bestSeg = i - 1;
      }
    }
    if (bestD > maxKm) continue;
    // Etappe: het laatste routepunt dat vóór dit stuk lijn ligt
    let leg = 0;
    for (let w = 1; w < breaks.length - 1; w++) if (breaks[w] <= bestSeg) leg = w;
    out.push({ item, offKm: bestD, alongKm: bestAlong, leg });
  }
  return out.sort((a, b) => a.alongKm - b.alongKm);
}

/** Km langs de route waar een etappe begint (voor "na ± x km rijden") */
export function legStartKm(geometry: Pt[], waypoints: LatLng[]): number[] {
  if (geometry.length < 2) return [];
  const cosLat = Math.cos(rad(geometry[0][1]));
  const g = geometry.map((p) => project(p, cosLat));
  const cum = [0];
  for (let i = 1; i < g.length; i++) cum.push(cum[i - 1] + Math.hypot(g[i][0] - g[i - 1][0], g[i][1] - g[i - 1][1]));
  return legBreaks(geometry, waypoints).map((i) => cum[i]);
}
