import { strict as assert } from "node:assert";
import { test } from "node:test";
import { quickChips } from "../src/lib/quick-chips";
import { DEFAULT_FILTERS, searchHref } from "../src/lib/search";

const chip = (f = DEFAULT_FILTERS, key: string, near?: { lat: number; lng: number }) => quickChips(f, near).find((c) => c.key === key)!;

test("zes snelle chips, alleen 'Zonder vertrektijd' in bosgroen", () => {
  const chips = quickChips(DEFAULT_FILTERS);
  assert.deepEqual(chips.map((c) => c.label), ["Dichtbij", "Zonder vertrektijd", "Gratis", "8+", "Stroom", "Lozen"]);
  assert.deepEqual(chips.filter((c) => c.brand).map((c) => c.key), ["vrij"]);
  assert.ok(chips.every((c) => !c.on));
});

test("Zonder vertrektijd gaat naar de eigen pagina en weer terug", () => {
  const on = chip(DEFAULT_FILTERS, "vrij").toggle();
  assert.equal(on.departure, "vrij");
  assert.equal(searchHref(on), "/zonder-vertrektijd");
  assert.equal(chip(on, "vrij").on, true);
  assert.equal(searchHref(chip(on, "vrij").toggle()), "/zoeken");
});

test("gratis, 8+, stroom en lozen zijn aan/uit-schakelaars", () => {
  let f = chip(DEFAULT_FILTERS, "gratis").toggle();
  assert.equal(f.free, true);
  f = chip(f, "score").toggle();
  assert.equal(f.minScore, 8);
  f = chip(chip(f, "stroom").toggle(), "lozen").toggle();
  assert.deepEqual(f.facilities, ["power", "dumpStation"]);
  f = chip(f, "stroom").toggle();
  assert.deepEqual(f.facilities, ["dumpStation"]);
  assert.equal(chip(f, "score").toggle().minScore, undefined);
});

test("Dichtbij: mijn locatie en sorteren op afstand; uit = heel Nederland", () => {
  const on = chip({ ...DEFAULT_FILTERS, province: "Gelderland" }, "dichtbij", { lat: 52, lng: 5 }).toggle();
  assert.equal(on.where, "Mijn locatie");
  assert.deepEqual(on.center, { lat: 52, lng: 5 });
  assert.equal(on.sort, "afstand");
  assert.equal(on.province, undefined);
  const off = chip(on, "dichtbij").toggle();
  assert.equal(off.where, undefined);
  assert.equal(off.center, undefined);
  assert.equal(off.sort, DEFAULT_FILTERS.sort);
});
