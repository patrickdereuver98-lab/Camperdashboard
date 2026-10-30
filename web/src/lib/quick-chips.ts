import { DEFAULT_FILTERS, type Filters } from "./search";
import type { LatLng } from "./geo";

export type QuickChipKey = "dichtbij" | "vrij" | "gratis" | "score" | "stroom" | "lozen";
export type QuickChip = { key: QuickChipKey; label: string; on: boolean; brand?: boolean; toggle: () => Filters };

/**
 * Snelle filters op de zoekpagina (redesign 30 oktober 2026): de keuzes die een camperaar onderweg het vaakst wil.
 * "Zonder vertrektijd" is de kernbelofte en vervangt de tabbladen; daarom als enige in bosgroen (`brand`).
 */
export function quickChips(f: Filters, near?: LatLng | null): QuickChip[] {
  const has = (k: Filters["facilities"][number]) => f.facilities.includes(k);
  const facility = (k: Filters["facilities"][number]) => ({
    ...f,
    facilities: has(k) ? f.facilities.filter((x) => x !== k) : [...f.facilities, k],
  });
  const mine = f.where === "Mijn locatie";
  return [
    {
      key: "dichtbij",
      label: "Dichtbij",
      on: mine,
      // Uit: terug naar heel Nederland en de standaardvolgorde
      toggle: () =>
        mine
          ? { ...f, where: undefined, center: undefined, sort: DEFAULT_FILTERS.sort }
          : { ...f, where: "Mijn locatie", center: near ?? undefined, province: undefined, sort: "afstand" },
    },
    {
      key: "vrij",
      label: "Zonder vertrektijd",
      on: f.departure === "vrij",
      brand: true,
      toggle: () => ({ ...f, departure: f.departure === "vrij" ? undefined : "vrij" }),
    },
    { key: "gratis", label: "Gratis", on: f.free, toggle: () => ({ ...f, free: !f.free, maxPrice: undefined }) },
    { key: "score", label: "8+", on: f.minScore === 8, toggle: () => ({ ...f, minScore: f.minScore === 8 ? undefined : 8 }) },
    { key: "stroom", label: "Stroom", on: has("power"), toggle: () => facility("power") },
    { key: "lozen", label: "Lozen", on: has("dumpStation"), toggle: () => facility("dumpStation") },
  ];
}
