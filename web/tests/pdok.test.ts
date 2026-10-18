// Zoekvak "waar": adressen, postcodes en woonplaatsen via de PDOK Locatieserver, met de lokale lijst als terugval.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerSuggest,
  cleanQuery,
  fetchLookup,
  fetchSuggest,
  isLocationId,
  lookupUrl,
  parsePoint,
  suggestUrl,
  townsMatching,
  withoutKnownTowns,
} from "../src/lib/pdok";

const doc = (o: Record<string, unknown>) => ({ response: { numFound: 1, docs: [o] } });
const fakeFetch = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })) as typeof fetch;

test("zoekterm: getrimd, spaties samengevoegd, alleen gewone tekst, 2 tot 80 tekens", () => {
  assert.equal(cleanQuery("  Damrak   1 "), "Damrak 1");
  assert.equal(cleanQuery("1012 LG"), "1012 LG");
  assert.equal(cleanQuery("'s-Hertogenbosch"), "'s-Hertogenbosch");
  assert.equal(cleanQuery("Sint-Annaparochie, Waadhoeke"), "Sint-Annaparochie, Waadhoeke");
  assert.equal(cleanQuery("Groningen/Haren"), "Groningen/Haren");
  assert.equal(cleanQuery("Zuid-Beijerland 2a"), "Zuid-Beijerland 2a");
  assert.equal(cleanQuery("Öosterbeek"), "Öosterbeek");
  assert.equal(cleanQuery(null), null);
  assert.equal(cleanQuery(""), null);
  assert.equal(cleanQuery("a"), null);
  assert.equal(cleanQuery("x".repeat(81)), null);
  assert.equal(cleanQuery("x".repeat(80)), "x".repeat(80));
  // Tekens waarmee je de zoekmachine van PDOK zou kunnen sturen
  assert.equal(cleanQuery("type:adres"), null);
  assert.equal(cleanQuery("ams*"), null);
  assert.equal(cleanQuery('"Damrak"'), null);
  assert.equal(cleanQuery("<script>"), null);
  assert.equal(cleanQuery("a\u0000b"), null);
});

test("id van PDOK: drie letters, streepje, letters en cijfers", () => {
  assert.ok(isLocationId("adr-c6e2a9c3f1b5e0d7a8b4c2e1f0a9d8c7"));
  assert.ok(isLocationId("wpl-3594"));
  assert.ok(!isLocationId("adr-abc&fl=*"));
  assert.ok(!isLocationId(""));
  assert.ok(!isLocationId(null));
  assert.ok(!isLocationId("x".repeat(100)));
});

test("centroide_ll is POINT(lon lat), alleen in en rond Nederland", () => {
  assert.deepEqual(parsePoint("POINT(4.89352 52.37285)"), { lat: 52.37285, lng: 4.89352 });
  assert.equal(parsePoint("POINT(2.35 48.85)"), null);
  assert.equal(parsePoint("POINT(abc def)"), null);
  assert.equal(parsePoint(undefined), null);
  assert.equal(parsePoint(42), null);
});

test("urls naar PDOK: alleen woonplaats, postcode, adres en gemeente; zoekterm gecodeerd", () => {
  const s = new URL(suggestUrl("Damrak 1"));
  assert.equal(s.origin + s.pathname, "https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest");
  assert.equal(s.searchParams.get("q"), "Damrak 1");
  assert.equal(s.searchParams.get("fq"), "type:(woonplaats OR postcode OR adres OR gemeente)");
  assert.equal(s.searchParams.get("rows"), "8");
  assert.equal(s.searchParams.get("fl"), "id,weergavenaam,type,centroide_ll");
  const l = new URL(lookupUrl("adr-1"));
  assert.equal(l.pathname, "/bzk/locatieserver/search/v3_1/lookup");
  assert.equal(l.searchParams.get("id"), "adr-1");
  assert.equal(l.searchParams.get("fl"), "weergavenaam,centroide_ll,type");
});

