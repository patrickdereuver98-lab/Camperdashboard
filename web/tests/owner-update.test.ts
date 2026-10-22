import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerChanges, ownerValues } from "@/lib/owner-update";
import type { Place } from "@/lib/types";

const base: Place = {
  id: "1",
  slug: "a",
  name: "De Wei",
  lat: 52,
  lng: 5,
  town: "Ergens",
  province: "Utrecht",
  photos: [],
  ratingCount: 0,
  completeness: 0.5,
};

test("onbekend blijft leeg", () => {
  const v = ownerValues(base);
  assert.equal(v.vertrek, "");
  assert.equal(v.prijs_per_nacht, "");
  assert.equal(v.toeristenbelasting, "");
  assert.equal(v.reserveren, "");
});

test("bekende waarden staan al ingevuld", () => {
  const v = ownerValues({
    ...base,
    departure: "vast",
    checkoutUntil: "11:00",
    priceEur: 12.5,
    touristTaxIncluded: false,
    reservation: false,
    openAllYear: true,
    maxLengthM: 8,
    priceExtras: [{ label: "Stroom", amount: 3.5, unit: "per nacht" }],
  });
  assert.equal(v.vertrek, "vast");
  assert.equal(v.vertrek_uiterlijk, "11:00");
  assert.equal(v.prijs_per_nacht, "12,50");
  assert.equal(v.toeristenbelasting, "erbij");
  assert.equal(v.reserveren, "niet_nodig");
  assert.equal(v.open, "Hele jaar");
  assert.equal(v.langste_camper_m, "8");
  assert.match(v.extra_kosten, /^Stroom: €\s3,50 per nacht$/);
});

test("reserveren 'ja' laat de keuze open: verplicht of mogelijk weten we niet", () => {
  assert.equal(ownerValues({ ...base, reservation: true }).reserveren, "");
});

test("vertrektijd hoort alleen bij een vaste tijd", () => {
  assert.equal(ownerValues({ ...base, departure: "vrij", checkoutUntil: "11:00" }).vertrek_uiterlijk, "");
});

test("niets veranderd geeft geen wijzigingen", () => {
  const v = ownerValues({ ...base, priceEur: 15, phone: "0301234567" });
  assert.deepEqual(ownerChanges(v, { ...v }), {});
});

test("alleen veranderde velden, met oud en nieuw", () => {
  const v = ownerValues({ ...base, priceEur: 15, departure: "vast", checkoutUntil: "11:00" });
  const c = ownerChanges(v, { ...v, prijs_per_nacht: "17,50", vertrek: "vrij", vertrek_uiterlijk: "" });
  assert.deepEqual(c, {
    vertrek: { was: "vast", nieuw: "vrij" },
    vertrek_uiterlijk: { was: "11:00", nieuw: null },
    prijs_per_nacht: { was: "15", nieuw: "17,50" },
  });
});

test("zelfde getal anders geschreven is geen wijziging", () => {
  const v = ownerValues({ ...base, priceEur: 15 });
  assert.deepEqual(ownerChanges(v, { ...v, prijs_per_nacht: "15,00" }), {});
  assert.deepEqual(ownerChanges(v, { ...v, prijs_per_nacht: "15.0" }), {});
});

test("witruimte in extra kosten telt niet", () => {
  const v = ownerValues({ ...base, priceExtras: [{ label: "Stroom", amount: 3, unit: "per nacht" }] });
  assert.deepEqual(ownerChanges(v, { ...v, extra_kosten: `  ${v.extra_kosten}  \r\n` }), {});
});

test("aanvullen van een leeg veld", () => {
  const v = ownerValues(base);
  assert.deepEqual(ownerChanges(v, { ...v, aankomst_vanaf: "13:00" }), { aankomst_vanaf: { was: null, nieuw: "13:00" } });
});
