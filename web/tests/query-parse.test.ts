// Zoekvak in gewone taal (UX-audit november, Z2) en recente zoekopdrachten (Z1)
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeParsed, parseQuery } from "../src/lib/query-parse";
import { addRecent, decodeRecentPlaces, decodeRecentSearches } from "../src/lib/recent";

test("plaats met filters: gratis texel met stroom", () => {
  const p = parseQuery("gratis texel met stroom");
  assert.equal(p.rest, "texel");
  assert.equal(p.patch.free, true);
  assert.deepEqual(p.patch.facilities, ["power"]);
  assert.deepEqual(p.labels, ["gratis", "stroom"]);
});

test("vertrekgroep: zonder vertrektijd zeeland en uitslapen in friesland", () => {
  assert.deepEqual(parseQuery("zonder vertrektijd zeeland"), { rest: "zeeland", patch: { departure: "vrij" }, labels: ["zonder vertrektijd"] });
  const u = parseQuery("Uitslapen in Friesland");
  assert.equal(u.rest, "friesland");
  assert.equal(u.patch.departure, "uitslapers");
  assert.equal(parseQuery("geen vaste vertrektijd").patch.departure, "vrij");
});

test("prijsgrens wordt de stap eronder; onder 10 is gratis niet: alleen onder de laagste stap", () => {
  assert.equal(parseQuery("onder 15 euro veluwe").patch.maxPrice, 15);
  assert.equal(parseQuery("max €12").patch.maxPrice, 10);
  assert.equal(parseQuery("tot 30 euro").patch.maxPrice, 25);
  assert.equal(parseQuery("onder 5 euro").patch.free, true);
  assert.equal(parseQuery("onder 15 euro veluwe").rest, "veluwe");
});

test("voorzieningen, soorten en open; vulwoorden vallen weg", () => {
  const p = parseQuery("camping met douche en wifi bij de boer open");
  assert.deepEqual(p.patch.facilities, ["shower", "wifi"]);
  assert.deepEqual(p.patch.kinds?.sort(), ["boerderij", "camping"]);
  assert.equal(p.patch.openNow, true);
  assert.equal(p.rest, "");
  assert.deepEqual(parseQuery("honden welkom").patch.facilities, ["dogs"]);
});

test("niets herkend: de vraag blijft zoals hij was", () => {
  assert.deepEqual(parseQuery("Den Bosch"), { rest: "Den Bosch", patch: {}, labels: [] });
  assert.deepEqual(parseQuery("Giethoorn"), { rest: "Giethoorn", patch: {}, labels: [] });
  // Alleen "camperplaats" is geen filter
  assert.deepEqual(parseQuery("camperplaats").patch, {});
  // Een woord dat er alleen op lijkt, telt niet: "Waterland" is geen "water"
  assert.deepEqual(parseQuery("Waterland").patch, {});
});

test("samenvatting voor de suggestie", () => {
  assert.equal(describeParsed("Texel", ["gratis", "stroom"]), "Texel, gratis, stroom");
  assert.equal(describeParsed(undefined, ["stroom"]), "Stroom");
});

test("recente zoekopdrachten: nieuwste boven, geen dubbele, maximaal 5, geen vreemde adressen", () => {
  const same = (a: { href: string }, b: { href: string }) => a.href === b.href;
  let list: { label: string; href: string; at: string }[] = [];
  for (let i = 0; i < 7; i++) list = addRecent(list, { label: `p${i}`, href: `/zoeken?i=${i}`, at: "x" }, same);
  assert.equal(list.length, 5);
  assert.equal(list[0].label, "p6");
  list = addRecent(list, { label: "p3", href: "/zoeken?i=3", at: "y" }, same);
  assert.equal(list[0].href, "/zoeken?i=3");
  assert.equal(list.filter((x) => x.href === "/zoeken?i=3").length, 1);
  assert.deepEqual(decodeRecentSearches([{ label: "x", href: "//evil.example", at: "t" }, { label: "y", href: "/zoeken", at: "t" }]), [{ label: "y", href: "/zoeken", at: "t" }]);
  assert.equal(decodeRecentSearches("kapot"), undefined);
  assert.deepEqual(decodeRecentPlaces([{ slug: "Bad Slug", name: "x", town: "", at: "t" }]), []);
});
