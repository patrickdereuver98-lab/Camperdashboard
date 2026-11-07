// Contentstudio: prompt en controle (plan §3.3)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkContent, contentPrompt, parseVariants, postText } from "../src/lib/marketing/content.ts";
import { parseFacts } from "../src/lib/marketing/facts.ts";

const facts = parseFacts({
  measured_at: "2026-11-02T10:00:00Z",
  places: 2186,
  provinces: [{ province: "Gelderland", places: 400 }, { province: "Flevoland", places: 20 }],
  departure: { known: 1444, vrij: 32, uitslapers: 350, ruim: 310, vroeg: 60 },
  price: { known: 1500, free: 120, median: 18.5 },
  facilities: { power: 1700, water: 1600, dump: 900, dogs: 1100 },
  new_7d: 0, new_30d: 12, checked_30d: 800,
  reviews: { count: 0, avg: null },
})!;

test("prompt: alleen publieke feiten, kanaalregels en de extra wens", () => {
  const p = contentPrompt("cijfers", "instagram", facts, "Noem de Veluwe");
  assert.match(p, /2\.186 camperplaatsen in Nederland/);
  assert.doesNotMatch(p, /32 plekken zonder vaste vertrektijd/, "klein aantal mag niet in de prompt");
  assert.match(p, /Gelderland: 400/);
  assert.doesNotMatch(p, /Flevoland: 20/);
  assert.match(p, /Extra wens: Noem de Veluwe/);
  assert.match(p, /3 verschillende varianten voor Instagram/);
});

test("checkContent: verzonnen getal, emoji, uitroepteken, superlatief, u-vorm", () => {
  const ok = { title: "Cijfers", body: "VrijStaan kent 2.186 camperplaatsen. Bij 350 mag je tot 12:00 blijven. Sinds 2026 gratis.", hashtags: ["camper", "nederland", "camperplaats"] };
  assert.deepEqual(checkContent(ok, "instagram", facts), []);
  const bad = { title: "Top", body: "De beste app met 3000 plekken en 95% tevreden gebruikers! 🚐 Probeer het uw volgende reis", hashtags: [] };
  const kinds = checkContent(bad, "instagram", facts).map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["emoji", "getal", "getal", "superlatief", "u-vorm", "uitroepteken"]);
});

test("DATA-15: vaste getallen alleen in hun patroon, een losse 11 of 24 is verzonnen", () => {
  const ok = { title: "Uitslapen", body: "Blijf tot 11:00, of per 24 uur. Prijs voor 2 personen.", hashtags: ["camper", "nederland", "camperplaats"] };
  assert.deepEqual(checkContent(ok, "instagram", facts), []);
  const loose = { title: "Nieuw", body: "Deze week 24 nieuwe plekken, en 11 met stroom.", hashtags: ["camper", "nederland", "camperplaats"] };
  assert.deepEqual(
    checkContent(loose, "instagram", facts).map((i) => i.detail),
    ['"24" staat niet in de feitenbank', '"11" staat niet in de feitenbank'],
  );
});

test("checkContent: Google Ads-lengtes", () => {
  const issues = checkContent({ title: "Camperplaatsen met vertrektijd in heel NL", body: "x".repeat(91), hashtags: [] }, "google-ads", facts);
  assert.equal(issues.filter((i) => i.kind === "lengte").length, 2);
});

test("parseVariants en postText", () => {
  const v = parseVariants(JSON.stringify({ variants: [{ title: "A", body: "Tekst", hashtags: ["#Camper", ""] }, { title: "", body: "x", hashtags: [] }] }))!;
  assert.equal(v.length, 1);
  assert.deepEqual(v[0].hashtags, ["camper"]);
  assert.equal(postText(v[0], "instagram"), "Tekst\n\n#camper");
  assert.equal(postText(v[0], "facebook", "https://vrijstaan.nl/?bron=facebook"), "Tekst\n\nhttps://vrijstaan.nl/?bron=facebook\n\n#camper");
  assert.equal(parseVariants("geen json"), null);
});
