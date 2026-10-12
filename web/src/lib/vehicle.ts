import type { Filters } from "./search";

export type Fuel = "diesel" | "benzine" | "lpg" | "elektrisch";

/** Camperprofiel. Alleen de lengte gebruiken we bij het zoeken; hoogte en gewicht zijn bij te weinig plekken bekend. */
export interface Vehicle {
  name?: string;
  lengthM?: number;
  heightM?: number;
  widthM?: number;
  weightKg?: number;
  fuel?: Fuel;
  /** Liter (of kWh) per 100 km, voor de kosten in Mijn reis */
  consumption?: number;
}

const RANGES: Record<keyof Omit<Vehicle, "name" | "fuel">, [number, number]> = {
  lengthM: [3, 20],
  heightM: [1.5, 4.5],
  widthM: [1.5, 3],
  weightKg: [500, 12000],
  consumption: [3, 40],
};

/** Alleen geldige, afgeronde waarden; de rest valt weg (we bewaren niets wat niet klopt) */
export function cleanVehicle(v: unknown): Vehicle {
  const src = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const out: Vehicle = {};
  const name = typeof src.name === "string" ? src.name.trim().slice(0, 40) : "";
  if (name) out.name = name;
  for (const [k, [min, max]] of Object.entries(RANGES) as [keyof typeof RANGES, [number, number]][]) {
    const n = Number(String(src[k] ?? "").replace(",", "."));
    if (src[k] !== undefined && src[k] !== "" && Number.isFinite(n) && n >= min && n <= max) out[k] = k === "weightKg" ? Math.round(n) : Math.round(n * 100) / 100;
  }
  if (["diesel", "benzine", "lpg", "elektrisch"].includes(src.fuel as string)) out.fuel = src.fuel as Fuel;
  return out;
}

export const hasVehicle = (v: Vehicle) => Object.keys(v).length > 0;

/**
 * Lengte uit het camperprofiel als filter, tenzij je zelf een lengte koos of het filter uitzette (`lengte=0`).
 * `lengthFromVehicle` zegt of het filter uit het profiel komt (voor de chip).
 */
export function applyVehicle<F extends Pick<Filters, "minLength" | "lengthOff">>(f: F, vehicle: Vehicle): F & { lengthFromVehicle?: boolean } {
  if (f.minLength || f.lengthOff || !vehicle.lengthM) return f;
  return { ...f, minLength: vehicle.lengthM, lengthFromVehicle: true };
}
