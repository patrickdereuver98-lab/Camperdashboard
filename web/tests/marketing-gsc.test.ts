// Search Console ophalen: periodes en omzetten (scripts/marketing/search-console.ts)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chunks, dailyRows, fetchRange, HISTORY_DAYS, pageRow, totalRows } from "../src/lib/marketing/gsc.ts";

const NOW = Date.UTC(2026, 10, 2, 9);

test("fetchRange: lege tabel haalt 16 maanden, daarna vanaf de laatste dag min 4", () => {
  const first = fetchRange(null, NOW)!;
  assert.equal(first.end, "2026-10-30");
  assert.equal((Date.parse(first.end) - Date.parse(first.start)) / 864e5, HISTORY_DAYS - 3);
  assert.deepEqual(fetchRange("2026-10-29", NOW), { start: "2026-10-25", end: "2026-10-30" });
  assert.equal(fetchRange("2027-01-01", NOW), null);
});

test("chunks: blokken van 7 dagen tot en met het einde", () => {
  assert.deepEqual(chunks({ start: "2026-10-01", end: "2026-10-16" }), [
    { start: "2026-10-01", end: "2026-10-07" },
    { start: "2026-10-08", end: "2026-10-14" },
    { start: "2026-10-15", end: "2026-10-16" },
  ]);
});

test("dailyRows en totalRows: afronden, onbekend apparaat weg", () => {
  assert.deepEqual(dailyRows([{ keys: ["2026-10-30", "q", "https://x"], clicks: 1, impressions: 10.4, position: 3.456 }, { keys: ["2026-10-30", "", "p"], clicks: 1, impressions: 1 }]), [
    { date: "2026-10-30", query: "q", page: "https://x", clicks: 1, impressions: 10, position: 3.46 },
  ]);
  assert.deepEqual(totalRows([{ keys: ["d"], clicks: 1, impressions: 2 }, { keys: ["d", "TV"], clicks: 1, impressions: 2 }, { keys: ["d", "MOBILE"], clicks: 1, impressions: 2, position: 1 }]).map((r) => r.device), ["alle", "mobile"]);
});

test("pageRow: PASS is geïndexeerd, onbekend blijft leeg", () => {
  assert.equal(pageRow("u", { inspectionResult: { indexStatusResult: { verdict: "PASS" } } }).indexed, true);
  assert.equal(pageRow("u", { inspectionResult: { indexStatusResult: { verdict: "NEUTRAL" } } }).indexed, false);
  assert.equal(pageRow("u", {}).indexed, null);
});

test("Instagram: statRow leest total_value en values, zonder permalink niets", async () => {
  const { statRow } = await import("../src/lib/marketing/instagram.ts");
  const row = statRow({ id: "1", permalink: "https://www.instagram.com/p/x/", like_count: 4, comments_count: 1 }, [
    { name: "reach", values: [{ value: 120 }] },
    { name: "views", total_value: { value: 300 } },
    { name: "saved", values: [{ value: 2 }] },
  ], "2026-11-02")!;
  assert.equal(row.reach, 120);
  assert.equal(row.views, 300);
  assert.equal(row.saves, 2);
  assert.equal(row.shares, null);
  assert.equal(statRow({ id: "2" }, [], "2026-11-02"), null);
});
