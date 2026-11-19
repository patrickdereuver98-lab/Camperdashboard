// Opties voor een route: welk voertuig en wat je wilt vermijden. Gedeeld door de browser (Mijn reis) en de server
// (/api/route, /api/matrix), zodat beide dezelfde sleutel en dezelfde grenzen gebruiken.

export type Avoid = "tolls" | "ferries" | "highways";
export const AVOIDS: readonly Avoid[] = ["tolls", "ferries", "highways"];

export interface RouteOptions {
  /** Hoogte, gewicht en lengte van de camper meesturen (OpenRouteService, profiel voor zwaar verkeer) */
  heightM?: number;
  weightKg?: number;
  lengthM?: number;
  widthM?: number;
  avoid: Avoid[];
}

export const NO_OPTIONS: RouteOptions = { avoid: [] };

const RANGES = { heightM: [1.5, 4.5], weightKg: [500, 12000], lengthM: [3, 20], widthM: [1.5, 3] } as const;
type Dim = keyof typeof RANGES;
const DIMS = Object.keys(RANGES) as Dim[];
const PARAM: Record<Dim, string> = { heightM: "h", weightKg: "w", lengthM: "l", widthM: "b" };

/** Opties als stuk querystring ("&h=3.1&w=3500&x=tolls,ferries"); leeg als er niets bijzonders is */
export function routeOptionsQuery(o: RouteOptions): string {
  const q = new URLSearchParams();
  for (const d of DIMS) if (o[d] !== undefined) q.set(PARAM[d], String(o[d]));
  const avoid = AVOIDS.filter((a) => o.avoid.includes(a));
  if (avoid.length) q.set("x", avoid.join(","));
  const s = q.toString();
  return s ? `&${s}` : "";
}

/** Opties uit de querystring; waarden buiten de grenzen vallen weg (nooit een verzonnen maat) */
export function parseRouteOptions(params: URLSearchParams): RouteOptions {
  const out: RouteOptions = { avoid: [] };
  for (const d of DIMS) {
    const raw = params.get(PARAM[d]);
    if (raw === null || raw === "") continue;
    const n = Number(raw);
    const [min, max] = RANGES[d];
    if (Number.isFinite(n) && n >= min && n <= max) out[d] = d === "weightKg" ? Math.round(n) : Math.round(n * 100) / 100;
  }
  const x = (params.get("x") ?? "").split(",");
  out.avoid = AVOIDS.filter((a) => x.includes(a));
  return out;
}

/** Of er afmetingen meegaan (dan rekent OpenRouteService met het profiel voor zwaar verkeer) */
export const hasDimensions = (o: RouteOptions) => DIMS.some((d) => o[d] !== undefined);

/** Vaste tekst als cachesleutel ("h3.1|w3500|xtolls"); leeg zonder opties */
export function optionsKey(o: RouteOptions): string {
  const parts = DIMS.filter((d) => o[d] !== undefined).map((d) => `${PARAM[d]}${o[d]}`);
  const avoid = AVOIDS.filter((a) => o.avoid.includes(a));
  if (avoid.length) parts.push(`x${avoid.join("+")}`);
  return parts.join("|");
}

export function parseOptionsKey(key: string): RouteOptions {
  const q = new URLSearchParams();
  for (const part of key.split("|").filter(Boolean)) {
    const k = part[0];
    const v = part.slice(1);
    q.set(k, k === "x" ? v.replaceAll("+", ",") : v);
  }
  return parseRouteOptions(q);
}

/** Grenzen van wat de routeplanner aankan: Europa (ook Noord-Afrika en Turkije vallen er grotendeels buiten) */
export const ROUTE_BOUNDS = { minLat: 34, maxLat: 72, minLng: -25, maxLng: 45 } as const;

export type PointsCheck =
  | { ok: true; points: [lat: number, lng: number][] }
  | { ok: false; reason: "aantal" | "formaat" | "buiten" };

/** Punten "lat,lng;lat,lng" controleren, met de reden als het niet kan (dan kan de site het eerlijk zeggen) */
export function checkPoints(raw: string | null, min: number, max: number): PointsCheck {
  if (!raw) return { ok: false, reason: "aantal" };
  const pts = raw.split(";").map((s) => s.split(",").map(Number));
  if (pts.length < min || pts.length > max) return { ok: false, reason: "aantal" };
  for (const p of pts) if (p.length !== 2 || !p.every(Number.isFinite)) return { ok: false, reason: "formaat" };
  const b = ROUTE_BOUNDS;
  for (const [lat, lng] of pts) if (lat < b.minLat || lat > b.maxLat || lng < b.minLng || lng > b.maxLng) return { ok: false, reason: "buiten" };
  return { ok: true, points: pts as [number, number][] };
}

export const POINTS_ERROR: Record<"aantal" | "formaat" | "buiten", string> = {
  aantal: "Te veel of te weinig punten voor één route",
  formaat: "Deze punten kunnen we niet lezen",
  buiten: "Een van de plekken ligt buiten Europa; die route kunnen we niet berekenen",
};
