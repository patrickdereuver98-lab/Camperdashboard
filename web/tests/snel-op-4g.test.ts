import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePlaceIndex, encodePlaceIndex, forBrowser } from "@/lib/place-index";
import { changesPublicData } from "@/lib/admin-refresh";
import type { PlaceSummary } from "@/lib/types";

// R33 en R36 (review november 2026, fase 2.3 "Snel op 4G")

const place = {
  id: "a",
  slug: "camperplaats-de-haven",
  name: "Camperplaats De Haven",
  kind: "camperplaats",
  lat: 52.1234567,
  lng: 4.7654321,
  town: "Katwijk",
  province: "Zuid-Holland",
  ratingCount: 0,
  completeness: 0.5,
  imageUrl: "https://example.org/foto.jpg",
  imageCredit: "example.org",
} as PlaceSummary;

test("suggestie-index: heen en terug, ligging op vijf decimalen", () => {
  const rows = encodePlaceIndex([place]);
  assert.deepEqual(rows, [["camperplaats-de-haven", "Camperplaats De Haven", "Katwijk", "Zuid-Holland", 52.12346, 4.76543]]);
  assert.deepEqual(decodePlaceIndex(JSON.parse(JSON.stringify(rows))), [
    { slug: "camperplaats-de-haven", name: "Camperplaats De Haven", town: "Katwijk", province: "Zuid-Holland", lat: 52.12346, lng: 4.76543 },
  ]);
});

test("suggestie-index: onleesbare rijen vallen weg, niets wordt aangevuld", () => {
  assert.deepEqual(decodePlaceIndex(null), []);
  assert.deepEqual(decodePlaceIndex({ p: [] }), []);
  assert.deepEqual(decodePlaceIndex([["a", "b", "c", "d", null, 5], ["a", "b"], "x", ["a", "b", "c", "d", 52, 5]]), [
    { slug: "a", name: "b", town: "c", province: "d", lat: 52, lng: 5 },
  ]);
});

test("lijst voor de browser: zonder fotocredit, de rest ongewijzigd", () => {
  const out = forBrowser(place);
  assert.equal(out.imageCredit, undefined);
  assert.equal(out.imageUrl, place.imageUrl);
  assert.equal("imageCredit" in out, false);
  assert.equal(place.imageCredit, "example.org", "het origineel (servercache) blijft heel");
  const bare = { ...place, imageCredit: undefined };
  assert.equal(forBrowser(bare), bare);
});

test("beheer ververst de site alleen na een wijziging", () => {
  const base = "https://x.supabase.co";
  assert.equal(changesPublicData(base, `${base}/rest/v1/places?id=eq.1`, "PATCH"), true);
  assert.equal(changesPublicData(base, `${base}/rest/v1/faq`, "post"), true);
  assert.equal(changesPublicData(base, `${base}/rest/v1/places?select=*`, "GET"), false);
  assert.equal(changesPublicData(base, `${base}/rest/v1/rpc/admin_apply_update`, "POST"), true);
  assert.equal(changesPublicData(base, `${base}/rest/v1/rpc/admin_merge_places`, "POST"), true);
  assert.equal(changesPublicData(base, `${base}/rest/v1/rpc/check_departure`, "POST"), true);
  assert.equal(changesPublicData(base, `${base}/rest/v1/rpc/admin_stats`, "POST"), false);
  assert.equal(changesPublicData(base, `${base}/rest/v1/rpc/is_admin`, "POST"), false);
  assert.equal(changesPublicData(base, `${base}/storage/v1/object/place-photos/a.webp`, "DELETE"), true);
  assert.equal(changesPublicData(base, `${base}/auth/v1/token`, "POST"), false);
  assert.equal(changesPublicData(base, "https://elders.example/rest/v1/places", "PATCH"), false);
});
