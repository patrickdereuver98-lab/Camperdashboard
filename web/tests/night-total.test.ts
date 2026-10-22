// Totaalprijs per nacht voor 2 personen: alleen wat eenduidig is, anders zeggen wat ontbreekt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nightTotal } from "../src/lib/trip-extras.ts";

const tax = (amount: number, unit = "per persoon per nacht") => ({ label: "Toeristenbelasting", amount, unit });

test("basisprijs + toeristenbelasting × 2 + stroom per nacht", () => {
  const t = nightTotal({ priceEur: 20, priceExtras: [tax(1.35), { label: "Stroom", amount: 3.5, unit: "per nacht" }] });
  assert.equal(t.total, 26.2);
  assert.deepEqual(t.parts.map((x) => x.label), ["Overnachting", "Toeristenbelasting", "Stroom"]);
  assert.deepEqual(t.open, []);
});

test("toeristenbelasting in de prijs: niets erbij, totaal is de basisprijs", () => {
  assert.equal(nightTotal({ priceEur: 18, touristTaxIncluded: true }).total, 18);
});

test("gratis plek: geen toeristenbelasting nodig", () => {
  assert.equal(nightTotal({ priceEur: 0 }).total, 0);
});

test("toeristenbelasting onbekend: geen totaal, wel genoemd wat ontbreekt", () => {
  const t = nightTotal({ priceEur: 20 });
  assert.equal(t.total, undefined);
  assert.deepEqual(t.open, ["toeristenbelasting"]);
  assert.deepEqual(nightTotal({ priceEur: 20, priceExtras: [tax(1.2, "per nacht")] }).open, ["toeristenbelasting"]);
});

test("stroom per kWh of zonder eenheid: geen totaal", () => {
  assert.deepEqual(nightTotal({ priceEur: 20, touristTaxIncluded: true, priceExtras: [{ label: "Stroom", amount: 0.5, unit: "per kWh" }] }).open, ["stroom (per kWh)"]);
  assert.deepEqual(nightTotal({ priceEur: 20, touristTaxIncluded: true, priceExtras: [{ label: "Stroom", amount: 3 }] }).open, ["stroom"]);
});

test("zonder basisprijs: prijs per persoon per nacht × 2", () => {
  const t = nightTotal({ priceExtras: [{ label: "Per persoon", amount: 7.5, unit: "per persoon per nacht" }, tax(1)] });
  assert.equal(t.total, 17);
});

test("zonder basisprijs en zonder nachtprijs per persoon: geen totaal", () => {
  assert.deepEqual(nightTotal({ priceExtras: [{ label: "Per persoon", amount: 5, unit: "per persoon" }] }).open, ["prijs per nacht"]);
  assert.deepEqual(nightTotal({}).open, ["prijs per nacht"]);
});

test("hond, kind en extra auto tellen niet mee", () => {
  const t = nightTotal({ priceEur: 15, touristTaxIncluded: true, priceExtras: [{ label: "Hond", amount: 2, unit: "per nacht" }, { label: "Kind", amount: 3, unit: "per nacht" }] });
  assert.equal(t.total, 15);
});

test("bedrag per persoon naast een basisprijs: onduidelijk of het erbij komt, dus geen totaal", () => {
  const t = nightTotal({ priceEur: 15.7, priceExtras: [tax(0.9), { label: "Stroom", amount: 2, unit: "per nacht" }, { label: "Per persoon", amount: 1, unit: "per persoon" }] });
  assert.equal(t.total, undefined);
  assert.deepEqual(t.open, ["of de prijs per persoon erbij komt"]);
});
