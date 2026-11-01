import type { PlaceSummary } from "./types";

/**
 * Een plek zoals de browser hem krijgt via `/api/places` (zoeken, kaart, Dichtbij, Mijn reis, Doe mee).
 * Gelijk aan `PlaceSummary`, behalve:
 * - geen `imageCredit`: de fotobron staat alleen op de plekpagina en bij de foto's op de startpagina (server);
 * - `ratingCount` ontbreekt bij 0 (de meeste plekken), de browser vult 0 weer in (`fromApiPlace`);
 * - coördinaten op 5 decimalen (±1 m). `completeness` blijft exact, want de volgorde Aanbevolen rekent ermee.
 * `priceExtras` blijft: de lijst, de prijssortering en Mijn reis rekenen er de prijs met toeslagen mee uit.
 */
export type ApiPlace = Omit<PlaceSummary, "imageCredit" | "ratingCount"> & { ratingCount?: number };

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function toApiPlace(p: PlaceSummary): ApiPlace {
  const { imageCredit: _credit, ratingCount, ...rest } = p;
  void _credit;
  const out: ApiPlace = { ...rest, lat: round(p.lat, 5), lng: round(p.lng, 5) };
  if (ratingCount > 0) out.ratingCount = ratingCount;
  return out;
}

export function fromApiPlace(p: ApiPlace): PlaceSummary {
  return { ...p, ratingCount: p.ratingCount ?? 0 };
}
