import { strict as assert } from "node:assert";
import { test } from "node:test";
import { tripStats } from "../src/lib/trip-stats.ts";

const s = (nights: number, priceEur?: number, power?: boolean) => ({ nights, place: { priceEur, power } });

test("tripStats: nachten, km en gemiddelde over bekende prijzen", () => {
  const t = tripStats([s(2, 20, true), s(1, 0, false), s(3, undefined, undefined)], 412.6);
  assert.equal(t.stops, 3);
  assert.equal(t.nights, 6);
  assert.equal(t.km, 413);
  assert.equal(t.avgPricePerNight, 13.33); // (2×20 + 1×0) / 3 nachten met bekende prijs
  assert.equal(t.knownPriceNights, 3);
  assert.equal(t.freeNights, 1);
});

test("tripStats: off-grid alleen over nachten waarvan stroom bekend is", () => {
  const t = tripStats([s(2, 20, true), s(1, 0, false), s(3)], null);
  assert.deepEqual(t.power, { met: 2, zonder: 1, onbekend: 3 });
  assert.equal(t.offGridShare, 1 / 3);
  assert.equal(t.km, null);
});

test("tripStats: niets bekend = niets verzinnen", () => {
  const t = tripStats([s(2)], null);
  assert.equal(t.avgPricePerNight, null);
  assert.equal(t.offGridShare, null);
  assert.equal(t.spentPerNight, null);
});

test("tripStats: werkelijk per nacht uit de uitgaven", () => {
  const byCategory = { overnachting: 75, brandstof: 0, boodschappen: 0, eten: 0, tol: 0, overig: 0 };
  assert.equal(tripStats([s(2, 20), s(1, 30)], 100, { byCategory }).spentPerNight, 25);
});
