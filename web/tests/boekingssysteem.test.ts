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
