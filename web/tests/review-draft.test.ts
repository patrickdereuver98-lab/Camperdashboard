// Reviews alleen met account of code per mail: het concept blijft bewaard tijdens het inloggen, en de database
// accepteert alleen een ingelogde schrijver met een bevestigd e-mailadres.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DRAFT_TTL_MS, draftKey, hasContent, parseDraft } from "../src/lib/review-draft.ts";

const now = Date.UTC(2026, 9, 22, 12);
const full = {
  scores: { rating: 8, quiet: 9 },
  departure: "vast",
  checkout: "11:00",
  title: "Rustig aan het water",
  body: "Mooie plek, 's nachts helemaal stil. Water en stroom bij de slagboom.",
  month: "2026-09",
  vehicle: "buscamper",
  name: "Ans",
  savedAt: now - 1000,
};

test("concept per plek, met een vaste sleutel", () => {
  assert.equal(draftKey("abc"), "vrijstaan-review-concept:abc");
});

test("een geldig concept komt ongewijzigd terug", () => {
  assert.deepEqual(parseDraft(JSON.stringify(full), now), full);
});

test("kapot, leeg of te oud concept wordt genegeerd", () => {
  assert.equal(parseDraft(null, now), null);
  assert.equal(parseDraft("", now), null);
  assert.equal(parseDraft("{kapot", now), null);
  assert.equal(parseDraft(JSON.stringify({ ...full, savedAt: "gisteren" }), now), null);
  assert.equal(parseDraft(JSON.stringify({ ...full, savedAt: now - DRAFT_TTL_MS - 1 }), now), null);
});

test("ongeldige waarden vallen weg, de rest blijft", () => {
  const d = parseDraft(
    JSON.stringify({
      ...full,
      scores: { rating: 11, quiet: 0, value: 7.5, location: 6, extra: 5 },
      departure: "morgen",
      checkout: "elf uur",
      month: "september",
      vehicle: "fiets",
      title: "x".repeat(200),
      name: 42,
    }),
    now,
  );
  assert.ok(d);
  assert.deepEqual(d.scores, { location: 6 });
  assert.equal(d.departure, "");
  assert.equal(d.checkout, "");
  assert.equal(d.month, "");
  assert.equal(d.vehicle, "");
  assert.equal(d.title.length, 120);
  assert.equal(d.name, "");
  assert.equal(d.body, full.body);
});

test("alleen een naam of maand is geen concept; een cijfer, vertrektijd of tekst wel", () => {
  const empty = { scores: {}, departure: "" as const, checkout: "", title: "", body: "  ", month: "2026-09", vehicle: "camper", name: "Ans" };
  assert.equal(hasContent(empty), false);
  assert.equal(hasContent({ ...empty, scores: { rating: 7 } }), true);
  assert.equal(hasContent({ ...empty, departure: "vrij" }), true);
  assert.equal(hasContent({ ...empty, body: "Fijne plek" }), true);
});

test("migratie: submit_review alleen voor ingelogd met bevestigd e-mailadres, niet voor anon", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261022100000_reviews_met_account.sql", import.meta.url), "utf8");
  const fn = sql.slice(sql.indexOf("create or replace function public.submit_review"), sql.indexOf("revoke all on function public.submit_review"));
  assert.match(fn, /security definer set search_path to ''/);
  assert.match(fn, /auth\.uid\(\)/);
  assert.match(fn, /if uid is null then/);
  assert.match(fn, /email_confirmed_at is not null/);
  assert.doesNotMatch(fn, /p_author_email/, "het e-mailadres komt uit het account, niet uit het formulier");
  assert.match(sql, /drop function if exists public\.submit_review\(uuid, text, text,/, "de oude versie zonder controle verdwijnt");
  assert.match(sql, /revoke all on function public\.submit_review\([^)]*\) from public, anon;/);
  assert.match(sql, /grant execute on function public\.submit_review\([^)]*\) to authenticated;/);
  assert.match(sql, /references auth\.users \(id\) on delete set null/);
});
