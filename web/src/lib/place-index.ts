import type { PlaceSummary } from "./types";

/**
 * Lichte suggestie-index voor het zoekvak (R33): per plek alleen naam, adres en ligging, als compacte rij.
 * ±50 KB gecomprimeerd in plaats van ±210 KB voor de hele plekkenlijst. De startpagina laadt alleen dit, en pas als
 * je het zoekvak gebruikt.
 */
export type PlaceRef = Pick<PlaceSummary, "slug" | "name" | "town" | "province" | "lat" | "lng">;

type Row = [slug: string, name: string, town: string, province: string, lat: number, lng: number];

/** Vijf decimalen is ruim een meter: genoeg voor "plekken binnen 25 km" */
const round = (n: number) => Math.round(n * 1e5) / 1e5;

export function encodePlaceIndex(places: PlaceRef[]): Row[] {
  return places.map((p) => [p.slug, p.name, p.town, p.province, round(p.lat), round(p.lng)]);
}

/** Rijen terug naar plekken; onleesbare rijen vallen weg (nooit een plek met verzonnen gegevens) */
export function decodePlaceIndex(raw: unknown): PlaceRef[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaceRef[] = [];
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 6) continue;
    const [slug, name, town, province, lat, lng] = r as unknown[];
    if (typeof slug !== "string" || typeof name !== "string" || typeof town !== "string" || typeof province !== "string") continue;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ slug, name, town, province, lat, lng });
  }
  return out;
}

/** Velden die de browser van /api/places niet gebruikt en dus niet hoeft te downloaden */
export function forBrowser(p: PlaceSummary): PlaceSummary {
  if (p.imageCredit === undefined) return p;
  const copy = { ...p };
  delete copy.imageCredit;
  return copy;
}

/** Naam op window van het verzoek om de plekkenlijst dat de HTML van zoeken al vóór de hydratatie start (R33) */
export const EARLY_PLACES = "__vrijstaanPlekken";
