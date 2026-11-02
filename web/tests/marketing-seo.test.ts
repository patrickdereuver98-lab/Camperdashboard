// Marketingdashboard: feitenbank en Search Console-regels (plan §3.1 en §3.2)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allowedNumbers, factLines, parseFacts, PUBLIC_MIN } from "../src/lib/marketing/facts.ts";
import { aggregate, expectedCtr, opportunities, sumPeriods } from "../src/lib/marketing/seo.ts";

const raw = {
  measured_at: "2026-11-02T10:00:00Z",
  places: 2186,
  provinces: [{ province: "Gelderland", places: 400 }, { province: "Flevoland", places: 20 }],
  departure: { known: 1444, vrij: 32, uitslapers: 350, ruim: 310, vroeg: 60 },
  price: { known: 1500, free: 120, median: "18.50" },
  facilities: { power: 1700, water: 1600, dump: 900, dogs: 1100 },
  new_7d: 0,
  new_30d: 12,
  checked_30d: 800,
  reviews: { count: 0, avg: null },
};

test("parseFacts: getallen als tekst worden getallen, ontbrekend wordt 0", () => {
  const f = parseFacts(raw)!;
  assert.equal(f.price.median, 18.5);
  assert.equal(f.reviews.avg, null);
  assert.equal(parseFacts({ places: 5 })!.departure.vrij, 0);
  assert.equal(parseFacts(null), null);
});

test("factLines: kleine aantallen zijn niet publiek", () => {
  const lines = factLines(parseFacts(raw)!);
  assert.equal(lines.find((l) => l.key === "places")!.public, true);
  assert.equal(lines.find((l) => l.key === "vrij")!.public, false, "32 plekken zonder vertrektijd is te klein");
  assert.equal(lines.find((l) => l.key === "new_30d")!.public, false);
  assert.ok(PUBLIC_MIN > 32);
});

test("allowedNumbers: publieke feiten en vaste app-getallen, geen kleine aantallen", () => {
  const set = allowedNumbers(parseFacts(raw)!);
  assert.ok(set.has(2186) && set.has(350) && set.has(400) && set.has(2) && set.has(12));
  assert.ok(!set.has(32), "32 mag niet");
  assert.ok(!set.has(20), "provincie met 20 plekken mag niet");
});

test("sumPeriods: laatste 28 dagen tegenover de 28 daarvoor, positie gewogen", () => {
  const rows = Array.from({ length: 56 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 1) + i * 864e5).toISOString().slice(0, 10),
    clicks: i < 28 ? 1 : 2,
    impressions: 10,
    position: i < 28 ? 20 : 10,
  }));
  const { current, previous } = sumPeriods(rows, 28);
  assert.equal(current.days, 28);
  assert.equal(current.clicks, 56);
  assert.equal(previous.clicks, 28);
  assert.equal(current.position, 10);
  assert.equal(current.ctr, 0.2);
  assert.equal(sumPeriods([], 28).current.days, 0);
});

test("aggregate: rijen per dag samen per zoekvraag", () => {
  const agg = aggregate(
    [
      { query: "camperplaats ede", page: "https://vrijstaan.nl/plek/a", clicks: 1, impressions: 10, position: 4 },
      { query: "camperplaats ede", page: "https://vrijstaan.nl/plek/a", clicks: 0, impressions: 30, position: 8 },
    ],
    "query",
  );
  assert.equal(agg.length, 1);
  assert.equal(agg[0].impressions, 40);
  assert.equal(agg[0].position, 7);
});

test("opportunities: lage CTR, bijna top, nieuwe pagina; merknaam en weinig vertoningen tellen niet", () => {
  const p = "https://vrijstaan.nl";
  const kansen = opportunities(
    [
      { query: "camperplaats zonder vertrektijd", page: `${p}/zonder-vertrektijd`, clicks: 1, impressions: 200, position: 3 },
      { query: "camperplaats veluwe", page: `${p}/zonder-vertrektijd/gelderland`, clicks: 2, impressions: 100, position: 12 },
      { query: "camperplaats texel", page: `${p}/`, clicks: 0, impressions: 80, position: 9 },
      { query: "vrijstaan", page: `${p}/`, clicks: 0, impressions: 500, position: 1 },
      { query: "camperplaats urk", page: `${p}/plek/x`, clicks: 0, impressions: 10, position: 2 },
      { query: "camperplaats goed", page: `${p}/plek/y`, clicks: 50, impressions: 200, position: 2 },
    ],
    ["Texel", "Gelderland"],
  );
  assert.deepEqual(kansen.map((k) => [k.kind, k.query]), [
    ["nieuwe-pagina", "camperplaats texel"],
    ["ctr", "camperplaats zonder vertrektijd"],
    ["bijna", "camperplaats veluwe"],
  ]);
  assert.ok(expectedCtr(1) > expectedCtr(5) && expectedCtr(30) === 0.01);
});

test("links: bron en campagne netjes, bestaande parameters blijven", async () => {
  const { campaignLink, cleanSource } = await import("../src/lib/marketing/links.ts");
  assert.equal(cleanSource(" Instagram Bio! "), "instagram-bio");
  assert.equal(cleanSource("---"), undefined);
  assert.equal(cleanSource("x".repeat(60))!.length, 40);
  assert.equal(campaignLink("https://vrijstaan.nl/", "/zoeken?q=ede", "Instagram", "Voorjaar 2027"), "https://vrijstaan.nl/zoeken?q=ede&bron=instagram&campagne=voorjaar-2027");
  assert.equal(campaignLink("https://vrijstaan.nl", "", "flyer"), "https://vrijstaan.nl/?bron=flyer");
});

test("factsFromSummaries: zelfde vertrekgroepen als de database", async () => {
  const { factsFromSummaries } = await import("../src/lib/marketing/public-facts.ts");
  const base = { id: "x", slug: "x", name: "x", lat: 52, lng: 5, town: "Ede", ratingCount: 0, completeness: 1 };
  const f = factsFromSummaries([
    { ...base, province: "Gelderland", departure: "vrij", priceEur: 0, power: true },
    { ...base, province: "Gelderland", departure: "vrij", departureCheck: "voorwaardelijk", priceEur: 10 },
    { ...base, province: "Zeeland", departure: "vast", checkoutUntil: "12:00", priceEur: 20 },
    { ...base, province: "Zeeland", departure: "vast", checkoutUntil: "9.30", priceEur: 30 },
  ] as never);
  assert.deepEqual(f.departure, { known: 3, vrij: 1, uitslapers: 1, ruim: 0, vroeg: 1 });
  assert.equal(f.price.median, 20);
  assert.equal(f.price.free, 1);
  assert.deepEqual(f.provinces.map((p) => p.places), [2, 2]);
});
