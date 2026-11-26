import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nextStopIndex } from "../src/lib/trip-next";

const d = (s: string) => new Date(`${s}T12:00:00`);
const dated = [
  { arrive: d("2026-11-25"), leave: d("2026-11-26") },
  { arrive: d("2026-11-26"), leave: d("2026-11-28") },
  { arrive: d("2026-11-28"), leave: d("2026-11-29") },
];

test("zonder datum: de eerste stop", () => {
  assert.deepEqual(nextStopIndex(3, null, undefined), { index: 0, label: "Eerste stop" });
  assert.equal(nextStopIndex(0, null, undefined), null);
});

test("met datum, reis bezig: vannacht, of de stop na waar je vandaag vertrekt", () => {
  assert.deepEqual(nextStopIndex(3, dated, { tonight: 1 }), { index: 1, label: "Vannacht" });
  assert.deepEqual(nextStopIndex(3, dated, { leaving: 0 }), { index: 1, label: "Volgende stop" });
  assert.equal(nextStopIndex(3, dated, { leaving: 2 }), null);
});

test("met datum: nog niet begonnen is de eerste stop, voorbij is geen", () => {
  assert.deepEqual(nextStopIndex(3, dated, undefined, d("2026-11-20")), { index: 0, label: "Volgende stop" });
  assert.equal(nextStopIndex(3, dated, undefined, d("2026-12-05")), null);
});
