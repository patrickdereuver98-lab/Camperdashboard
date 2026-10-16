import { strict as assert } from "node:assert";
import { test } from "node:test";
import { stopSurcharges, tripCosts } from "../src/lib/trip-extras.ts";

const stop = (nights: number, place: Record<string, unknown>) => ({ nights, place });

test("toeristenbelasting per persoon per nacht: × personen × nachten", () => {
  const s = stopSurcharges(stop(3, { priceEur: 20, priceExtras: [{ label: "Toeristenbelasting", amount: 1.5, unit: "per persoon per nacht" }] }), 2);
  assert.equal(s.touristTax, 9);
  assert.deepEqual(s.listed, []);
});

test("per persoon zonder basisprijs is de nachtprijs", () => {
  const s = stopSurcharges(stop(2, { priceExtras: [{ label: "Per persoon", amount: 7.5, unit: "per persoon per nacht" }] }), 2);
  assert.equal(s.stayFromPerPerson, 30);
  assert.equal(stopSurcharges(stop(2, { priceExtras: [{ label: "Per persoon", amount: 7.5, unit: "per nacht" }] }), 2).stayFromPerPerson, 30);
});

test("per persoon náást een basisprijs telt niet mee (kan 'extra volwassene' zijn) maar wordt genoemd", () => {
  const s = stopSurcharges(stop(2, { priceEur: 20, priceExtras: [{ label: "Per persoon", amount: 5, unit: "per persoon per nacht" }] }), 2);
  assert.equal(s.stayFromPerPerson, undefined);
  assert.deepEqual(s.listed, [{ label: "Per persoon", amount: 5, unit: "per persoon per nacht" }]);
});

test("onbekende eenheid of situatie-afhankelijk: genoemd, niet geteld", () => {
  const s = stopSurcharges(
    stop(2, {
      priceEur: 15,
      priceExtras: [
        { label: "Toeristenbelasting", amount: 1.2 },
        { label: "Hond", amount: 2, unit: "per nacht" },
        { label: "Stroom", amount: 0.5, unit: "per kWh" },
      ],
    }),
    2,
  );
  assert.equal(s.touristTax, undefined);
  assert.deepEqual(s.listed.map((x) => x.label), ["Hond", "Stroom"]);
});

test("geen toeristenbelasting bij gratis plekken of als die al in de prijs zit", () => {
  const tax = [{ label: "Toeristenbelasting", amount: 1.5, unit: "per persoon per nacht" }];
  assert.equal(stopSurcharges(stop(1, { priceEur: 0, priceExtras: tax }), 2).touristTax, undefined);
  assert.equal(stopSurcharges(stop(1, { priceEur: 10, touristTaxIncluded: true, priceExtras: tax }), 2).touristTax, undefined);
});

test("tripCosts: bekende belasting vervangt de schatting alleen voor die plek", () => {
  const c = tripCosts(
    [
      stop(2, { priceEur: 20, priceExtras: [{ label: "Toeristenbelasting", amount: 2, unit: "per persoon per nacht" }] }),
      stop(1, { priceEur: 15 }),
      stop(3, { priceExtras: [{ label: "Per persoon", amount: 6, unit: "per persoon per nacht" }] }),
      stop(1, {}),
      stop(2, { priceEur: 0 }),
    ],
    2,
    1.5,
  );
  assert.equal(c.stay, 20 * 2 + 15 + 6 * 2 * 3);
  assert.equal(c.unknownPriceStops, 1);
  assert.equal(c.taxKnown, 8);
  // Schatting voor stop 2 (1 nacht), stop 3 (3 nachten) en stop 4 (1 nacht); stop 5 is gratis
  assert.equal(c.taxEstimatedNights, 5);
  assert.equal(c.tax, 8 + 2 * 1.5 * 5);
});
