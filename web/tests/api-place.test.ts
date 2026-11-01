import { test } from "node:test";
import assert from "node:assert/strict";
import { fromApiPlace, toApiPlace } from "../src/lib/api-place";
import type { PlaceSummary } from "../src/lib/types";

const base: PlaceSummary = {
  id: "1", slug: "a", name: "A", lat: 52.123456789, lng: 4.987654321, town: "T", province: "P",
  ratingCount: 0, completeness: 0.46321, imageCredit: "voorbeeld.nl",
  priceEur: 12, priceExtras: [{ label: "Toeristenbelasting", amount: 1.5, unit: "per persoon per nacht" }],
};

test("toApiPlace laat fotobron en ratingCount 0 weg en rondt coördinaten af", () => {
  const out = toApiPlace(base);
  assert.equal("imageCredit" in out, false);
  assert.equal("ratingCount" in out, false);
  assert.equal(out.lat, 52.12346);
  assert.equal(out.lng, 4.98765);
  assert.equal(out.completeness, 0.46321);
  assert.deepEqual(out.priceExtras, base.priceExtras);
});

test("ratingCount blijft bij reviews, en fromApiPlace vult 0 weer in", () => {
  assert.equal(toApiPlace({ ...base, ratingCount: 3, ratingAvg: 8 }).ratingCount, 3);
  assert.equal(fromApiPlace(toApiPlace(base)).ratingCount, 0);
});
