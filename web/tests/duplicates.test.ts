import { strict as assert } from "node:assert";
import { test } from "node:test";
import { duplicateConfidence, pickKeep } from "../src/lib/duplicates.ts";

const p = (id: string, extra: Partial<{ status: string; osm: boolean; completeness: number; slug: string }> = {}) => ({
  id, slug: extra.slug ?? id, name: id, status: "draft", osm: false, completeness: 0.5, ...extra,
});

test("pickKeep: online gaat voor concept", () => {
  assert.equal(pickKeep(p("a"), p("b", { status: "published" })).keep.id, "b");
});
test("pickKeep: daarna de meest complete", () => {
  assert.equal(pickKeep(p("a", { completeness: 0.9 }), p("b", { completeness: 0.6 })).keep.id, "a");
});
test("pickKeep: daarna OSM, daarna kortste slug", () => {
  assert.equal(pickKeep(p("a"), p("b", { osm: true })).keep.id, "b");
  assert.equal(pickKeep(p("a", { slug: "plek-2" }), p("b", { slug: "plek" })).keep.id, "b");
});
test("pickKeep: gelijk → de eerste, en remove is altijd de ander", () => {
  const r = pickKeep(p("a"), p("b"));
  assert.deepEqual([r.keep.id, r.remove.id], ["a", "b"]);
});
test("duplicateConfidence", () => {
  assert.equal(duplicateConfidence(5, 0), "hoog");
  assert.equal(duplicateConfidence(90, 0.8), "hoog");
  assert.equal(duplicateConfidence(60, 0.1), "middel");
  assert.equal(duplicateConfidence(140, 0.35), "middel");
  assert.equal(duplicateConfidence(140, 0.1), "laag");
});
