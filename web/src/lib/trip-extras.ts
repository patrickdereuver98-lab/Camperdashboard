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
  const candidates = (p.priceExtras ?? []).filter((x) => x.label === "Per persoon" && x.amount > 0);
  // Een bedrag per nacht gaat voor een bedrag "per persoon" zonder nacht
  const night = candidates.find(perPersonPerNight);
  if (night) return { amount: night.amount, perNight: true, extra: night };
  const any = candidates.find((x) => x.unit === "per persoon");
  return any ? { amount: any.amount, perNight: false, extra: any } : undefined;
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

/** Standaardsituatie voor de totaalprijs op kaart en plekpagina: 2 volwassenen, 1 nacht, met stroom (review 3.1) */
export const TOTAL_PERSONS = 2;

export type NightTotal = {
  /** Totaal per nacht voor TOTAL_PERSONS personen; alleen als elk onderdeel vaststaat */
  total?: number;
  /** Waaruit het totaal bestaat, in leesbare stukjes */
  parts: { label: string; amount: number }[];
  /** Wat ontbreekt voor een totaal ("toeristenbelasting", "stroom per kWh") */
  open: string[];
  /** De basisprijs is een vanaf-prijs */
  from: boolean;
};

type TotalPlace = PricedPlace & { priceFrom?: boolean; touristTaxIncluded?: boolean };

/**
 * Wat een nacht kost voor 2 personen, met toeristenbelasting en stroom. Niets verzinnen: een onderdeel telt alleen mee
 * als het bedrag én de eenheid eenduidig zijn. Is iets onbekend, dan geen totaal maar een lijst `open`.
 * - Overnachting: de basisprijs, of bij een plek zonder basisprijs de prijs per persoon per nacht × 2. Noemt een plek
 *   naast de basisprijs ook een bedrag per persoon, dan weten we niet of dat erbij komt: geen totaal.
 * - Toeristenbelasting: 0 als die in de prijs zit of de plek gratis is; anders "per persoon per nacht" × 2.
 * - Stroom: "per nacht" telt één keer, "per persoon per nacht" × 2. Noemt de plek geen stroomtoeslag, dan tellen we
 *   niets en zeggen we ook niet dat stroom gratis is (de uitleg op de pagina zegt "geen toeslag genoemd").
 * - Hond, kind, extra auto, douche en dergelijke horen niet bij de standaardsituatie en blijven apart staan.
 */
export function nightTotal(p: TotalPlace, persons = TOTAL_PERSONS): NightTotal {
  const n = Math.max(1, Math.round(persons));
  const extras = (p.priceExtras ?? []).filter((x) => x.amount > 0);
  const out: NightTotal = { parts: [], open: [], from: !!p.priceFrom };

  if (p.priceEur !== undefined) {
    out.parts.push({ label: "Overnachting", amount: p.priceEur });
    // Een bedrag "per persoon" naast een basisprijs kan erbij komen of een extra volwassene zijn: dan geen totaal
    if (extras.some((x) => x.label === "Per persoon")) out.open.push("of de prijs per persoon erbij komt");
  } else {
    const pp = perPersonPrice(p);
    if (pp?.perNight) out.parts.push({ label: `${n} × ${pp.amount.toFixed(2).replace(".", ",")} p.p.`, amount: r2(pp.amount * n) });
    else return { ...out, open: ["prijs per nacht"] };
  }

  if (p.touristTaxIncluded !== true && p.priceEur !== 0) {
    const tax = extras.find((x) => x.label === "Toeristenbelasting" && x.unit === "per persoon per nacht");
    if (tax) out.parts.push({ label: "Toeristenbelasting", amount: r2(tax.amount * n) });
    else out.open.push("toeristenbelasting");
  }

  const power = extras.filter((x) => x.label === "Stroom");
  if (power.length) {
    const night = power.find((x) => x.unit === "per nacht");
    const pp = power.find((x) => x.unit === "per persoon per nacht");
    if (night) out.parts.push({ label: "Stroom", amount: night.amount });
    else if (pp) out.parts.push({ label: "Stroom", amount: r2(pp.amount * n) });
    else out.open.push(power.some((x) => x.unit === "per kWh") ? "stroom (per kWh)" : "stroom");
  }

  if (!out.open.length) out.total = r2(out.parts.reduce((s, x) => s + x.amount, 0));
  return out;
}
