import type { PlaceListItem, PlaceSummary } from "./types";

/**
 * Een plek zoals `/api/places` hem naar de browser stuurt (audit 1 november 2026): zonder `id` (een UUID is niet samen
 * te drukken, 57 kB van de 266 kB gzip) en zonder `imageCredit` (alleen de startpagina gebruikt die, op de server).
 * Coördinaten op 5 decimalen, ±1 m. Verder niets weglaten: prijs met toeslagen (`priceExtras`) en de feiten voor
 * filters, sorteren en de reisplanner blijven erin.
 */
export function toListItem(p: PlaceSummary): PlaceListItem {
  const out: Partial<PlaceSummary> = { ...p, lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 };
  delete out.id;
  delete out.imageCredit;
  return out as PlaceListItem;
}
