/**
 * Signalen over een prijs, zonder iets te verzinnen: is het een vanaf-prijs, en ziet de nachtprijs er verdacht uit
 * (review november 2026, R25 en R47)? Pure functies, ook bruikbaar in beheer.
 */
import type { PlaceKind } from "./types";

/**
 * De prijsnotitie van de scraper bij meerdere tarieven: "vanaf € 5,00 per nacht; hoogste genoemde tarief € 29,25".
 * Alleen dat vaste begin telt; vrije tekst als "Vanaf 2 nachten € 18" is geen vanaf-prijs.
 */
const FROM_NOTE = /^vanaf\s*€/i;

export function isFromPriceNote(note?: string): boolean {
  return FROM_NOTE.test(note ?? "");
}

/** "vanaf € 5,00 per nacht; hoogste genoemde tarief € 29,25" → { low: 5, high: 29.25 }; anders undefined */
export function priceRange(note?: string): { low: number; high: number } | undefined {
  if (!isFromPriceNote(note)) return undefined;
  const amount = (s: string) => Number(s.replace(",", "."));
  const low = /^vanaf\s*€\s*(\d+(?:,\d+)?)/i.exec(note!);
  const high = /hoogste[^€]*€\s*(\d+(?:,\d+)?)/i.exec(note!);
  if (!low || !high) return undefined;
  const range = { low: amount(low[1]), high: amount(high[1]) };
  return Number.isFinite(range.low) && Number.isFinite(range.high) && range.low > 0 ? range : undefined;
}

/** Onder dit bedrag per nacht is een camping of vakantiepark verdacht goedkoop (vaak een toeslag of prijs per persoon) */
export const SUSPICIOUS_CAMPING_PRICE = 8;
/** Ligt het hoogste tarief meer dan zoveel keer boven het laagste, dan is het laagste vaak een tent- of persoonsprijs */
export const SUSPICIOUS_RANGE_FACTOR = 4;

type PricePlace = { kind?: PlaceKind; name?: string; priceEur?: number; priceNote?: string };

const CAMPING_NAME = /\b(camping|vakantiepark|recreatiepark|vakantiecentrum|resort)\b/i;

/**
 * Waarom de nachtprijs nagekeken moet worden, of undefined als er niets opvalt. Een signaal, geen oordeel: beheer
 * kijkt het na in de bron (R47). Gratis (0) en onbekend tellen niet.
 */
export function suspiciousPrice(p: PricePlace): string | undefined {
  if (p.priceEur === undefined || !(p.priceEur > 0)) return undefined;
  const camping = p.kind === "camping" || CAMPING_NAME.test(p.name ?? "");
  if (camping && p.priceEur < SUSPICIOUS_CAMPING_PRICE) {
    return `Nachtprijs onder € ${SUSPICIOUS_CAMPING_PRICE} bij een camping of vakantiepark`;
  }
  const range = priceRange(p.priceNote);
  if (range && range.high / range.low > SUSPICIOUS_RANGE_FACTOR) {
    return `Hoogste tarief is meer dan ${SUSPICIOUS_RANGE_FACTOR} keer de vanaf-prijs`;
  }
  return undefined;
}
