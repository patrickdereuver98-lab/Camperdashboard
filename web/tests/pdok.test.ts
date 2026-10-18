// PDOK-adressen: alleen een volledig adres vlak bij de plek, anders niets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addressFrom, reverseUrl } from "../supabase/functions/pipeline/pdok";

test("adres binnen 75 m wordt straat + postcode", () => {
  assert.deepEqual(addressFrom({ straatnaam: "Kubbeweg", huisnummer: 17, huisletter: "A", postcode: "8256PJ", afstand: 38.7 }), {
    street: "Kubbeweg 17A",
    postcode: "8256 PJ",
    afstand: 39,
  });
  assert.equal(addressFrom({ straatnaam: "Dorpsstraat", huisnummer: 3, huisnummertoevoeging: "2", postcode: "1234AB", afstand: 5 })?.street, "Dorpsstraat 3-2");
});

test("te ver weg, onvolledig of geen resultaat: niets", () => {
  assert.equal(addressFrom({ straatnaam: "Kubbeweg", huisnummer: 17, postcode: "8256PJ", afstand: 138 }), null);
  assert.equal(addressFrom({ straatnaam: "Kubbeweg", postcode: "8256PJ", afstand: 10 }), null);
  assert.equal(addressFrom({ straatnaam: "Kubbeweg", huisnummer: 1, postcode: "8256", afstand: 10 }), null);
  assert.equal(addressFrom(undefined), null);
});

test("verzoek vraagt alleen adressen binnen de afstand", () => {
  const u = new URL(reverseUrl(52.45, 5.65));
  assert.equal(u.searchParams.get("type"), "adres");
  assert.equal(u.searchParams.get("distance"), "75");
  assert.equal(u.searchParams.get("lon"), "5.65");
});
