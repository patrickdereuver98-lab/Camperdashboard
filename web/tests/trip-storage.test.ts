import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clampNights, decodeTrip, decodeTripPlaces, encodeTrip, encodeTripPlaces, TRIP_VERSION } from "../src/lib/trip-storage.ts";
import type { PlaceSummary } from "../src/lib/types.ts";

test("clampNights: heel getal van 1 t/m 21, anders 1", () => {
  assert.equal(clampNights(3), 3);
  assert.equal(clampNights(2.6), 3);
  assert.equal(clampNights(0), 1);
  assert.equal(clampNights(-4), 1);
  assert.equal(clampNights(99), 21);
  assert.equal(clampNights("5"), 5);
  assert.equal(clampNights("abc"), 1);
  assert.equal(clampNights(undefined), 1);
  assert.equal(clampNights(Infinity), 1);
});

test("decodeTrip: versie 1 (losse lijst) wordt omgezet", () => {
  assert.deepEqual(decodeTrip([{ slug: "a", nights: 2 }, { slug: "b" }, { slug: "c", nights: "x" }]), [
    { slug: "a", nights: 2 },
    { slug: "b", nights: 1 },
    { slug: "c", nights: 1 },
  ]);
});

test("decodeTrip: versie 2 met begrensde nachten, rommel valt weg", () => {
  assert.deepEqual(decodeTrip({ v: 2, stops: [{ slug: "a", nights: 50 }, null, { slug: "../x" }, { slug: "a", nights: 1 }] }), [{ slug: "a", nights: 21 }]);
  assert.equal(decodeTrip({ v: 2 }), undefined);
  assert.equal(decodeTrip("reis"), undefined);
  assert.equal(decodeTrip(null), undefined);
});

test("encodeTrip: met versieveld", () => {
  assert.deepEqual(encodeTrip([{ slug: "a", nights: 0 }]), { v: TRIP_VERSION, stops: [{ slug: "a", nights: 1 }] });
  assert.deepEqual(decodeTrip(encodeTrip([{ slug: "a", nights: 4 }])), [{ slug: "a", nights: 4 }]);
});

test("reisplekken: met savedAt, oude kopie zonder datum blijft bruikbaar", () => {
  const places = [{ slug: "a" }, { slug: "b" }] as PlaceSummary[];
  const copy = encodeTripPlaces(places, ["b"], "2026-11-01T10:00:00.000Z");
  assert.deepEqual(copy, { v: TRIP_VERSION, savedAt: "2026-11-01T10:00:00.000Z", places: [{ slug: "b" }] });
  assert.deepEqual(decodeTripPlaces(JSON.parse(JSON.stringify(copy))), { places: [{ slug: "b" }], savedAt: "2026-11-01T10:00:00.000Z" });
  assert.deepEqual(decodeTripPlaces([{ slug: "a" }]), { places: [{ slug: "a" }], savedAt: null });
  assert.deepEqual(decodeTripPlaces({ places: [], savedAt: "gisteren" }), { places: [], savedAt: null });
  assert.deepEqual(decodeTripPlaces("x"), { places: [], savedAt: null });
});
