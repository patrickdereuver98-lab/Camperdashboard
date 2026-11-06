import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assumedText, dataDateText, fromPriceNote, isOptionalExtra, surchargeNote } from "../src/app/(site)/mijn-reis/trip-notes.ts";

const now = new Date(2026, 10, 6, 15, 0);

test("dataDateText: vandaag, gisteren, eerder dit jaar, ander jaar", () => {
  assert.equal(dataDateText(new Date(2026, 10, 6, 14, 5).toISOString(), now), "vandaag om 14:05");
  assert.equal(dataDateText(new Date(2026, 10, 5, 9, 30).toISOString(), now), "gisteren om 09:30");
  assert.equal(dataDateText(new Date(2026, 10, 2, 8, 0).toISOString(), now), "2 november om 08:00");
  assert.equal(dataDateText(new Date(2025, 11, 28, 20, 15).toISOString(), now), "28 december 2025 om 20:15");
});

test("dataDateText: onbekend blijft leeg", () => {
  assert.equal(dataDateText(null, now), undefined);
  assert.equal(dataDateText(undefined, now), undefined);
  assert.equal(dataDateText("geen datum", now), undefined);
});

test("isOptionalExtra: hond en stroom zijn een keuze, bedrag zonder eenheid of per persoon niet", () => {
  assert.equal(isOptionalExtra({ label: "Hond", amount: 2, unit: "per nacht" }), true);
  assert.equal(isOptionalExtra({ label: "Stroom", amount: 0.5, unit: "per kWh" }), true);
  assert.equal(isOptionalExtra({ label: "Hond", amount: 2 }), false);
  assert.equal(isOptionalExtra({ label: "Per persoon", amount: 5, unit: "per persoon" }), false);
  assert.equal(isOptionalExtra({ label: "Toeristenbelasting", amount: 1.5 }), false);
  // Een veld van de kostenberekening gaat voor
  assert.equal(isOptionalExtra({ label: "Per persoon", amount: 5, unit: "per persoon", optional: true } as never), true);
  assert.equal(isOptionalExtra({ label: "Hond", amount: 2, unit: "per nacht", optional: false } as never), false);
});

test("surchargeNote: 'hangt af van je situatie' alleen bij optionele kosten", () => {
  assert.equal(surchargeNote([{ label: "Hond", amount: 2, unit: "per nacht" }]), "Of je deze betaalt hangt af van je situatie.");
  assert.equal(surchargeNote([{ label: "Per persoon", amount: 5 }]), "De plek zegt niet waar het bedrag voor geldt.");
  const mixed = surchargeNote([{ label: "Hond", amount: 2, unit: "per nacht" }, { label: "Kind", amount: 3 }]);
  assert.match(mixed, /hangt af van je situatie/);
  assert.match(mixed, /niet waar het bedrag voor geldt/);
});

test("assumedText: zegt hoe we rekenden en wat de plek zelf noemde", () => {
  const sp = (x: string) => x.replace(/\s/g, " ");
  assert.equal(sp(assumedText({ label: "Toeristenbelasting", amount: 1.2 })), "toeristenbelasting € 1,20, gerekend per persoon per nacht (de plek noemt geen eenheid)");
  assert.equal(
    sp(assumedText({ label: "Per persoon", amount: 4, unit: "per persoon" })),
    'toeslag per persoon € 4, gerekend per persoon per nacht (de plek zegt alleen "per persoon")',
  );
});

test("fromPriceNote: alleen bij vanaf-prijzen, enkel- en meervoud", () => {
  assert.equal(fromPriceNote(0), undefined);
  assert.equal(fromPriceNote(undefined), undefined);
  assert.match(fromPriceNote(1)!, /^1 plek noemt alleen een vanaf-prijs/);
  assert.match(fromPriceNote(3)!, /^3 plekken noemen alleen een vanaf-prijs/);
});
