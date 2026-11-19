// Mijn reis als tekst, als agenda en de reisdag (UX-audit november)
import { test } from "node:test";
import assert from "node:assert/strict";
import { tripIcs, tripText, tripToday } from "../src/lib/trip-share";

const place = (slug: string, extra = {}) => ({ slug, name: `Plek ${slug}`, town: "Texel", ...extra });
const stops = [
  { nights: 2, place: place("a", { checkinFrom: "14:00", checkinUntil: "22:00", departure: "vrij" as const }) },
  { nights: 1, place: place("b") },
];
const dated = [
  { arrive: new Date(2026, 10, 6), leave: new Date(2026, 10, 8) },
  { arrive: new Date(2026, 10, 8), leave: new Date(2026, 10, 9) },
];

test("tekst: genummerd, met nachten en datums", () => {
  const t = tripText(stops, dated);
  assert.match(t, /^Mijn camperreis\n1\. Plek a, Texel \(2 nachten, .*6 nov.* tot .*8 nov.*\)\n2\. Plek b, Texel \(1 nacht, /);
  assert.equal(tripText(stops, null).split("\n")[2], "2. Plek b, Texel (1 nacht)");
});

test("agenda: hele dagen per stop, alleen bekende feiten", () => {
  const ics = tripIcs(stops, dated, "https://vrijstaan.nl", new Date(Date.UTC(2026, 10, 1, 9, 30)));
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261106\r\nDTEND;VALUE=DATE:20261108/);
  assert.match(ics, /SUMMARY:Camper: Plek a/);
  assert.match(ics, /Aankomen tussen 14:00 en 22:00\\nGeen vaste vertrektijd/);
  // Plek b: geen aankomsttijd en geen vertrekregel bekend, dan alleen de link
  assert.match(ics, /DESCRIPTION:https:\/\/vrijstaan\.nl\/plek\/b\r\n/);
  assert.equal(ics.split("\r\n").every((l) => l.length <= 75), true);
});

test("reisdag: vannacht, vertrekdag en buiten de reis", () => {
  assert.deepEqual(tripToday(dated, new Date(2026, 10, 6, 10)), { tonight: 0 });
  assert.deepEqual(tripToday(dated, new Date(2026, 10, 8, 10)), { leaving: 0, tonight: 1 });
  assert.deepEqual(tripToday(dated, new Date(2026, 10, 9, 10)), { leaving: 1 });
  assert.equal(tripToday(dated, new Date(2026, 10, 12)), undefined);
});

test("tekst: eigen punt alleen met naam, alleen gedeelde notities", () => {
  const t = tripText(
    [
      { nights: 1, place: place("a"), notes: [{ text: "Pincode 1234" }, { text: "Bakker\nom de hoek", shared: true }] },
      { nights: 0, own: true, place: { slug: "eigen-x", name: "Oma", town: "" } },
    ],
    null,
  );
  assert.equal(t, "Mijn camperreis\n1. Plek a, Texel (1 nacht)\n   Notitie: Bakker om de hoek\n2. Oma (eigen punt, tussenstop)");
  assert.equal(t.includes("Pincode"), false);
});
