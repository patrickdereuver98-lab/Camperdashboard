import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHistoryValue, revertableIds, type HistoryRow } from "../src/lib/place-history";

test("formatHistoryValue: leeg is Onbekend, nooit een gok", () => {
  assert.equal(formatHistoryValue("checkout_until", null), "Onbekend");
  assert.equal(formatHistoryValue("checkout_until", ""), "Onbekend");
  assert.equal(formatHistoryValue("checkout_until", undefined), "Onbekend");
});

test("formatHistoryValue: velden leesbaar", () => {
  assert.equal(formatHistoryValue("power", true), "Ja");
  assert.equal(formatHistoryValue("dogs", false), "Nee");
  assert.equal(formatHistoryValue("price_eur", 12.5), "€ 12,50");
  assert.equal(formatHistoryValue("max_length_m", 8.5), "8,5 m");
  assert.equal(formatHistoryValue("departure", "per24"), "Per 24 uur");
  assert.equal(formatHistoryValue("status", "published"), "Online");
  assert.equal(formatHistoryValue("checkout_until", "11:00"), "11:00");
  assert.equal(formatHistoryValue("price_extras", { stroom: 3 }), '{"stroom":3}');
});

test("formatHistoryValue: lange tekst ingekort", () => {
  const s = formatHistoryValue("description", "a".repeat(300), 10);
  assert.equal(s.length, 10);
  assert.ok(s.endsWith("…"));
});

test("revertableIds: alleen de nieuwste wijziging per veld", () => {
  const row = (id: number, field: string): HistoryRow => ({
    id, field, ts: "", old_value: null, new_value: null, source: "website", actor_email: null, revert_of: null,
  });
  const ids = revertableIds([row(1, "price_eur"), row(3, "price_eur"), row(2, "departure")]);
  assert.deepEqual([...ids].sort(), [2, 3]);
});
