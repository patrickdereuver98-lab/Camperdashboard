// Delen naar VrijStaan vanuit Google Maps of een andere app (UX-audit november)
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSharedLocation } from "../src/lib/shared-location";

test("punt uit een Google Maps-link", () => {
  assert.deepEqual(parseSharedLocation({ url: "https://www.google.com/maps/place/Texel/@53.0548,4.7977,11z" }), { kind: "point", lat: 53.0548, lng: 4.7977, label: undefined });
  assert.deepEqual(parseSharedLocation({ text: "Kijk hier https://maps.google.com/?q=52.37,4.89", title: "Amsterdam" }), { kind: "point", lat: 52.37, lng: 4.89, label: "Amsterdam" });
  assert.deepEqual(parseSharedLocation({ text: "52.0907, 5.1214" }), { kind: "point", lat: 52.0907, lng: 5.1214, label: undefined });
});

test("buiten Nederland of zonder punt: de naam als tekst", () => {
  assert.deepEqual(parseSharedLocation({ url: "https://maps.app.goo.gl/abc123", title: "Camperplaats De Duinen" }), { kind: "text", text: "Camperplaats De Duinen" });
  assert.deepEqual(parseSharedLocation({ text: "@40.4,-3.7 Madrid" }), { kind: "text", text: "@40.4,-3.7 Madrid" });
});

test("niets bruikbaars: null", () => {
  assert.equal(parseSharedLocation({ url: "https://maps.app.goo.gl/abc123" }), null);
  assert.equal(parseSharedLocation({}), null);
});