test("suggesties worden locaties met soort, naam en coördinaat; rommel valt weg", async () => {
  const body = {
    response: {
      docs: [
        { id: "adr-1", type: "adres", weergavenaam: "Damrak 1, 1012LG Amsterdam", centroide_ll: "POINT(4.8936 52.3762)" },
        { id: "pcd-1", type: "postcode", weergavenaam: "1012LG Amsterdam" },
        { id: "wpl-1", type: "woonplaats", weergavenaam: "Giethoorn, Steenwijkerland, Overijssel", centroide_ll: "POINT(6.08 52.74)" },
        { id: "str-1", type: "weg", weergavenaam: "Damrak, Amsterdam" },
        { id: "bad id", type: "adres", weergavenaam: "X" },
        { id: "adr-2", type: "adres" },
      ],
    },
  };
  const out = await fetchSuggest("Damrak 1", fakeFetch(body));
  assert.deepEqual(out, [
    { id: "adr-1", type: "adres", label: "Damrak 1, 1012LG Amsterdam", lat: 52.3762, lng: 4.8936 },
    { id: "pcd-1", type: "postcode", label: "1012LG Amsterdam" },
    { id: "wpl-1", type: "woonplaats", label: "Giethoorn, Steenwijkerland, Overijssel", lat: 52.74, lng: 6.08 },
  ]);
});

test("een fout of onverwacht antwoord van PDOK geeft een fout, geen lege lijst", async () => {
  await assert.rejects(fetchSuggest("Damrak", fakeFetch({}, 503)));
  await assert.rejects(fetchSuggest("Damrak", fakeFetch({ iets: "anders" })));
  await assert.rejects(
    fetchSuggest("Damrak", (async () => {
      throw new Error("netwerk");
    }) as typeof fetch),
  );
});

test("lookup geeft de coördinaat van één suggestie, of null als die er niet is", async () => {
  const hit = await fetchLookup("pcd-1", fakeFetch(doc({ type: "postcode", weergavenaam: "1012LG Amsterdam", centroide_ll: "POINT(4.89 52.37)" })));
  assert.deepEqual(hit, { id: "pcd-1", type: "postcode", label: "1012LG Amsterdam", lat: 52.37, lng: 4.89 });
  assert.equal(await fetchLookup("pcd-1", fakeFetch({ response: { numFound: 0, docs: [] } })), null);
  await assert.rejects(fetchLookup("pcd-1", fakeFetch({}, 500)));
});

const towns = [
  { name: "Amsterdam", province: "Noord-Holland", lat: 52.37, lng: 4.9 },
  { name: "Amstelveen", province: "Noord-Holland", lat: 52.3, lng: 4.86 },
  { name: "Giethoorn", province: "Overijssel", lat: 52.74, lng: 6.08 },
  { name: "'s-Hertogenbosch", province: "Noord-Brabant", lat: 51.69, lng: 5.3 },
];

test("terugval: woonplaatsen uit de lokale lijst, eerst wat met de zoekterm begint", () => {
  assert.deepEqual(
    townsMatching(towns, "amst").map((t) => t.label),
    ["Amstelveen", "Amsterdam"],
  );
  assert.deepEqual(townsMatching(towns, "hoorn").map((t) => t.label), ["Giethoorn"]);
  assert.deepEqual(townsMatching(towns, "s hertogenbosch")[0], {
    type: "woonplaats",
    label: "'s-Hertogenbosch",
    province: "Noord-Brabant",
    lat: 51.69,
    lng: 5.3,
  });
  assert.deepEqual(townsMatching(towns, "1012LG"), []);
});

test("antwoord: PDOK als die werkt, anders de lokale lijst, en nooit een fout", async () => {
  const ok = await answerSuggest("Damrak 1", {
    suggest: async () => [{ id: "adr-1", type: "adres", label: "Damrak 1, 1012LG Amsterdam", lat: 52.37, lng: 4.89 }],
    towns: async () => towns,
  });
  assert.equal(ok.bron, "pdok");
  assert.equal(ok.resultaten.length, 1);

  const down = await answerSuggest("Amster", {
    suggest: async () => {
      throw new Error("PDOK plat");
    },
    towns: async () => towns,
  });
  assert.equal(down.bron, "lokaal");
  assert.deepEqual(down.resultaten.map((r) => r.label), ["Amsterdam"]);

  const allDown = await answerSuggest("Amster", {
    suggest: async () => {
      throw new Error("PDOK plat");
    },
    towns: async () => {
      throw new Error("ook plat");
    },
  });
  assert.deepEqual(allDown, { bron: "lokaal", resultaten: [] });
});

test("woonplaatsen die het zoekvak al uit de eigen lijst toont, komen niet dubbel", () => {
  const remote = [
    { id: "wpl-1", type: "woonplaats" as const, label: "Giethoorn, Steenwijkerland, Overijssel" },
    { id: "gem-1", type: "gemeente" as const, label: "Steenwijkerland, Overijssel" },
    { id: "adr-1", type: "adres" as const, label: "Giethoorn 1, 8355AA Giethoorn" },
  ];
  assert.deepEqual(
    withoutKnownTowns(remote, ["Giethoorn"]).map((r) => r.id),
    ["gem-1", "adr-1"],
  );
});
