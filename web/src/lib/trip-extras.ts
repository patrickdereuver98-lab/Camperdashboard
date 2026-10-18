export type Extra = { label: string; amount: number; unit?: string };
type ExtrasStop = { nights: number; place: { priceEur?: number; priceExtras?: Extra[]; touristTaxIncluded?: boolean } };

const r2 = (n: number) => Math.round(n * 100) / 100;
const perPersonPerNight = (x: Extra) => x.unit === "per persoon per nacht" || (x.label === "Per persoon" && x.unit === "per nacht");

type PricedPlace = { priceEur?: number; priceExtras?: Extra[] };

/**
 * De prijs per persoon van een plek zonder basisprijs: één regel voor kaarten, plekpagina, zoeken en Mijn reis.
 * - "per persoon per nacht", of "Per persoon" met "per nacht": dat is de nachtprijs per persoon (`perNight`).
 * - "Per persoon" met eenheid "per persoon": het bedrag per persoon klopt, maar of het per nacht is weten we niet.
 *   Dat tonen we wel ("€ 5 p.p."), maar het telt niet mee in een berekening over nachten.
 * - Zonder eenheid tonen we niets: dan weten we niet waar het bedrag voor is (onbekend blijft onbekend).
 */
export function perPersonPrice(p: PricedPlace): { amount: number; perNight: boolean; extra: Extra } | undefined {
  if (p.priceEur !== undefined) return undefined;
  for (const x of p.priceExtras ?? []) {
    if (x.label !== "Per persoon" || !(x.amount > 0)) continue;
    if (perPersonPerNight(x)) return { amount: x.amount, perNight: true, extra: x };
    if (x.unit === "per persoon") return { amount: x.amount, perNight: false, extra: x };
  }
  return undefined;
}

export type StopSurcharges = {
  /** Nachtprijs uit "per persoon" (alleen als de plek geen basisprijs heeft) */
  stayFromPerPerson?: number;
  /** Toeristenbelasting volgens de plek zelf (per persoon per nacht) */
  touristTax?: number;
  /** Toeslagen die we niet meetellen: hangt af van je situatie, of de eenheid is onbekend */
  listed: Extra[];
};

/**
 * Losse toeslagen van een stop, zonder iets te verzinnen. We tellen alleen mee wat eenduidig is:
 * - Toeristenbelasting "per persoon per nacht": bedrag × personen × nachten (vervangt dan de schatting).
 * - "Per persoon" per nacht bij een plek zonder basisprijs: dat ís de prijs, × personen × nachten.
 * Alles anders (per persoon naast een basisprijs kan ook "extra volwassene" zijn, hond, stroom, kind, bedragen
 * zonder eenheid) noemen we apart.
 */
export function stopSurcharges(s: ExtrasStop, persons: number): StopSurcharges {
  const nights = Math.max(0, s.nights);
  const p = Math.max(1, Math.round(persons));
  const out: StopSurcharges = { listed: [] };
  const pp = perPersonPrice(s.place);
  for (const x of s.place.priceExtras ?? []) {
    if (!(x.amount > 0)) continue;
    if (x.label === "Toeristenbelasting" && x.unit === "per persoon per nacht" && s.place.touristTaxIncluded !== true && s.place.priceEur !== 0) {
      out.touristTax = r2(x.amount * p * nights);
    } else if (pp?.perNight && x === pp.extra) {
      out.stayFromPerPerson = r2(x.amount * p * nights);
    } else if (x.label !== "Toeristenbelasting") {
      out.listed.push(x);
    }
  }
  return out;
}

export type TripCosts = {
  /** Overnachtingen: basisprijzen plus prijzen per persoon bij plekken zonder basisprijs */
  stay: number;
  /** Stops waarvan we de nachtprijs niet kennen (ook niet per persoon) */
  unknownPriceStops: number;
  /** Toeristenbelasting: bekend van de plek, plus de schatting voor de overige nachten */
  tax: number;
  taxKnown: number;
  taxEstimatedNights: number;
  /** Per stop de toeslagen die niet zijn meegeteld */
  listed: { index: number; extras: Extra[] }[];
};

export function tripCosts(stops: ExtrasStop[], persons: number, touristTaxEstimate: number): TripCosts {
  let stay = 0;
  let unknown = 0;
  let taxKnown = 0;
  let estNights = 0;
  const listed: TripCosts["listed"] = [];
  stops.forEach((s, index) => {
    const sur = stopSurcharges(s, persons);
    if (s.place.priceEur !== undefined) stay += s.place.priceEur * s.nights;
    else if (sur.stayFromPerPerson !== undefined) stay += sur.stayFromPerPerson;
    else unknown++;
    if (sur.touristTax !== undefined) taxKnown += sur.touristTax;
    else if (s.place.priceEur !== 0 && s.place.touristTaxIncluded !== true) estNights += s.nights;
    if (sur.listed.length) listed.push({ index, extras: sur.listed });
  });
  const p = Math.max(1, Math.round(persons));
  return {
    stay: r2(stay),
    unknownPriceStops: unknown,
    taxKnown: r2(taxKnown),
    taxEstimatedNights: estNights,
    tax: r2(taxKnown + p * touristTaxEstimate * estNights),
    listed,
  };
}
