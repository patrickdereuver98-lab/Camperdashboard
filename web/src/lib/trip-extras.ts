export type Extra = { label: string; amount: number; unit?: string };
type ExtrasStop = { nights: number; place: { priceEur?: number; priceExtras?: Extra[]; touristTaxIncluded?: boolean; priceFrom?: boolean } };

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
  /** Verplichte toeslag per persoon naast de basisprijs ("Per persoon"), × personen × nachten (R46) */
  perPerson?: number;
  /** De plek noemt een regel voor toeristenbelasting (meegeteld of genoemd): dan geen schatting erbij */
  taxRule?: boolean;
  /** Meegeteld als per persoon per nacht terwijl de bron alleen "per persoon" of geen eenheid noemde */
  assumed?: Extra[];
  /** De toeslagen achter `touristTax` en `perPerson` (voor labels en aannames) */
  counted?: { touristTax?: Extra; perPerson?: Extra };
  /** Toeslagen die we niet meetellen: hangt af van je situatie, of de eenheid past niet */
  listed: Extra[];
};

/** Eenheden van een overnachtingstoeslag per persoon die we per persoon per nacht rekenen */
const NIGHTLY_UNITS = new Set([undefined, "per persoon per nacht", "per persoon"]);

/**
 * Losse toeslagen van een stop. Verplichte kosten per persoon tellen mee, × personen × nachten (R46):
 * - Toeristenbelasting: per persoon per nacht, ook als de bron alleen "per persoon" of geen eenheid noemt (een
 *   overnachtingstoeslag per persoon; dan staat hij ook in `assumed`). Een andere eenheid (per nacht, per keer)
 *   noemen we apart, en dan komt er geen schatting bij (R25).
 * - "Per persoon" bij een plek zonder basisprijs: dat ís de prijs (alleen als die per nacht is, zie perPersonPrice).
 * - "Per persoon" naast een basisprijs: verplichte toeslag per persoon per nacht (`perPerson`), met dezelfde eenheden.
 * Wat van je situatie afhangt (hond, kind, douche, stroom, water, lozen, extra auto, later vertrekken) noemen we apart.
 */
