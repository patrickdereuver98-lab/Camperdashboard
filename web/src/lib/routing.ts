import { cacheLife } from "next/cache";

/**
 * Echte rij-afstanden over de weg.
 * - OpenRouteService als ORS_API_KEY is ingesteld (gratis sleutel, 2.000 routes/dag)
 * - anders de openbare OSRM-server van FOSSGIS (routing.openstreetmap.de, fair use)
 */

const UA = "VrijStaan/1.0 (+https://vrijstaan.nl)";
const OSRM = "https://routing.openstreetmap.de/routed-car";

export type Point = [lng: number, lat: number];

export interface RouteResult {
  distanceM: number;
  durationS: number;
  legs: { distanceM: number; durationS: number }[];
  geometry: Point[];
  provider: "openrouteservice" | "osrm";
}

export interface MatrixResult {
  distancesM: (number | null)[];
  durationsS: (number | null)[];
  provider: "openrouteservice" | "osrm";
}

// Op 4 decimalen (ongeveer 10 m): genoeg voor een rijtijd, en de cache krijgt niet bij elke meter een nieuwe sleutel
const round = (p: Point): Point => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

export function parsePoints(raw: string | null, max: number): Point[] | null {
  if (!raw) return null;
  const pts = raw.split(";").map((s) => s.split(",").map(Number));
  if (pts.length < 2 || pts.length > max) return null;
  for (const [lat, lng] of pts)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 49 || lat > 55 || lng < 1 || lng > 10) return null;
  return pts.map(([lat, lng]) => round([lng, lat]));
}

async function orsRoute(points: Point[], key: string): Promise<RouteResult> {
  const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ coordinates: points, instructions: false }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const data = await res.json();
  const f = data.features[0];
  return {
    distanceM: Math.round(f.properties.summary.distance),
    durationS: Math.round(f.properties.summary.duration),
    legs: (f.properties.segments ?? []).map((s: { distance: number; duration: number }) => ({
      distanceM: Math.round(s.distance),
      durationS: Math.round(s.duration),
    })),
    geometry: f.geometry.coordinates,
    provider: "openrouteservice",
  };
}

async function osrmRoute(points: Point[]): Promise<RouteResult> {
  const coords = points.map((p) => p.join(",")).join(";");
  const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=simplified&geometries=geojson`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM ${data.code}`);
  const r = data.routes[0];
  return {
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    legs: r.legs.map((l: { distance: number; duration: number }) => ({ distanceM: Math.round(l.distance), durationS: Math.round(l.duration) })),
    geometry: r.geometry.coordinates,
    provider: "osrm",
  };
}

/** Gecachet per unieke combinatie van punten (wegen veranderen zelden). */
export async function getRoute(key: string): Promise<RouteResult> {
  "use cache";
  cacheLife("weeks");
  const points = key.split(";").map((s) => s.split(",").map(Number) as Point);
  const ors = process.env.ORS_API_KEY;
  if (ors) {
    try {
      return await orsRoute(points, ors);
    } catch {
      /* terugvallen op OSRM */
    }
  }
  return osrmRoute(points);
}

async function orsMatrix(from: Point, to: Point[], key: string): Promise<MatrixResult> {
  const res = await fetch("https://api.openrouteservice.org/v2/matrix/driving-car", {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ locations: [from, ...to], sources: [0], metrics: ["distance", "duration"] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const data = await res.json();
  return { distancesM: data.distances[0].slice(1), durationsS: data.durations[0].slice(1), provider: "openrouteservice" };
}

async function osrmMatrix(from: Point, to: Point[]): Promise<MatrixResult> {
  const coords = [from, ...to].map((p) => p.join(",")).join(";");
  const res = await fetch(`${OSRM}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM ${data.code}`);
  return { distancesM: data.distances[0].slice(1), durationsS: data.durations[0].slice(1), provider: "osrm" };
}

export async function getMatrix(key: string): Promise<MatrixResult> {
  "use cache";
  cacheLife("days");
  const [from, ...to] = key.split(";").map((s) => s.split(",").map(Number) as Point);
  const ors = process.env.ORS_API_KEY;
  if (ors) {
    try {
      return await orsMatrix(from, to, ors);
    } catch {
      /* terugvallen op OSRM */
    }
  }
  return osrmMatrix(from, to);
}

export const pointsKey = (pts: Point[]) => pts.map((p) => p.join(",")).join(";");
