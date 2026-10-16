import type { ExpenseSummary } from "./expenses";

type StatStop = { nights: number; place: { priceEur?: number; power?: boolean } };

export type TripStats = {
  stops: number;
  nights: number;
  km: number | null;
  /** Gemiddelde nachtprijs volgens de plekken, alleen over nachten met een bekende prijs */
  avgPricePerNight: number | null;
  knownPriceNights: number;
  /** Nachten per stroomsituatie; onbekend blijft onbekend */
  power: { met: number; zonder: number; onbekend: number };
  /** Aandeel nachten zonder stroom, alleen over nachten waarvan het bekend is */
  offGridShare: number | null;
  /** Werkelijk uitgegeven aan overnachtingen per nacht (uit de uitgaven) */
  spentPerNight: number | null;
  freeNights: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function tripStats(stops: StatStop[], routeKm: number | null, spent?: Pick<ExpenseSummary, "byCategory">): TripStats {
  let nights = 0;
  let priced = 0;
  let pricedNights = 0;
  let free = 0;
  const power = { met: 0, zonder: 0, onbekend: 0 };
  for (const s of stops) {
    const n = Math.max(0, s.nights);
    nights += n;
    if (s.place.priceEur !== undefined) {
      priced += s.place.priceEur * n;
      pricedNights += n;
      if (s.place.priceEur === 0) free += n;
    }
    if (s.place.power === true) power.met += n;
    else if (s.place.power === false) power.zonder += n;
    else power.onbekend += n;
  }
  const knownPower = power.met + power.zonder;
  const stayCost = spent?.byCategory.overnachting ?? 0;
  return {
    stops: stops.length,
    nights,
    km: routeKm === null ? null : Math.round(routeKm),
    avgPricePerNight: pricedNights ? r2(priced / pricedNights) : null,
    knownPriceNights: pricedNights,
    power,
    offGridShare: knownPower ? power.zonder / knownPower : null,
    spentPerNight: nights && stayCost > 0 ? r2(stayCost / nights) : null,
    freeNights: free,
  };
}