export function stopSurcharges(s: ExtrasStop, persons: number): StopSurcharges {
  const nights = Math.max(0, s.nights);
  const p = Math.max(1, Math.round(persons));
  const out: StopSurcharges = { listed: [] };
  const pp = perPersonPrice(s.place);
  const taxApplies = s.place.touristTaxIncluded !== true && s.place.priceEur !== 0;
  const assume = (x: Extra) => {
    if (!perPersonPerNight(x)) (out.assumed ??= []).push(x);
  };
  for (const x of s.place.priceExtras ?? []) {
    if (!(x.amount > 0)) continue;
    if (x.label === "Toeristenbelasting") {
      // Gratis of al in de prijs: niets erbij
      if (!taxApplies) continue;
      out.taxRule = true;
      if (NIGHTLY_UNITS.has(x.unit) && out.touristTax === undefined) {
        out.touristTax = r2(x.amount * p * nights);
        (out.counted ??= {}).touristTax = x;
        assume(x);
      } else out.listed.push(x);
    } else if (pp?.perNight && x === pp.extra) {
      out.stayFromPerPerson = r2(x.amount * p * nights);
    } else if (
      x.label === "Per persoon" &&
      s.place.priceEur !== undefined &&
      s.place.priceEur > 0 &&
      (NIGHTLY_UNITS.has(x.unit) || x.unit === "per nacht") &&
      out.perPerson === undefined
    ) {
      out.perPerson = r2(x.amount * p * nights);
      (out.counted ??= {}).perPerson = x;
      assume(x);
    } else {
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
  /** Deel van `stay`: verplichte toeslagen per persoon naast de basisprijs (R46) */
  perPerson?: number;
  /** Stops waarvan de nachtprijs een vanaf-prijs is (laagste tarief): het totaal kan hoger uitvallen */
  fromPriceStops?: number;
  /** Per stop de bedragen die we als per persoon per nacht rekenden zonder dat de bron "per nacht" zei */
  assumed?: { index: number; extras: Extra[] }[];
};

export function tripCosts(stops: ExtrasStop[], persons: number, touristTaxEstimate: number): TripCosts {
  let stay = 0;
  let unknown = 0;
  let taxKnown = 0;
  let estNights = 0;
  let perPerson = 0;
  let fromStops = 0;
  const listed: TripCosts["listed"] = [];
  const assumed: NonNullable<TripCosts["assumed"]> = [];
  stops.forEach((s, index) => {
    const sur = stopSurcharges(s, persons);
    if (s.place.priceEur !== undefined) stay += s.place.priceEur * s.nights;
    else if (sur.stayFromPerPerson !== undefined) stay += sur.stayFromPerPerson;
    else unknown++;
    if (sur.perPerson !== undefined) {
      stay += sur.perPerson;
      perPerson += sur.perPerson;
    }
    if (s.place.priceFrom && s.place.priceEur !== undefined && s.place.priceEur > 0) fromStops++;
    if (sur.touristTax !== undefined) taxKnown += sur.touristTax;
    // Schatting alleen als de plek zelf geen belastingregel noemt (R25)
    else if (!sur.taxRule && s.place.priceEur !== 0 && s.place.touristTaxIncluded !== true) estNights += s.nights;
    if (sur.listed.length) listed.push({ index, extras: sur.listed });
    if (sur.assumed?.length) assumed.push({ index, extras: sur.assumed });
  });
  const p = Math.max(1, Math.round(persons));
  return {
    stay: r2(stay),
    unknownPriceStops: unknown,
    taxKnown: r2(taxKnown),
    taxEstimatedNights: estNights,
    tax: r2(taxKnown + p * touristTaxEstimate * estNights),
    listed,
    perPerson: r2(perPerson),
    fromPriceStops: fromStops,
    assumed,
  };
}

/** Standaardsituatie voor de totaalprijs op kaart en plekpagina: 2 volwassenen, 1 nacht, met stroom (review 3.1) */
export const TOTAL_PERSONS = 2;

export type NightTotal = {
  /** Totaal per nacht voor TOTAL_PERSONS personen; alleen als elk onderdeel vaststaat */
  total?: number;
  /** Waaruit het totaal bestaat, in leesbare stukjes */
  parts: { label: string; amount: number }[];
  /** Wat ontbreekt voor een totaal ("toeristenbelasting", "stroom (per kWh)", "eenheid toeristenbelasting") */
  open: string[];
  /** De basisprijs is een vanaf-prijs */
  from: boolean;
  /** Meegeteld als per persoon per nacht terwijl de bron dat niet zo noemde (zelfde regel als Mijn reis) */
  assumed?: Extra[];
};

type TotalPlace = PricedPlace & { priceFrom?: boolean; touristTaxIncluded?: boolean };

const amountNl = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Wat een nacht kost voor 2 personen, met toeristenbelasting en stroom. Dezelfde regels als Mijn reis
 * (`stopSurcharges` voor 1 nacht), plus stroom omdat die bij de standaardsituatie hoort. Een onderdeel telt alleen mee
 * als het bedrag vaststaat; een aanname over de eenheid staat in `assumed` en in het label. Is iets onbekend, dan geen
 * totaal maar een lijst `open`.
 * - Overnachting: de basisprijs, of bij een plek zonder basisprijs de prijs per persoon per nacht × 2.
 * - Per persoon naast een basisprijs: verplichte toeslag × 2 (R46). Met een andere eenheid (per keer): geen totaal.
 * - Toeristenbelasting: 0 als die in de prijs zit of de plek gratis is; anders × 2, ook zonder eenheid (aanname).
 *   Met een andere eenheid (per nacht, per keer) weten we niet wat het voor 2 personen is: geen totaal.
 * - Stroom: "per nacht" telt één keer, "per persoon per nacht" × 2. Noemt de plek geen stroomtoeslag, dan tellen we
 *   niets en zeggen we ook niet dat stroom gratis is (de uitleg op de pagina zegt "geen toeslag genoemd").
 * - Hond, kind, extra auto, douche en dergelijke horen niet bij de standaardsituatie en blijven apart staan.
 */
export function nightTotal(p: TotalPlace, persons = TOTAL_PERSONS): NightTotal {
  const n = Math.max(1, Math.round(persons));
  const extras = (p.priceExtras ?? []).filter((x) => x.amount > 0);
  const out: NightTotal = { parts: [], open: [], from: !!p.priceFrom };
  const sur = stopSurcharges({ nights: 1, place: p }, n);
  const assumed = new Set(sur.assumed ?? []);
  const label = (base: string, x: Extra | undefined) => (x && assumed.has(x) ? `${base} (aanname: per persoon per nacht)` : base);

  if (p.priceEur !== undefined) out.parts.push({ label: "Overnachting", amount: p.priceEur });
  else if (sur.stayFromPerPerson !== undefined) {
    const pp = perPersonPrice(p)!;
    out.parts.push({ label: `${n} × ${amountNl(pp.amount)} p.p.`, amount: sur.stayFromPerPerson });
  } else return { ...out, open: ["prijs per nacht"] };

  const counted = sur.counted ?? {};
  if (sur.perPerson !== undefined && counted.perPerson) {
    const x = counted.perPerson;
    out.parts.push({ label: label(`Toeslag ${n} × ${amountNl(x.amount)} p.p.`, x), amount: sur.perPerson });
  }
  // Een bedrag per persoon dat we niet meetellen (per keer, of naast een gratis plek): dan geen totaal
  if (sur.listed.some((x) => x.label === "Per persoon")) out.open.push("of de prijs per persoon erbij komt");

  if (p.touristTaxIncluded !== true && p.priceEur !== 0) {
    if (sur.touristTax !== undefined) out.parts.push({ label: label("Toeristenbelasting", counted.touristTax), amount: sur.touristTax });
    // Noemt de plek een bedrag met een andere eenheid, dan is niet het bedrag onbekend maar waar het voor geldt
    else out.open.push(sur.taxRule ? "eenheid toeristenbelasting" : "toeristenbelasting");
  }

  const power = extras.filter((x) => x.label === "Stroom");
  if (power.length) {
    const night = power.find((x) => x.unit === "per nacht");
    const pp = power.find((x) => x.unit === "per persoon per nacht");
    if (night) out.parts.push({ label: "Stroom", amount: night.amount });
    else if (pp) out.parts.push({ label: "Stroom", amount: r2(pp.amount * n) });
    else out.open.push(power.some((x) => x.unit === "per kWh") ? "stroom (per kWh)" : "stroom");
  }

  if (sur.assumed?.length) out.assumed = sur.assumed;
  if (!out.open.length) out.total = r2(out.parts.reduce((s, x) => s + x.amount, 0));
  return out;
}
