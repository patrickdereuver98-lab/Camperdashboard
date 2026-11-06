// Totaalprijs per nacht voor 2 personen: alleen wat eenduidig is, anders zeggen wat ontbreekt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nightTotal, stopSurcharges, tripCosts } from "../src/lib/trip-extras.ts";

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
});

test("toeristenbelasting met een andere eenheid: geen totaal, en niet 'onbekend' maar 'eenheid' (zelfde regel als Mijn reis)", () => {
  assert.deepEqual(nightTotal({ priceEur: 20, priceExtras: [tax(1.2, "per nacht")] }).open, ["eenheid toeristenbelasting"]);
  assert.deepEqual(nightTotal({ priceEur: 20, priceExtras: [tax(1.2, "per keer")] }).open, ["eenheid toeristenbelasting"]);
});

test("toeristenbelasting zonder eenheid: × 2 als aanname, zichtbaar in label en assumed", () => {
  const loose = { label: "Toeristenbelasting", amount: 1.2 };
  const t = nightTotal({ priceEur: 20, priceExtras: [loose] });
  assert.equal(t.total, 22.4);
  assert.deepEqual(t.assumed, [loose]);
  assert.equal(t.parts[1].label, "Toeristenbelasting (aanname: per persoon per nacht)");
  // Met eenheid per persoon per nacht: geen aanname
  const sure = nightTotal({ priceEur: 20, priceExtras: [tax(1.2)] });
  assert.equal(sure.assumed, undefined);
  assert.equal(sure.parts[1].label, "Toeristenbelasting");
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

test("R46: bedrag per persoon naast een basisprijs telt mee × 2; zonder 'per nacht' als aanname", () => {
  const pp = { label: "Per persoon", amount: 1, unit: "per persoon" };
  const t = nightTotal({ priceEur: 15.7, priceExtras: [tax(0.9), { label: "Stroom", amount: 2, unit: "per nacht" }, pp] });
  assert.equal(t.total, 15.7 + 2 + 1.8 + 2);
  assert.deepEqual(t.open, []);
  assert.deepEqual(t.assumed, [pp]);
  assert.ok(t.parts.some((x) => x.label === "Toeslag 2 × 1,00 p.p. (aanname: per persoon per nacht)" && x.amount === 2));
  const night = nightTotal({ priceEur: 15, touristTaxIncluded: true, priceExtras: [{ label: "Per persoon", amount: 3, unit: "per nacht" }] });
  assert.equal(night.total, 21);
  assert.equal(night.assumed, undefined);
});

test("bedrag per persoon per keer of naast een gratis plek: onduidelijk, geen totaal", () => {
  const once = nightTotal({ priceEur: 15, touristTaxIncluded: true, priceExtras: [{ label: "Per persoon", amount: 3, unit: "per keer" }] });
  assert.equal(once.total, undefined);
  assert.deepEqual(once.open, ["of de prijs per persoon erbij komt"]);
  assert.deepEqual(nightTotal({ priceEur: 0, priceExtras: [{ label: "Per persoon", amount: 3, unit: "per persoon per nacht" }] }).open, ["of de prijs per persoon erbij komt"]);
});

test("nightTotal en tripCosts rekenen hetzelfde voor 1 nacht en 2 personen (zonder stroom)", () => {
  const places = [
    { priceEur: 20, priceExtras: [tax(1.5)] },
    { priceEur: 20, priceExtras: [{ label: "Toeristenbelasting", amount: 1.2 }] },
    { priceEur: 18, priceExtras: [{ label: "Per persoon", amount: 4 }, tax(1, "per persoon")] },
    { priceEur: 15, priceExtras: [{ label: "Per persoon", amount: 3, unit: "per nacht" }], touristTaxIncluded: true },
    { priceExtras: [{ label: "Per persoon", amount: 7.5, unit: "per persoon per nacht" }, tax(1)] },
    { priceEur: 0 },
  ];
  for (const place of places) {
    const t = nightTotal(place);
    const c = tripCosts([{ nights: 1, place }], 2, 99);
    assert.equal(c.taxEstimatedNights, 0, JSON.stringify(place));
    assert.equal(t.total, c.stay + c.tax, JSON.stringify(place));
    assert.deepEqual(t.assumed ?? [], stopSurcharges({ nights: 1, place }, 2).assumed ?? [], JSON.stringify(place));
  }
});
