import { strict as assert } from "node:assert";
import { test } from "node:test";
import { closedText, dayValue, parseDay, tripDates } from "../src/lib/trip-dates.ts";

test("parseDay: alleen geldige datums", () => {
  assert.equal(dayValue(parseDay("2026-11-06")!), "2026-11-06");
  assert.equal(parseDay("2026-02-30"), undefined);
  assert.equal(parseDay("6-11-2026"), undefined);
  assert.equal(parseDay(null), undefined);
});

test("aankomst en vertrek lopen door over de stops", () => {
  const d = tripDates(parseDay("2026-11-06")!, [
    { nights: 2, place: { openAllYear: true } },
    { nights: 1, place: { openAllYear: true } },
  ]);
  assert.deepEqual(d.map((x) => [dayValue(x.arrive), dayValue(x.leave)]), [
    ["2026-11-06", "2026-11-08"],
    ["2026-11-08", "2026-11-09"],
  ]);
  assert.deepEqual(d[0].closedNights, []);
});

test("gesloten nachten volgens het seizoen; onbekend seizoen geeft geen waarschuwing", () => {
  const [a, b] = tripDates(parseDay("2026-10-30")!, [
    { nights: 3, place: { season: "1 april – 31 oktober" } },
    { nights: 2, place: {} },
  ]);
  assert.deepEqual(a.closedNights.map(dayValue), ["2026-11-01"]);
  assert.deepEqual(b.closedNights, []);
});

test("over de jaargrens en een winterseizoen", () => {
  const [a] = tripDates(parseDay("2026-12-30")!, [{ nights: 3, place: { season: "1 november – 31 maart" } }]);
  assert.deepEqual(a.closedNights, []);
  assert.equal(dayValue(a.leave), "2027-01-02");
});

test("tekst voor gesloten nachten", () => {
  const n = (s: string) => parseDay(s)!;
  assert.equal(closedText([n("2026-11-07")]), "7 november");
  assert.equal(closedText([n("2026-11-07"), n("2026-11-08")]), "7 en 8 november");
  assert.equal(closedText([n("2026-10-31"), n("2026-11-01")]), "31 oktober t/m 1 november");
});
