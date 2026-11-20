// plan.md B2.2 en B4: de lezer herkent boekingsmodule en betaalwijze als aanwijzing, nooit als vertrekregel.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingSystems, extract, paymentHints } from "../supabase/functions/pipeline/extract";

const base = new URL("https://camping.example.nl/");

test("Tommy-widget via script wordt herkend", () => {
  const html = `<script src="https://api.tommybookingsupport.com/widgets/zoeken/js/init.js"></script>`;
  assert.deepEqual(bookingSystems(html), ["tommy"]);
});

test("Booking Experts in iframe en Camping.care in script, gesorteerd", () => {
  const html = `<iframe src="https://camping-x.bookingexperts.nl/widget"></iframe><script src="https://widget.camping.care/x.js"></script>`;
  assert.deepEqual(bookingSystems(html), ["booking_experts", "camping_care"]);
});

test("de naam alleen in lopende tekst telt niet als boekingssysteem", () => {
  assert.deepEqual(bookingSystems("<p>Wij werken met Booking Experts en Tommy.</p>"), []);
});

test("betaalzuil en Aanuit.net zijn een aanwijzing", () => {
  assert.deepEqual(paymentHints(`<a href="https://aanuit.net/">app</a>`, "Betalen bij de betaalzuil."), ["aanuit", "betaalautomaat"]);
  assert.deepEqual(paymentHints("", "Stroom via de stroomzuil, 50 cent per kWh."), []);
});

test("extract zet aanwijzingen met underscore, buiten fields, en leidt geen vertrekregel af", () => {
  const r = extract([`<script src="https://api.tommybookingsupport.com/w.js"></script><p>Betalen via de betaalautomaat.</p>`], base) as Record<string, unknown> & { fields: string[] };
  assert.deepEqual(r._booking, ["tommy"]);
  assert.deepEqual(r._payment, ["betaalautomaat"]);
  assert.equal(r.departure, undefined);
  assert.ok(!r.fields.some((f) => f.startsWith("_")));
});

test("review: alleen op hostnaam, en een link naar de leverancier zelf telt niet", () => {
  assert.deepEqual(bookingSystems(`<a href="https://x.nl/recreatex-info">info</a><a href="https://mynewbook.cloud.example.org/">x</a>`), []);
  assert.deepEqual(bookingSystems(`<a href="https://www.bookingexperts.nl/">Powered by Booking Experts</a>`), []);
  assert.deepEqual(bookingSystems(`<a href="https://camping-zon.bookingexperts.nl/nl/zoeken">Boek nu</a>`), ["booking_experts"]);
});

test("review: alle attributen van een tag tellen, niet alleen het laatste", () => {
  assert.deepEqual(bookingSystems(`<iframe src="https://api.tommybookingsupport.com/w" data-src="/leeg"></iframe>`), ["tommy"]);
});

test("review: 'geen betaalzuil' en 'buiten werking' zijn geen aanwijzing; i-marina alleen als los woord", () => {
  assert.deepEqual(paymentHints("", "Er is geen betaalzuil aanwezig."), []);
  assert.deepEqual(paymentHints("", "De betaalautomaat is tijdelijk buiten werking."), []);
  assert.deepEqual(paymentHints(`<a href="https://delphi-marina.nl">x</a>`, ""), []);
  assert.deepEqual(paymentHints("", "Geen betaalzuil bij de ingang; betalen bij de betaalautomaat op de steiger."), ["betaalautomaat"]);
});
