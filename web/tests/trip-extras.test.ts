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

test("R46: per persoon náást een basisprijs is een verplichte toeslag: × personen × nachten", () => {
  const s = stopSurcharges(stop(2, { priceEur: 20, priceExtras: [{ label: "Per persoon", amount: 5, unit: "per persoon per nacht" }] }), 2);
  assert.equal(s.stayFromPerPerson, undefined);
  assert.equal(s.perPerson, 20);
  assert.deepEqual(s.listed, []);
  assert.equal(s.assumed, undefined);
  // Zonder eenheid of alleen "per persoon": ook per nacht gerekend, maar als aanname gemarkeerd
  const loose = stopSurcharges(stop(3, { priceEur: 20, priceExtras: [{ label: "Per persoon", amount: 4 }] }), 2);
  assert.equal(loose.perPerson, 24);
  assert.deepEqual(loose.assumed, [{ label: "Per persoon", amount: 4 }]);
  // Per keer: niet als nachttoeslag, wel genoemd
  const once = stopSurcharges(stop(3, { priceEur: 20, priceExtras: [{ label: "Per persoon", amount: 4, unit: "per keer" }] }), 2);
  assert.equal(once.perPerson, undefined);
  assert.equal(once.listed.length, 1);
});

test("situatie-afhankelijk: genoemd, niet geteld; toeristenbelasting zonder eenheid telt per persoon per nacht", () => {
  const s = stopSurcharges(
    stop(2, {
      priceEur: 15,
      priceExtras: [
        { label: "Toeristenbelasting", amount: 1.2 },
        { label: "Hond", amount: 2, unit: "per nacht" },
        { label: "Stroom", amount: 0.5, unit: "per kWh" },
        { label: "Douche", amount: 1, unit: "per keer" },
        { label: "Kind", amount: 3, unit: "per persoon per nacht" },
      ],
    }),
    2,
  );
  assert.equal(s.touristTax, 4.8);
  assert.equal(s.taxRule, true);
  assert.deepEqual(s.assumed, [{ label: "Toeristenbelasting", amount: 1.2 }]);
  assert.deepEqual(s.listed.map((x) => x.label), ["Hond", "Stroom", "Douche", "Kind"]);
});

test("R25: toeristenbelasting met een andere eenheid verdwijnt niet en er komt geen schatting bij", () => {
  const tax = { label: "Toeristenbelasting", amount: 2.5, unit: "per nacht" };
  const s = stopSurcharges(stop(2, { priceEur: 15, priceExtras: [tax] }), 2);
  assert.equal(s.touristTax, undefined);
  assert.equal(s.taxRule, true);
  assert.deepEqual(s.listed, [tax]);
  const c = tripCosts([stop(2, { priceEur: 15, priceExtras: [tax] })], 2, 1.5);
  assert.equal(c.taxEstimatedNights, 0);
  assert.equal(c.tax, 0);
  assert.deepEqual(c.listed, [{ index: 0, extras: [tax] }]);
});

test("tripCosts: toeslag per persoon telt mee in de overnachtingen, vanaf-prijs gemarkeerd", () => {
  const c = tripCosts(
    [
      stop(2, { priceEur: 20, priceExtras: [{ label: "Per persoon", amount: 5, unit: "per nacht" }] }),
      stop(1, { priceEur: 10, priceFrom: true }),
      stop(1, { priceEur: 12, priceExtras: [{ label: "Hond", amount: 2 }] }),
    ],
    3,
    0,
  );
  assert.equal(c.perPerson, 30);
  assert.equal(c.stay, 40 + 30 + 10 + 12);
  assert.equal(c.fromPriceStops, 1);
  assert.deepEqual(c.listed, [{ index: 2, extras: [{ label: "Hond", amount: 2 }] }]);
  assert.deepEqual(c.assumed, []);
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
