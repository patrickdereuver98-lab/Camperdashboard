import { strict as assert } from "node:assert";
import { test } from "node:test";
import { distanceKm } from "../src/lib/geo.ts";

test("distanceKm: Amsterdam – Utrecht is ongeveer 35 km", () => {
  const km = distanceKm({ lat: 52.3731, lng: 4.8922 }, { lat: 52.0907, lng: 5.1214 });
  assert.ok(km > 33 && km < 37, `kreeg ${km}`);
});

test("distanceKm: zelfde punt is 0", () => {
  assert.equal(distanceKm({ lat: 52, lng: 5 }, { lat: 52, lng: 5 }), 0);
});
