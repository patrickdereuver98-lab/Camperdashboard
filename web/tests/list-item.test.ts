// /api/places zonder id en fotovermelding (audit 1 november 2026)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { toListItem } from "../src/lib/list-item.ts";
import type { PlaceSummary } from "../src/lib/types.ts";

const place = {
  id: "6f2b4312-f79f-493d-a1e7-b01f98582188",
  slug: "de-wei-zwolle",
  name: "De Wei",
  town: "Zwolle",
  province: "Overijssel",
  lat: 52.5123456,
  lng: 6.0898765,
  priceEur: 15,
  priceExtras: [{ label: "Toeristenbelasting", amount: 1.68, unit: "per persoon per nacht" }],
  imageUrl: "https://example.nl/foto.jpg",
  imageCredit: "example.nl",
  ratingCount: 0,
  completeness: 0.5,
} as unknown as PlaceSummary;

test("zonder id en fotovermelding, de rest blijft", () => {
  const out = toListItem(place) as Record<string, unknown>;
  assert.equal("id" in out, false);
  assert.equal("imageCredit" in out, false);
  assert.equal(out.slug, "de-wei-zwolle");
  assert.deepEqual(out.priceExtras, place.priceExtras); // prijs met alle toeslagen blijft
  assert.equal(out.imageUrl, "https://example.nl/foto.jpg");
});

test("coördinaten op 5 decimalen (±1 m)", () => {
  const out = toListItem(place);
  assert.equal(out.lat, 52.51235);
  assert.equal(out.lng, 6.08988);
});

test("het origineel blijft ongewijzigd (de server-cache deelt het object)", () => {
  toListItem(place);
  assert.equal(place.id, "6f2b4312-f79f-493d-a1e7-b01f98582188");
  assert.equal(place.lat, 52.5123456);
});
