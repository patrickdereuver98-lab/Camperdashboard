// Voorkeuren voor de dagplanning in Mijn reis, en het begin- en eindpunt van de reis. Alles staat alleen op dit toestel.
// Dit zijn jouw uitgangspunten, geen gegevens over plekken: de standaardwaarden kun je in Mijn reis aanpassen.
import { timeToMinutes } from "./format";
import { AVOIDS, type Avoid } from "./route-options";

export interface RoutePrefs {
  /** Hoe laat je normaal vertrekt ("10:00"); vraagt een plek eerder te vertrekken, dan geldt die tijd */
  departTime: string;
  /** Hoeveel minuten je per dag hooguit wilt rijden; 0 = geen grens */
  maxDriveMin: number;
  /** Pauze in minuten per 2 uur rijden */
  pauseMin: number;
  /** Hoeveel procent langer je rijdt dan de routeplanner zegt (die rekent zonder camper met een personenauto) */
  slowerPct: number;
  /** Hoe lang je bij een tussenstop blijft, in minuten */
  stopoverMin: number;
  /** Hoogte, gewicht, lengte en breedte uit Mijn camper meenemen in de route */
  useVehicle: boolean;
  avoid: Avoid[];
}

export const DEFAULT_ROUTE_PREFS: RoutePrefs = {
  departTime: "10:00",
  maxDriveMin: 240,
  pauseMin: 15,
  slowerPct: 0,
  stopoverMin: 45,
  useVehicle: true,
  avoid: [],
};

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return v !== null && v !== "" && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

export function cleanRoutePrefs(v: unknown): RoutePrefs {
  const o = (typeof v === "object" && v !== null ? v : {}) as Partial<Record<keyof RoutePrefs, unknown>>;
  const d = DEFAULT_ROUTE_PREFS;
  const time = typeof o.departTime === "string" && timeToMinutes(o.departTime) !== undefined ? o.departTime.trim().replace(".", ":") : d.departTime;
  return {
    departTime: time.length === 4 ? `0${time}` : time,
    maxDriveMin: num(o.maxDriveMin, 0, 16 * 60, d.maxDriveMin),
    pauseMin: num(o.pauseMin, 0, 120, d.pauseMin),
    slowerPct: num(o.slowerPct, 0, 50, d.slowerPct),
    stopoverMin: num(o.stopoverMin, 5, 8 * 60, d.stopoverMin),
    useVehicle: typeof o.useVehicle === "boolean" ? o.useVehicle : d.useVehicle,
    avoid: Array.isArray(o.avoid) ? AVOIDS.filter((a) => (o.avoid as unknown[]).includes(a)) : d.avoid,
  };
}

// ── Begin- en eindpunt ──────────────────────────────────────────────────────

export interface Endpoint {
  /** Wat de bezoeker ziet: "Je locatie" of het adres zoals PDOK het geeft */
  label: string;
  lat: number;
  lng: number;
  kind: "locatie" | "adres";
}

export interface RouteEnds {
  start: Endpoint | null;
  /** "laatste" = de reis eindigt bij de laatste stop; "start" = terug naar het beginpunt; of een ander adres */
  end: "laatste" | "start" | Endpoint;
}

export const EMPTY_ENDS: RouteEnds = { start: null, end: "laatste" };

function cleanEndpoint(v: unknown): Endpoint | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 120) : "Beginpunt";
  return { label, lat, lng, kind: o.kind === "adres" ? "adres" : "locatie" };
}

export function cleanRouteEnds(v: unknown): RouteEnds {
  const o = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const start = cleanEndpoint(o.start);
  const end = o.end === "start" && start ? "start" : (cleanEndpoint(o.end) ?? "laatste");
  return { start, end };
}

/** Het punt waar de reis eindigt, als dat niet de laatste stop is */
export function endPoint(e: RouteEnds): Endpoint | null {
  if (e.end === "laatste") return null;
  if (e.end === "start") return e.start;
  return e.end;
}
