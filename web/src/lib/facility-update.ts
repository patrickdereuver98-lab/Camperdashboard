import { FACILITIES, type FacilityKey } from "./search";
import type { Place } from "./types";

/**
 * Voorzieningen doorgeven ("Klopt er iets niet?" → Voorzieningen). Een bezoeker kiest per voorziening ja, nee of
 * "weet ik niet"; in de inzending staat alleen wat anders is dan nu, met de oude waarde, zodat beheer het met één klik
 * kan overnemen (Beheer → Inzendingen). "Weet ik niet" verandert nooit iets: onbekend blijft onbekend.
 */

/** Kolom in `places` per voorziening (de sleutel in de inzending) */
export const FACILITY_COLUMN = {
  power: "power",
  water: "water",
  dumpStation: "dump_station",
  toilet: "toilet",
  shower: "shower",
  wifi: "wifi",
  dogs: "dogs",
} as const satisfies Record<FacilityKey, string>;

export type FacilityColumn = (typeof FACILITY_COLUMN)[FacilityKey];
export type FacilityAnswer = "ja" | "nee" | "";
export type FacilityChange = { was: boolean | null; nieuw: boolean };
export type FacilityChanges = Partial<Record<FacilityColumn, FacilityChange>>;

const COLUMNS = new Set<string>(Object.values(FACILITY_COLUMN));
const isColumn = (c: string): c is FacilityColumn => COLUMNS.has(c);

/** Alleen de voorzieningen van een plek (om aan een clientcomponent door te geven, zonder de rest van de plek) */
export function pickFacilities(p: Partial<Pick<Place, FacilityKey>>): Partial<Pick<Place, FacilityKey>> {
  const out: Partial<Pick<Place, FacilityKey>> = {};
  for (const f of FACILITIES) if (typeof p[f.key] === "boolean") out[f.key] = p[f.key];
  return out;
}

/** Wat we nu weten, als beginwaarde van het formulier (onbekend = leeg) */
export function facilityAnswers(p: Partial<Pick<Place, FacilityKey>>): Record<FacilityKey, FacilityAnswer> {
  const out = {} as Record<FacilityKey, FacilityAnswer>;
  for (const f of FACILITIES) out[f.key] = p[f.key] === true ? "ja" : p[f.key] === false ? "nee" : "";
  return out;
}

/** Alleen ja of nee dat anders is dan nu; leeg ("weet ik niet") telt nooit als wijziging */
export function facilityChanges(
  current: Partial<Pick<Place, FacilityKey>>,
  answers: Partial<Record<FacilityKey, FacilityAnswer>>,
): FacilityChanges {
  const out: FacilityChanges = {};
  for (const f of FACILITIES) {
    const a = answers[f.key];
    if (a !== "ja" && a !== "nee") continue;
    const nieuw = a === "ja";
    const was = current[f.key] ?? null;
    if (was === nieuw) continue;
    out[FACILITY_COLUMN[f.key]] = { was, nieuw };
  }
  return out;
}

/**
 * Een inzending omzetten naar kolommen van `places` voor de knop "Voorzieningen overnemen". Alleen bekende kolommen
 * met een echte ja of nee; de rest wordt genegeerd (de inzending komt van een bezoeker). Undefined = geen
 * voorzieningen in deze inzending.
 */
export function facilitiesFromSubmission(payload: Record<string, unknown>): Partial<Record<FacilityColumn, boolean>> | undefined {
  const raw = payload.voorzieningen;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Partial<Record<FacilityColumn, boolean>> = {};
  for (const [col, change] of Object.entries(raw as Record<string, unknown>)) {
    if (!isColumn(col) || !change || typeof change !== "object") continue;
    const nieuw = (change as { nieuw?: unknown }).nieuw;
    if (typeof nieuw === "boolean") out[col] = nieuw;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Naam van een kolom zoals bezoekers hem zien ("dump_station" → "Lozen") */
export function facilityLabel(column: string): string {
  const f = FACILITIES.find((x) => FACILITY_COLUMN[x.key] === column);
  return f?.label ?? column;
}
