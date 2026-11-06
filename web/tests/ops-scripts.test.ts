// Bewakingsscripts (review november 2026): de kolomlijst van de snapshot (ARCH-09) en de beoordeling van health()
// in monitor.yml (R3).
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePlaceColumns, readPlaceColumns } from "../scripts/place-columns.mjs";
import { evaluate } from "../scripts/check-health.mjs";

test("snapshot gebruikt precies PLACE_COLUMNS uit places.ts", () => {
  const cols: string = readPlaceColumns();
  const list = cols.split(",");
  for (const c of ["id", "slug", "departure", "checkout_until", "checkin_until", "reservation_rule", "price_extras"])
    assert.ok(list.includes(c), `${c} ontbreekt`);
  assert.equal(new Set(list).size, list.length, "dubbele kolom");
  // Geen eigen lijst meer in het script
  const script = readFileSync(new URL("../scripts/refresh-snapshot.mjs", import.meta.url), "utf8");
  assert.ok(script.includes("readPlaceColumns()"));
  assert.ok(!/"id,slug,name/.test(script), "refresh-snapshot.mjs heeft weer een eigen kolomlijst");
});

test("parsePlaceColumns leest samengevoegde tekst en weigert iets anders", () => {
  assert.equal(parsePlaceColumns('const PLACE_COLUMNS =\n  "id,slug," +\n  "name";'), "id,slug,name");
  assert.throws(() => parsePlaceColumns("const X = 1;"), /niet gevonden/);
  assert.throws(() => parsePlaceColumns('const PLACE_COLUMNS = BASE + "a";'), /geen samengevoegde tekst/);
  assert.throws(() => parsePlaceColumns('const PLACE_COLUMNS = "id,naam(x)";'), /Onverwachte kolom/);
});

const NOW = new Date("2026-11-06T12:00:00Z");
const healthy = {
  published: 2186,
  with_departure: 1444,
  with_price: 1249,
  last_scrape: "2026-11-06T10:00:00Z",
  net_calls_24h: 216,
  net_failed_24h: 10,
  app_errors_24h: 0,
  db_bytes: 106 * 1024 * 1024,
};

test("health: gezond geeft geen fouten", () => {
  const r = evaluate(healthy, healthy, {}, NOW);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.ok(r.lines.some((l: string) => l.includes("2186")));
});

test("health: daling van meer dan 2% faalt, 2% of minder niet", () => {
  const dropped = { ...healthy, with_departure: Math.floor(1444 * 0.97) };
  assert.match(evaluate(healthy, dropped, {}, NOW).errors.join(), /vertrekregel daalde/);
  const small = { ...healthy, with_price: 1249 - 20 };
  assert.deepEqual(evaluate(healthy, small, {}, NOW).errors, []);
  // Eerste run zonder vorige uitkomst: geen vergelijking
  assert.deepEqual(evaluate(null, dropped, {}, NOW).errors, []);
});

test("health: te weinig plekken, foutpercentage pg_net en oude scrape falen", () => {
  assert.match(evaluate(null, { ...healthy, published: 900 }, {}, NOW).errors.join(), /Maar 900/);
  assert.match(evaluate(null, { ...healthy, net_failed_24h: 50 }, {}, NOW).errors.join(), /50 van 216/);
  // Te weinig aanroepen om iets te zeggen
  assert.deepEqual(evaluate(null, { ...healthy, net_calls_24h: 5, net_failed_24h: 3 }, {}, NOW).errors, []);
  assert.match(evaluate(null, { ...healthy, last_scrape: "2026-11-03T12:00:00Z" }, {}, NOW).errors.join(), /72 uur oud/);
  assert.match(evaluate(null, {}, {}, NOW).errors.join(), /geen aantal/);
});

test("health: fouten in app_logs geven een waarschuwing, geen storing", () => {
  const r = evaluate(null, { ...healthy, app_errors_24h: 3 }, {}, NOW);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(), /3 fouten in app_logs/);
});

test("health: PostgREST kan grote getallen als tekst geven", () => {
  assert.deepEqual(evaluate(null, { ...healthy, db_bytes: "111149056", published: "2186" }, {}, NOW).errors, []);
});
