import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mergeTrips, sameTrip } from "../src/lib/trip-merge.ts";

test("mergeTrips: toestel eerst, daarna alleen-in-account", () => {
  const merged = mergeTrips(
    [{ slug: "b", nights: 2 }, { slug: "a", nights: 1 }],
    [{ slug: "a", nights: 5 }, { slug: "c", nights: 3 }],
  );
  assert.deepEqual(merged, [{ slug: "b", nights: 2 }, { slug: "a", nights: 1 }, { slug: "c", nights: 3 }]);
});

test("mergeTrips: rommel uit het account wordt genegeerd en nachten begrensd", () => {
  const merged = mergeTrips([], [null, 3, { slug: "../x" }, { slug: "ok", nights: 99 }, { slug: "nul", nights: 0 }, "x"]);
  assert.deepEqual(merged, [{ slug: "ok", nights: 21 }, { slug: "nul", nights: 1 }]);
  assert.deepEqual(mergeTrips([{ slug: "a", nights: 1 }], { not: "an array" }), [{ slug: "a", nights: 1 }]);
});

test("sameTrip", () => {
  assert.equal(sameTrip([{ slug: "a", nights: 1 }], [{ slug: "a", nights: 1 }]), true);
  assert.equal(sameTrip([{ slug: "a", nights: 1 }], [{ slug: "a", nights: 2 }]), false);
});
