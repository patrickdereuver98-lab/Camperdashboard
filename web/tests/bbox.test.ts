import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bboxKey, inBbox, parseBbox, snapBbox } from "../src/lib/bbox.ts";

test("parseBbox accepteert vier getallen in de juiste volgorde", () => {
  assert.deepEqual(parseBbox("4.8,51.9,5.6,52.3"), [4.8, 51.9, 5.6, 52.3]);
});

test("parseBbox weigert rommel en omgedraaide hoeken", () => {
  for (const raw of [null, "", "1,2,3", "a,b,c,d", "5,52,4,53", "4,53,5,52", "4,52,5,NaN", "-200,0,0,1"]) {
    assert.equal(parseBbox(raw), null, String(raw));
  }
});

test("snapBbox rondt naar buiten af op het raster", () => {
  assert.deepEqual(snapBbox([4.81, 51.93, 5.61, 52.27]), [4.75, 51.75, 5.75, 52.5]);
});

test("snapBbox: kleine verschuivingen geven dezelfde cache-sleutel", () => {
  assert.equal(bboxKey(snapBbox([4.81, 51.93, 5.4, 52.1])), bboxKey(snapBbox([4.86, 51.95, 5.45, 52.2])));
});

test("snapBbox begrenst tot rond Nederland", () => {
  assert.deepEqual(snapBbox([-20, 30, 40, 70]), [2.5, 50.3, 7.9, 54]);
});

test("inBbox", () => {
  assert.equal(inBbox({ lat: 52.09, lng: 5.12 }, [4.8, 51.9, 5.6, 52.3]), true);
  assert.equal(inBbox({ lat: 53.2, lng: 5.12 }, [4.8, 51.9, 5.6, 52.3]), false);
});
