import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ago, crowdSummary } from "../src/lib/crowd.ts";

const now = new Date("2026-10-12T12:00:00Z");

test("ago", () => {
  assert.equal(ago("2026-10-12T11:59:30Z", now), "net");
  assert.equal(ago("2026-10-12T11:48:00Z", now), "12 minuten geleden");
  assert.equal(ago("2026-10-12T11:00:00Z", now), "1 uur geleden");
  assert.equal(ago("2026-10-12T09:40:00Z", now), "2 uur geleden");
});

test("crowdSummary zonder meldingen verzint niets", () => {
  assert.equal(crowdSummary(null, now).title, "Nog niemand gemeld");
  assert.equal(crowdSummary({ level: null, reports: 0, last_at: null, counts: {} }, now).level, null);
});

test("crowdSummary noemt aantal en tijdstip", () => {
  const s = crowdSummary({ level: "vol", reports: 3, last_at: "2026-10-12T11:40:00Z", counts: { vol: 2, druk: 1 } }, now);
  assert.deepEqual(s, { title: "Vol", detail: "Volgens 3 camperaars, laatste melding 20 minuten geleden", level: "vol" });
  assert.match(crowdSummary({ level: "rustig", reports: 1, last_at: "2026-10-12T11:59:00Z", counts: {} }, now).detail, /^Volgens 1 camperaar, laatste melding net$/);
});
