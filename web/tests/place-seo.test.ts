// SEO per plek en deelafbeelding: alleen bekende feiten, "inclusief toeslagen" alleen als het klopt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allInPrice, allSurchargesKnown, departureFact, labeledName, seoDescription, seoTitle, type MarketingPlace } from "../src/lib/place-seo.ts";

const base: MarketingPlace = { slug: "de-proef-ede", name: "De Proef", town: "Ede", province: "Gelderland", kind: "camperplaats" };
const tax = { label: "Toeristenbelasting", amount: 1.35, unit: "per persoon per nacht" };

test("all-in prijs alleen als het totaal vaststaat", () => {
  const full = allInPrice({ ...base, priceEur: 20, priceExtras: [tax], power: false });
  assert.equal(full?.allIn, true);
  assert.match(full!.text, /22,70 per nacht voor 2 personen, inclusief toeslagen/);
  const open = allInPrice({ ...base, priceEur: 20 });
  assert.equal(open?.allIn, false);
  assert.match(open!.text, /toeslagen niet volledig bekend/);
  assert.equal(allInPrice(base), undefined);
  assert.equal(allInPrice({ ...base, priceEur: 0 })?.amount, "Gratis");
});

test("vertrektijd: tijd, geen vaste tijd of weglaten", () => {
  assert.equal(departureFact({ ...base, departure: "vast", checkoutUntil: "12:00" }), "uiterlijk 12:00");
  assert.equal(departureFact({ ...base, departure: "vrij" }), "geen vaste tijd");
  assert.equal(departureFact({ ...base, departure: "vast", checkoutUntil: "middag" }), undefined);
  assert.equal(departureFact({ ...base, departure: "vrij", departureCheck: "afgewezen" }), undefined);
  assert.equal(departureFact(base), undefined);
});

test("naam zonder dubbel soortwoord", () => {
  assert.equal(labeledName(base), "Camperplaats De Proef");
  assert.equal(labeledName({ ...base, name: "Camperplaats Ede" }), "Camperplaats Ede");
});

test("SEO-titel en omschrijving volgen het vaste patroon en laten onbekend weg", () => {
  const p = { ...base, priceEur: 20, priceExtras: [tax], power: false, departure: "vast" as const, checkoutUntil: "12:00" };
  assert.match(seoTitle(p), /^Camperplaats De Proef in Ede: €\s?22,70 incl\. toeslagen$/);
  assert.match(seoDescription(p), /^Camperplaats De Proef in Ede \(Gelderland\): €\s?22,70 per nacht voor 2 personen, inclusief toeslagen\. Vertrektijd: uiterlijk 12:00\./);
  assert.equal(seoTitle(base), "Camperplaats De Proef in Ede");
  assert.doesNotMatch(seoDescription(base), /Vertrektijd|€/);
});

test("vanaf-prijs: nooit 'inclusief toeslagen', ook als elk onderdeel bekend is (Burgh)", () => {
  const burgh: MarketingPlace = {
    ...base,
    kind: "camping",
    priceEur: 5,
    priceFrom: true,
    priceExtras: [tax, { label: "Stroom", amount: 2.5, unit: "per nacht" }],
  };
  const price = allInPrice(burgh);
  assert.equal(price?.allIn, false);
  assert.match(price!.amount, /^vanaf €\s?5$/);
  assert.match(price!.text, /plus toeslagen$/);
  assert.doesNotMatch(seoTitle(burgh), /incl/);
  assert.doesNotMatch(seoDescription(burgh), /inclusief/);
});

test("R22: stroomtarief onbekend bij een plek met stroom: alleen 'incl. toeristenbelasting'", () => {
  for (const power of [true, undefined]) {
    const p: MarketingPlace = { ...base, priceEur: 20, priceExtras: [tax], power };
    const price = allInPrice(p);
    assert.equal(price?.allIn, false);
    assert.equal(price?.withTax, true);
    assert.match(price!.text, /22,70 per nacht voor 2 personen, incl\. toeristenbelasting$/);
    assert.doesNotMatch(seoDescription(p), /inclusief toeslagen/);
    assert.doesNotMatch(seoTitle(p), /incl\. toeslagen/);
  }
});

test("R22: stroomprijs per nacht bekend: alles inbegrepen; per kWh niet", () => {
  const p: MarketingPlace = { ...base, priceEur: 20, priceExtras: [tax, { label: "Stroom", amount: 3, unit: "per nacht" }], power: true };
  assert.equal(allSurchargesKnown(p), true);
  assert.equal(allInPrice(p)?.allIn, true);
  assert.match(allInPrice(p)!.text, /25,70 per nacht voor 2 personen, inclusief toeslagen/);
  const kwh: MarketingPlace = { ...base, priceEur: 20, priceExtras: [tax, { label: "Stroom", amount: 0.5, unit: "per kWh" }], power: true };
  assert.equal(allSurchargesKnown(kwh), false);
  assert.equal(allInPrice(kwh)?.allIn, false);
});
