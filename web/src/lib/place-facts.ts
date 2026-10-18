import { cardPrice, departureShort } from "./format";
import type { Place } from "./types";

type FactsPlace = Pick<
  Place,
  | "departure"
  | "checkoutUntil"
  | "departureCheck"
  | "priceEur"
  | "priceFrom"
  | "priceExtras"
  | "openAllYear"
  | "season"
  | "maxLengthM"
  | "power"
  | "water"
  | "dumpStation"
  | "toilet"
  | "dogs"
  | "reservation"
  | "touristTaxIncluded"
  | "surface"
>;

/**
 * Wat een camperaar wil weten, en of wij het weten. De publicatiescore (completeness) is gewogen en zegt dat niet.
 * "Bekend" betekent hier: de plekpagina toont er een waarde voor. Zo klopt de teller "x van 12" met wat je ziet.
 */
export function knownFacts(p: FactsPlace): { label: string; known: boolean }[] {
  return [
    // Een afgewezen "geen vaste vertrektijd" tonen we als onbekend
    { label: "vertrektijd", known: departureShort(p) !== undefined },
    { label: "prijs", known: cardPrice(p) !== undefined },
    { label: "openingsperiode", known: p.openAllYear === true || !!p.season },
    { label: "maximale lengte", known: !!p.maxLengthM },
    { label: "stroom", known: p.power !== undefined },
    { label: "water", known: p.water !== undefined },
    { label: "lozen", known: p.dumpStation !== undefined },
    { label: "toilet", known: p.toilet !== undefined },
    { label: "honden", known: p.dogs !== undefined },
    { label: "reserveren", known: p.reservation !== undefined },
    // Alleen als de pagina iets over toeristenbelasting zegt, niet bij een willekeurige andere toeslag
    { label: "toeristenbelasting", known: p.touristTaxIncluded !== undefined || !!p.priceExtras?.some((x) => x.label === "Toeristenbelasting") },
    { label: "ondergrond", known: !!p.surface },
  ];
}
