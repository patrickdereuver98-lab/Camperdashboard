import { cacheLife } from "next/cache";
import { checkPoints, hasDimensions, optionsKey, parseOptionsKey, type Avoid, type RouteOptions } from "./route-options";

/**
 * Echte rij-afstanden over de weg.
 * - OpenRouteService als ORS_API_KEY is ingesteld (gratis sleutel, 2.000 routes/dag). Alleen daar telt de camper mee
 *   (hoogte, gewicht, lengte en breedte via het profiel voor zwaar verkeer).
 * - anders de openbare OSRM-server van FOSSGIS (routing.openstreetmap.de, fair use): rijtijd voor een personenauto.
 * Het antwoord zegt eerlijk of de camper en de vermijdingen zijn meegenomen.
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
  /** Hoogte, gewicht en lengte zijn meegenomen (alleen OpenRouteService) */
  vehicleApplied: boolean;
  /** Gevraagde vermijdingen (tol, veer, snelweg) zijn meegenomen */
  avoidApplied: boolean;
}

export interface MatrixResult {
  distancesM: (number | null)[];
  durationsS: (number | null)[];
  provider: "openrouteservice" | "osrm";
}

/** Volledige tabel: van elk punt naar elk punt (voor de slimste volgorde) */
export interface TableResult {
  durationsS: (number | null)[][];
  distancesM: (number | null)[][];
  provider: "openrouteservice" | "osrm";
  vehicleApplied: boolean;
}

// Op 4 decimalen (ongeveer 10 m): genoeg voor een rijtijd, en de cache krijgt niet bij elke meter een nieuwe sleutel
const round = (p: Point): Point => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4];

/** "lat,lng;lat,lng" naar punten (lng, lat); null als het niet klopt. Zie checkPoints voor de reden. */
export function parsePoints(raw: string | null, max: number, min = 2): Point[] | null {
  const check = checkPoints(raw, min, max);
  return check.ok ? check.points.map(([lat, lng]) => round([lng, lat])) : null;
}

const ORS_AVOID: Record<Avoid, string> = { tolls: "tollways", ferries: "ferries", highways: "highways" };

/** Profiel en opties voor OpenRouteService */
function orsProfile(o: RouteOptions) {
  const heavy = hasDimensions(o);
  const options: Record<string, unknown> = {};
  if (o.avoid.length) options.avoid_features = o.avoid.map((a) => ORS_AVOID[a]);
  if (heavy) {
    const restrictions: Record<string, number> = {};
    if (o.heightM) restrictions.height = o.heightM;
    if (o.lengthM) restrictions.length = o.lengthM;
    if (o.widthM) restrictions.width = o.widthM;
    if (o.weightKg) restrictions.weight = Math.round(o.weightKg / 100) / 10; // in ton
    options.vehicle_type = "hgv";
    options.profile_params = { restrictions };
  }
  return { profile: heavy ? "driving-hgv" : "driving-car", options, heavy };
}

async function orsRoute(points: Point[], o: RouteOptions, key: string): Promise<RouteResult> {
  const { profile, options, heavy } = orsProfile(o);
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ coordinates: points, instructions: false, ...(Object.keys(options).length ? { options } : {}) }),
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
    vehicleApplied: heavy,
    avoidApplied: true,
  };
}

async function osrmFetch(path: string) {
  const res = await fetch(`${OSRM}${path}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`OSRM ${data.code}`);
  return data;
}

async function osrmRoute(points: Point[], o: RouteOptions): Promise<RouteResult> {
  const coords = points.map((p) => p.join(",")).join(";");
  // De openbare server van FOSSGIS kan niets vermijden ("Exclude flag combination is not supported", gemeten
  // 19 november 2026); vraag je dat, dan zegt het antwoord eerlijk dat het niet is meegenomen
  const data = await osrmFetch(`/route/v1/driving/${coords}?overview=simplified&geometries=geojson`);
  const r = data.routes[0];
  return {
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    legs: r.legs.map((l: { distance: number; duration: number }) => ({ distanceM: Math.round(l.distance), durationS: Math.round(l.duration) })),
    geometry: r.geometry.coordinates,
    provider: "osrm",
    vehicleApplied: false,
    avoidApplied: o.avoid.length === 0,
  };
}

const keyPoints = (key: string) => key.split("#")[0].split(";").map((s) => s.split(",").map(Number) as Point);
const keyOptions = (key: string) => parseOptionsKey(key.split("#")[1] ?? "");

/** Gecachet per unieke combinatie van punten en opties (wegen veranderen zelden). */
export async function getRoute(key: string): Promise<RouteResult> {
  "use cache";
  // "days": de privacyverklaring belooft dat een rijtijd maar een paar dagen bewaard blijft
  cacheLife("days");
  const points = keyPoints(key);
  const options = keyOptions(key);
  const ors = process.env.ORS_API_KEY;
  if (ors) {
    try {
      return await orsRoute(points, options, ors);
    } catch {
      /* terugvallen op OSRM */
    }
  }
  return osrmRoute(points, options);
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
  const data = await osrmFetch(`/table/v1/driving/${coords}?sources=0&annotations=distance,duration`);
  return { distancesM: data.distances[0].slice(1), durationsS: data.durations[0].slice(1), provider: "osrm" };
}

export async function getMatrix(key: string): Promise<MatrixResult> {
  "use cache";
  cacheLife("days");
  const [from, ...to] = keyPoints(key);
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

async function orsTable(points: Point[], o: RouteOptions, key: string): Promise<TableResult> {
  const { profile, heavy } = orsProfile(o);
  const res = await fetch(`https://api.openrouteservice.org/v2/matrix/${profile}`, {
    method: "POST",
    headers: { Authorization: key, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ locations: points, metrics: ["distance", "duration"] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`ORS ${res.status}`);
  const data = await res.json();
  return { durationsS: data.durations, distancesM: data.distances, provider: "openrouteservice", vehicleApplied: heavy };
}

async function osrmTable(points: Point[]): Promise<TableResult> {
  const coords = points.map((p) => p.join(",")).join(";");
  const data = await osrmFetch(`/table/v1/driving/${coords}?annotations=distance,duration`);
  return { durationsS: data.durations, distancesM: data.distances, provider: "osrm", vehicleApplied: false };
}

/** Rijtijden tussen alle punten (maximaal 26: vertrekpunt en 25 stops) */
export async function getTable(key: string): Promise<TableResult> {
  "use cache";
  cacheLife("days");
  const points = keyPoints(key);
  const options = keyOptions(key);
  const ors = process.env.ORS_API_KEY;
  if (ors) {
    try {
      return await orsTable(points, options, ors);
    } catch {
      /* terugvallen op OSRM */
    }
  }
  return osrmTable(points);
}

/** Sleutel voor de cache: punten, en na "#" de opties als die er zijn */
export const pointsKey = (pts: Point[], options?: RouteOptions) => {
  const base = pts.map((p) => p.join(",")).join(";");
  const opts = options ? optionsKey(options) : "";
  return opts ? `${base}#${opts}` : base;
};
