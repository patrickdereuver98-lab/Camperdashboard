import { extraLabel } from "./format";
import type { Place } from "./types";

/**
 * Eigenaar vult zijn plek aan (review 3.4). Het formulier begint met wat we al weten; in de inzending staan alleen
 * de velden die de eigenaar veranderde, met de oude en de nieuwe waarde, zodat beheer snel kan controleren.
 * De sleutels zijn dezelfde Nederlandse namen als bij Plek aanmelden.
 */
export const OWNER_FIELDS = [
  "vertrek",
  "vertrek_uiterlijk",
  "aankomst_vanaf",
  "reserveren",
  "prijs_per_nacht",
  "toeristenbelasting",
  "extra_kosten",
  "open",
  "aantal_plekken",
  "langste_camper_m",
  "telefoon",
  "website",
] as const;

export type OwnerField = (typeof OWNER_FIELDS)[number];
export type OwnerValues = Record<OwnerField, string>;
export type OwnerChanges = Partial<Record<OwnerField, { was: string | null; nieuw: string | null }>>;

const NUMERIC: OwnerField[] = ["prijs_per_nacht", "aantal_plekken", "langste_camper_m"];

/** 12.5 wordt "12,50", 8 blijft "8" */
function num(n: number | undefined, money = false): string {
  if (n === undefined) return "";
  return (money && !Number.isInteger(n) ? n.toFixed(2) : String(n)).replace(".", ",");
}

/** Beginwaarden van het formulier. Onbekend blijft leeg. */
export function ownerValues(p: Place): OwnerValues {
  return {
    vertrek: p.departure ?? "",
    vertrek_uiterlijk: p.departure === "vast" ? (p.checkoutUntil ?? "") : "",
    aankomst_vanaf: p.checkinFrom ?? "",
    // "Ja" in de bron zegt niet of reserveren verplicht is of alleen kan: dan laten we de keuze aan de eigenaar
    reserveren: p.reservation === false ? "niet_nodig" : "",
    prijs_per_nacht: num(p.priceEur, true),
    toeristenbelasting: p.touristTaxIncluded === undefined ? "" : p.touristTaxIncluded ? "inbegrepen" : "erbij",
    extra_kosten: (p.priceExtras ?? []).map((x) => `${x.label}: ${extraLabel(x)}`).join("\n"),
    open: p.openAllYear ? "Hele jaar" : (p.season ?? ""),
    aantal_plekken: num(p.capacity),
    langste_camper_m: num(p.maxLengthM),
    telefoon: p.phone ?? "",
    website: p.website ?? "",
  };
}

function same(field: OwnerField, a: string, b: string): boolean {
  if (NUMERIC.includes(field) && a && b) {
    const x = Number(a.replace(",", "."));
    const y = Number(b.replace(",", "."));
    if (Number.isFinite(x) && Number.isFinite(y)) return x === y;
  }
  // Witruimte en regeleinden tellen niet als wijziging
  const norm = (s: string) => s.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).join("\n").trim();
  return norm(a) === norm(b);
}

/** Alleen wat anders is dan de beginwaarde. Leeg maken telt ook als wijziging (nieuw = null). */
export function ownerChanges(before: OwnerValues, after: Partial<OwnerValues>): OwnerChanges {
  const out: OwnerChanges = {};
  for (const f of OWNER_FIELDS) {
    const a = before[f] ?? "";
    const b = (after[f] ?? "").trim();
    if (same(f, a, b)) continue;
    out[f] = { was: a || null, nieuw: b || null };
  }
  return out;
}
