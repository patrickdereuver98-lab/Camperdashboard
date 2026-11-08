// Vaste getallen (12:00, 11:00, 2 personen, 24 uur) alleen in hun eigen patroon (DATA-15).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allowedNumbers, maskFixedNumbers, parseFacts } from "../src/lib/marketing/facts.ts";

const facts = parseFacts({ places: 2186, provinces: [], departure: {}, price: {}, facilities: {}, reviews: {} })!;

test("maskFixedNumbers haalt alleen de vaste patronen weg", () => {
  assert.doesNotMatch(maskFixedNumbers("Vertrek tot 12:00, voor 2 personen, per 24 uur"), /\d/);
  assert.match(maskFixedNumbers("12 gratis plekken"), /12/);
  assert.match(maskFixedNumbers("2 provincies"), /2/);
});

test("met tekst: vaste getallen alleen in hun patroon", () => {
  assert.ok(allowedNumbers(facts, "Blijf tot 12:00").has(12));
  assert.ok(allowedNumbers(facts, "Prijs voor 2 personen").has(2));
  // Een losse 12 of 2 is geen vast getal
  assert.ok(!allowedNumbers(facts, "12 gratis plekken").has(12));
  assert.ok(!allowedNumbers(facts, "Tot 12:00, en 12 gratis plekken").has(12));
  assert.ok(!allowedNumbers(facts, "2 nieuwe plekken").has(2));
  assert.ok(!allowedNumbers(facts, "").has(24));
  // Feiten blijven toegestaan
  assert.ok(allowedNumbers(facts, "2.186 camperplaatsen").has(2186));
});

test("zonder tekst: zoals vroeger (bestaande aanroepers)", () => {
  for (const n of [2, 11, 12, 24]) assert.ok(allowedNumbers(facts).has(n));
});
