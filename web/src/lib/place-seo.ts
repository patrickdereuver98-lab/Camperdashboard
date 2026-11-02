/**
 * SEO per plek: paginatitel, omschrijving, JSON-LD-prijs en de deelafbeelding (/api/og). Spelregels: nooit data
 * verzinnen (onbekend laten we weg), vertrektijd is het kernfeit, en "inclusief toeslagen" alleen bij een vaste prijs
 * waarvan het totaal voor 2 personen echt vaststaat. Een vanaf-prijs is het laagste tarief uit een reeks: daar is
 * "alles inbegrepen" misleidend (Burgh, 2 november 2026: "vanaf € 11,62 alles inbegrepen" bij tarieven van € 5 tot € 10).
 */
import { cardPrice, departureLong, eur } from "./format";
import { nightTotal, TOTAL_PERSONS } from "./trip-extras";
import { KIND_LABEL, type Place } from "./types";

export type MarketingPlace = Pick<
  Place,
  | "slug"
  | "name"
  | "town"
  | "province"
  | "kind"
  | "priceEur"
  | "priceFrom"
  | "priceExtras"
  | "touristTaxIncluded"
  | "departure"
  | "checkoutUntil"
  | "departureCheck"
> &
  Partial<
    Pick<Place, "description" | "power" | "water" | "dumpStation" | "toilet" | "shower" | "wifi" | "dogs" | "maxLengthM" | "capacity" | "surface" | "ratingAvg" | "ratingCount">
  >;

export type AllInPrice = {
  /** "€ 24,70", "vanaf € 18", "Gratis" */
  amount: string;
  /** Volledige zin-deel: "€ 24,70 per nacht voor 2 personen, inclusief toeslagen" */
  text: string;
  /** Alle toeslagen (toeristenbelasting, stroom) zitten erin en de prijs is vast (geen vanaf-prijs) */
  allIn: boolean;
};

/**
 * De prijs met alle toeslagen als die vaststaat; bij een vanaf-prijs het laagste tarief zonder belofte over toeslagen;
 * anders de bekende prijs met de eerlijke vermelding. undefined = onbekend.
 */
export function allInPrice(p: MarketingPlace): AllInPrice | undefined {
  if (p.priceEur === 0) return { amount: "Gratis", text: "gratis", allIn: true };
  const price = cardPrice(p);
  if (p.priceFrom && price) return { amount: price.value, text: `${price.value} per nacht, plus toeslagen`, allIn: false };
  const t = nightTotal(p);
  if (t.total !== undefined) {
    const amount = eur(t.total);
    return { amount, text: `${amount} per nacht voor ${TOTAL_PERSONS} personen, inclusief toeslagen`, allIn: true };
  }
  if (!price) return undefined;
  return { amount: price.value, text: `${price.value}${price.perNight ? " per nacht" : ""}, toeslagen niet volledig bekend`, allIn: false };
}

/** "uiterlijk 12:00", "geen vaste vertrektijd"; undefined als we het niet (leesbaar) weten */
export function departureFact(p: MarketingPlace): string | undefined {
  const long = departureLong(p);
  if (long === "Onbekend" || long === "Vaste vertrektijd") return undefined;
  // Na "Vertrektijd:" is "geen vaste vertrektijd" dubbel
  return long === "Geen vaste vertrektijd" ? "geen vaste tijd" : long[0].toLowerCase() + long.slice(1);
}

/** "Camperplaats De Proef", zonder dubbel woord als de naam al met de soort begint */
export function labeledName(p: Pick<Place, "name" | "kind">): string {
  const kind = p.kind ? KIND_LABEL[p.kind] : "Camperplaats";
  return p.name.toLowerCase().startsWith(kind.toLowerCase()) ? p.name : `${kind} ${p.name}`;
}

/** Paginatitel: "Camperplaats De Proef in Ede: € 24,70 incl. toeslagen" (de layout voegt de merknaam toe) */
export function seoTitle(p: MarketingPlace): string {
  const price = allInPrice(p);
  const base = `${labeledName(p)} in ${p.town}`;
  if (!price) return base;
  return `${base}: ${price.amount}${price.allIn && p.priceEur !== 0 ? " incl. toeslagen" : ""}`;
}

/**
 * Omschrijving voor zoekresultaten: "Camperplaats De Proef in Ede: € 24,70 per nacht voor 2 personen, inclusief
 * toeslagen. Vertrektijd: uiterlijk 12:00." Wat onbekend is, laten we weg.
 */
export function seoDescription(p: MarketingPlace): string {
  const price = allInPrice(p);
  const dep = departureFact(p);
  const parts = [`${labeledName(p)} in ${p.town} (${p.province})${price ? `: ${price.text}` : ""}.`];
  if (dep) parts.push(`Vertrektijd: ${dep}.`);
  parts.push("Bekijk voorzieningen, foto's, reviews en de route.");
  return parts.join(" ");
}

/** Pad van de deelafbeelding voor een plek */
export function ogImagePath(slug: string): string {
  return `/api/og?slug=${encodeURIComponent(slug)}`;
}
