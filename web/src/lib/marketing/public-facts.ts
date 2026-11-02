/**
 * Feiten uit de openbare plekgegevens (getSummaries), voor de beeldsjablonen (/api/marketing/beeld) en de
 * filmpjes. Zelfde regels als public.marketing_facts(): vertrekgroepen via departureKind, alleen gepubliceerde
 * plekken (getSummaries geeft niets anders). Geen nieuwe/gecontroleerde aantallen: die staan niet in de samenvatting.
 */
import { departureKind } from "../search";
import type { PlaceSummary } from "../types";
import type { Facts } from "./facts";

export function factsFromSummaries(places: PlaceSummary[], now = new Date()): Facts {
  const prov = new Map<string, number>();
  const dep = { known: 0, vrij: 0, uitslapers: 0, ruim: 0, vroeg: 0 };
  const prices: number[] = [];
  let free = 0;
  let priced = 0;
  const fac = { power: 0, water: 0, dump: 0, dogs: 0 };
  for (const p of places) {
    if (p.province) prov.set(p.province, (prov.get(p.province) ?? 0) + 1);
    const k = departureKind(p);
    if (k !== "onbekend") {
      dep.known++;
      dep[k]++;
    }
    if (p.priceEur !== undefined) {
      priced++;
      if (p.priceEur === 0) free++;
      else prices.push(p.priceEur);
    }
    if (p.power) fac.power++;
    if (p.water) fac.water++;
    if (p.dumpStation) fac.dump++;
    if (p.dogs) fac.dogs++;
  }
  prices.sort((a, b) => a - b);
  const mid = prices.length / 2;
  const median = prices.length ? Math.round((prices.length % 2 ? prices[Math.floor(mid)] : (prices[mid - 1] + prices[mid]) / 2) * 100) / 100 : null;
  return {
    measured_at: now.toISOString(),
    places: places.length,
    provinces: [...prov.entries()].map(([province, n]) => ({ province, places: n })).sort((a, b) => b.places - a.places),
    departure: dep,
    price: { known: priced, free, median },
    facilities: fac,
    new_7d: 0,
    new_30d: 0,
    checked_30d: 0,
    reviews: { count: 0, avg: null },
  };
}
