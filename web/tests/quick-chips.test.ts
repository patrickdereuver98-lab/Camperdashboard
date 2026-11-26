import { strict as assert } from "node:assert";
import { test } from "node:test";
import { quickChips } from "../src/lib/quick-chips";
import { DEFAULT_FILTERS, searchHref } from "../src/lib/search";

const chip = (f = DEFAULT_FILTERS, key: string) => quickChips(f).find((c) => c.key === key)!;

test("vier snelle chips, allemaal uit bij de standaardfilters (UI/UX-plan T13, R49)", () => {
  const chips = quickChips(DEFAULT_FILTERS);
  assert.deepEqual(chips.map((c) => c.label), ["Zonder vertrektijd", "Vertrek 12:00 of later", "Nu open", "Voorzieningen"]);
  assert.ok(chips.every((c) => !c.on));
});

test("Zonder vertrektijd gaat naar de eigen pagina en weer terug", () => {
  const on = chip(DEFAULT_FILTERS, "vrij").toggle();
  assert.equal(on.departure, "vrij");
  assert.equal(searchHref(on), "/zonder-vertrektijd");
  assert.equal(chip(on, "vrij").on, true);
  assert.equal(searchHref(chip(on, "vrij").toggle()), "/zoeken");
});

test("12:00 of later gaat naar uitslapers en vervangt Zonder vertrektijd", () => {
  const vrij = chip(DEFAULT_FILTERS, "vrij").toggle();
  const laat = chip(vrij, "uitslapers").toggle();
  assert.equal(laat.departure, "uitslapers");
  assert.equal(searchHref(laat), "/uitslapers");
  assert.equal(chip(laat, "vrij").on, false);
  assert.equal(chip(laat, "uitslapers").toggle().departure, undefined);
});

test("Nu open is een schakelaar; Voorzieningen staat aan zodra er een voorziening gekozen is", () => {
  const open = chip(DEFAULT_FILTERS, "open").toggle();
  assert.equal(open.openNow, true);
  assert.equal(chip(open, "open").toggle().openNow, false);
  assert.equal(chip({ ...DEFAULT_FILTERS, facilities: ["power"] }, "voorzieningen").on, true);
});
