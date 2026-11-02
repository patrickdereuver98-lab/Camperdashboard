import { strict as assert } from "node:assert";
import { test } from "node:test";
import { departureQuestion } from "../src/lib/plekpuls";

test("Plekpuls vraagt naar de vertrektijd die we kennen", () => {
  const q = departureQuestion({ slug: "a", departure: "vast", checkoutUntil: "12:00" });
  assert.equal(q?.question, "Klopt het: vertrek uiterlijk 12:00?");
  assert.equal(departureQuestion({ slug: "a", departure: "vrij" })?.question, "Klopt het: geen vaste vertrektijd?");
});

test("onbekend of onleesbaar: geen vraag", () => {
  assert.equal(departureQuestion({ slug: "a" }), undefined);
  assert.equal(departureQuestion({ slug: "a", departure: "vast", checkoutUntil: "na de lunch" }), undefined);
  assert.equal(departureQuestion({ slug: "a", departure: "vrij", departureCheck: "afgewezen" }), undefined);
});

test("een ander feit is een nieuwe vraag", () => {
  const a = departureQuestion({ slug: "a", departure: "vast", checkoutUntil: "11:00" });
  const b = departureQuestion({ slug: "a", departure: "vast", checkoutUntil: "12:00" });
  assert.notEqual(a?.key, b?.key);
});
