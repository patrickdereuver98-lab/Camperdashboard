// Citaatcontrole (zoekagenten): alleen controleerbare antwoorden tellen (letterlijke zin, tijd of vrij-uitspraak in die zin).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "../supabase/functions/pipeline/quote.ts";

const page = "Welkom op onze camping aan het water. Praktische info: Aankomst vanaf 13.00 uur, bij vertrek graag de plek uiterlijk om 11.30 uur verlaten. Honden zijn welkom. Op de camperplaats is er geen vaste vertrektijd.";

test("vaste tijd telt alleen als de zin letterlijk op de pagina staat en de tijd erin staat", () => {
  const quote = "bij vertrek graag de plek uiterlijk om 11.30 uur verlaten";
  assert.deepEqual(verify({ departure: "vast", checkout: "11:30", quote }, page), {
    departure: "vast", checkout_until: "11:30", times_note: quote,
  });
  // Verzonnen citaat, verkeerde tijd, of tijd buiten bereik: niet overnemen
  assert.equal(verify({ departure: "vast", checkout: "11:30", quote: "vertrek voor 11.30 uur" }, page), null);
  assert.equal(verify({ departure: "vast", checkout: "12:00", quote }, page), null);
  assert.equal(verify({ departure: "vast", checkout: "03:00", quote: "Aankomst vanaf 13.00 uur" }, page), null);
});

test("vrij telt alleen met een echte vrij-uitspraak in de zin", () => {
  assert.equal(verify({ departure: "vrij", checkout: null, quote: "Op de camperplaats is er geen vaste vertrektijd" }, page)?.departure, "vrij");
  assert.equal(verify({ departure: "vrij", checkout: null, quote: "Honden zijn welkom" }, page), null);
  assert.equal(verify({ departure: "onbekend", checkout: null, quote: null }, page), null);
});
