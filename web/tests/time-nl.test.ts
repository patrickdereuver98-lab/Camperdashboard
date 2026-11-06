// Tijd in Nederland, 23:59 als grens, 29 februari en ago() zonder NaN (TS-13).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { timeToMinutes } from "../src/lib/format.ts";
import { arrivalClosed, isOpenOn, nowInNL } from "../src/lib/search.ts";
import { ago, CROWD_ERROR, crowdSummary } from "../src/lib/crowd.ts";

test("timeToMinutes: 00:00 tot en met 23:59", () => {
  assert.equal(timeToMinutes("0:00"), 0);
  assert.equal(timeToMinutes("23:59"), 23 * 60 + 59);
  assert.equal(timeToMinutes("11.30"), 690);
  assert.equal(timeToMinutes("24:00"), undefined);
  assert.equal(timeToMinutes("24:59"), undefined);
  assert.equal(timeToMinutes("12:60"), undefined);
});

test("nowInNL: klok van Nederland, zomer- en wintertijd", () => {
  const summer = nowInNL(new Date("2026-07-01T22:30:00Z"));
  assert.deepEqual([summer.getFullYear(), summer.getMonth(), summer.getDate(), summer.getHours(), summer.getMinutes()], [2026, 6, 2, 0, 30]);
  const winter = nowInNL(new Date("2026-12-31T23:15:00Z"));
  assert.deepEqual([winter.getFullYear(), winter.getMonth(), winter.getDate(), winter.getHours()], [2027, 0, 1, 0]);
});

test("seizoen met 29 februari in een gewoon jaar: 28 februari, niet 1 maart", () => {
  const p = { season: "29 februari – 31 oktober" };
  assert.equal(isOpenOn(p, new Date(2027, 1, 28, 12)), true);
  const end = { season: "1 november – 29 februari" };
  assert.equal(isOpenOn(end, new Date(2027, 1, 28, 20)), true);
  assert.equal(isOpenOn(end, new Date(2027, 2, 1, 1)), false);
  assert.equal(isOpenOn(end, new Date(2028, 1, 29, 12)), true);
});

test("aankomst gesloten: ook met een punt als scheiding, onleesbaar telt niet als dicht", () => {
  assert.equal(arrivalClosed({ checkinUntil: "22.00" }, new Date(2026, 5, 1, 22, 30)), true);
  assert.equal(arrivalClosed({ checkinUntil: "laat" }, new Date(2026, 5, 1, 23, 30)), false);
});

test("ago: onleesbare datum geeft geen 'NaN uur geleden'", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  assert.equal(ago("geen datum", now), undefined);
  const s = crowdSummary({ level: "druk", reports: 2, last_at: "geen datum", counts: {} }, now);
  assert.equal(s.detail, "Volgens 2 camperaars");
  assert.doesNotMatch(s.detail, /NaN/);
  assert.equal(CROWD_ERROR.title, "Drukte nu niet te laden");
});
