// Vanaf-prijs alleen uit het vaste patroon (R25/TS-02) en verdacht lage nachtprijzen (R47).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isFromPriceNote, priceRange, suspiciousPrice } from "../src/lib/price-check.ts";

const NOTE = "vanaf € 5,00 per nacht; hoogste genoemde tarief € 29,25";

test("vanaf-prijs alleen bij 'vanaf €'", () => {
  assert.equal(isFromPriceNote(NOTE), true);
  assert.equal(isFromPriceNote("Vanaf €12 per nacht"), true);
  assert.equal(isFromPriceNote("Vanaf 2 nachten € 18 per nacht"), false);
  assert.equal(isFromPriceNote("vanaf april geopend"), false);
  assert.equal(isFromPriceNote(undefined), false);
});

test("prijsreeks uit de notitie", () => {
  assert.deepEqual(priceRange(NOTE), { low: 5, high: 29.25 });
  assert.equal(priceRange("vanaf € 18 per nacht"), undefined);
  assert.equal(priceRange("Prijs € 12"), undefined);
});

test("camping of vakantiepark onder € 8: verdacht", () => {
  assert.match(suspiciousPrice({ kind: "camping", priceEur: 5 }) ?? "", /onder € 8/);
  assert.match(suspiciousPrice({ kind: "camperplaats", name: "Molecaten Park Waterdunen vakantiepark", priceEur: 6.5 }) ?? "", /onder € 8/);
  assert.equal(suspiciousPrice({ kind: "camping", priceEur: 8 }), undefined);
  // Een camperplaats van € 5 is gewoon
  assert.equal(suspiciousPrice({ kind: "camperplaats", name: "Bij de haven", priceEur: 5 }), undefined);
  // Gratis en onbekend tellen niet
  assert.equal(suspiciousPrice({ kind: "camping", priceEur: 0 }), undefined);
  assert.equal(suspiciousPrice({ kind: "camping" }), undefined);
});

test("vanaf-prijs met hoogste tarief meer dan 4 keer zo hoog: verdacht", () => {
  assert.match(suspiciousPrice({ kind: "camperplaats", priceEur: 5, priceNote: NOTE }) ?? "", /4 keer/);
  assert.equal(suspiciousPrice({ kind: "camperplaats", priceEur: 10, priceNote: "vanaf € 10,00 per nacht; hoogste genoemde tarief € 40,00" }), undefined);
});
