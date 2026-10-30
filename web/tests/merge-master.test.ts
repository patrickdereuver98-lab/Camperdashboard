import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  chunk, clusterRecords, geohash, haversineM, levenshtein, matchScore, mergeLists, nameSimilarity, normalizeName,
  reuseIds, runMergeMaster, toBronrecord, upsertMaster, type Bronrecord, type MasterDb, type MasterRecord,
} from "../supabase/functions/pipeline/merge_master.ts";

const rec = (bron_id: string, naam: string | null, lat: number, lon: number, faciliteiten: Record<string, unknown> = {}): Bronrecord =>
  ({ bron_id, naam, lat, lon, faciliteiten });

// Verschuiving in meters naar het noorden/oosten rond 52° NB
const north = (m: number) => m / 111_320;
const east = (m: number, lat = 52) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

// ── Bouwstenen ───────────────────────────────────────────────────────────────

test("haversine: Amsterdam Centraal → Utrecht Centraal ±34 km, en 0 voor hetzelfde punt", () => {
  const d = haversineM(52.3791, 4.9003, 52.0894, 5.1101);
  assert.ok(d > 34_500 && d < 35_500, String(d));
  assert.equal(haversineM(52, 5, 52, 5), 0);
  assert.ok(Math.abs(haversineM(52, 5, 52 + north(100), 5) - 100) < 0.5);
});

test("geohash zoals de standaard (en PostGIS)", () => {
  assert.equal(geohash(57.64911, 10.40744, 11), "u4pruydqqvj");
  assert.equal(geohash(52.3791, 4.9003, 5), "u173z");
  assert.equal(geohash(52, 5).length, 9);
});

test("levenshtein", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("hoeve", "hoeve"), 0);
});

test("namen: soortwoorden, accenten en leestekens tellen niet", () => {
  assert.equal(normalizeName("Camperplaats 'De Hoeve'"), "de hoeve");
  assert.equal(normalizeName("Wohnmobilstellplatz Düsseldorf"), "dusseldorf");
  assert.equal(normalizeName("De Bosrand Camperplek"), "de bosrand");
  assert.equal(normalizeName("Camping"), "camping"); // alleen een soortwoord: dat houden we
  assert.equal(normalizeName(null), "");
});

test("naamgelijkenis: zelfde plek, tikfout, woordvolgorde, extra plaatsnaam; anders laag; onbekend = null", () => {
  assert.equal(nameSimilarity("Camperplaats De Hoeve", "De Hoeve"), 1);
  assert.ok(nameSimilarity("De Hoeve", "De Hoef")! >= 0.75);
  assert.equal(nameSimilarity("Hoeve De", "De Hoeve"), 1);
  assert.ok(nameSimilarity("De Hoeve", "De Hoeve Lochem")! >= 0.95);
  assert.ok(nameSimilarity("De Hoeve", "Jachthaven Het Anker")! < 0.5);
  // Alleen "de" gemeen is geen match
  assert.ok(nameSimilarity("De Wei", "De Molen")! < 0.6);
  assert.equal(nameSimilarity(null, "De Hoeve"), null);
});

test("score: buiten 100 m geen match; zonder naam alleen dichtbij", () => {
  const a = rec("a:1", "De Hoeve", 52, 5);
  assert.equal(matchScore(a, rec("b:1", "De Hoeve", 52 + north(101), 5)), null);
  assert.ok(matchScore(a, rec("b:1", "De Hoeve", 52 + north(99), 5))!.score >= 0.75);
  assert.ok(matchScore(a, rec("b:1", null, 52 + north(20), 5))!.score >= 0.75);
  assert.ok(matchScore(a, rec("b:1", null, 52 + north(40), 5))!.score < 0.75);
});

test("invoer: ongeldige records vallen af, lege faciliteiten ook", () => {
  assert.equal(toBronrecord({ naam: "x", lat: 0, lon: 0, bron_id: "a" }), null);
  assert.equal(toBronrecord({ naam: "x", lat: 95, lon: 5, bron_id: "a" }), null);
  assert.equal(toBronrecord({ naam: "x", lat: 52, lon: 5, bron_id: "" }), null);
  assert.equal(toBronrecord({ naam: "x", lat: "52,1", lon: 5, bron_id: "a" }), null);
  assert.deepEqual(toBronrecord({ naam: " ", lat: "52.1", lon: 5, bron_id: "a", faciliteiten: { water: true, stroom: null } }), {
    naam: null, lat: 52.1, lon: 5, bron_id: "a", faciliteiten: { water: true },
  });
});

// ── Samenvoegen ──────────────────────────────────────────────────────────────

test("twee bronnen, zelfde plek binnen 100 m: één record met beide bron_ids; anker wint naam en plek", () => {
  const { records, skipped } = mergeLists([
    [rec("partner:7", "Camperplaats De Hoeve", 52, 5, { stroom: true })],
    [rec("osm:node/1", "De Hoeve", 52 + north(60), 5, { water: true })],
  ]);
  assert.equal(skipped, 0);
  assert.equal(records.length, 1);
  const [m] = records;
  assert.equal(m.master_id, "partner:7");
  assert.deepEqual(m.bron_ids, ["partner:7", "osm:node/1"]);
  assert.equal(m.naam, "Camperplaats De Hoeve");
  assert.deepEqual(m.namen, ["Camperplaats De Hoeve", "De Hoeve"]);
  assert.deepEqual([m.lat, m.lon], [52, 5]);
  assert.deepEqual(m.faciliteiten, { stroom: true, water: true });
  assert.equal(m.geohash, geohash(52, 5));
});

test("dichtbij maar andere naam: twee records", () => {
  const { records } = mergeLists([[rec("a:1", "De Hoeve", 52, 5)], [rec("b:1", "Jachthaven Het Anker", 52 + north(30), 5)]]);
  assert.equal(records.length, 2);
});

test("geen ketting: B koppelt aan A, C ligt 180 m van A en blijft los", () => {
  const groups = clusterRecords([[
    rec("a", "De Hoeve", 52, 5),
    rec("b", "De Hoeve", 52 + north(90), 5),
    rec("c", "De Hoeve", 52 + north(180), 5),
  ]]);
  assert.deepEqual(groups.map((g) => g.members.map((m) => m.bron_id)), [["a", "b"], ["c"]]);
});

test("het beste anker wint", () => {
  const groups = clusterRecords([
    [rec("a", "De Hoeve", 52, 5), rec("b", "De Hoef", 52 + north(150), 5)],
    [rec("x", "De Hoef", 52 + north(80), 5)],
  ]);
  assert.deepEqual(groups.find((g) => g.anchor.bron_id === "b")!.members.map((m) => m.bron_id), ["b", "x"]);
});

test("raster: matcht ook over celgrenzen en in oost-west-richting", () => {
  for (const [dn, de] of [[0, 95], [95, 0], [-60, -60], [60, 60]]) {
    const { records } = mergeLists([[rec("a", "De Hoeve", 52.0004, 5.0007)], [rec("b", "De Hoeve", 52.0004 + north(dn), 5.0007 + east(de))]]);
    assert.equal(records.length, 1, `${dn} N, ${de} O`);
  }
});

test("faciliteiten: oneens = leeg + conflict (nooit kiezen); eens = waarde", () => {
  const { records } = mergeLists([
    [rec("a", "De Hoeve", 52, 5, { stroom: true, honden: "aangelijnd" })],
    [rec("b", "De Hoeve", 52, 5, { stroom: false, honden: "aangelijnd" })],
  ]);
  assert.deepEqual(records[0].faciliteiten, { honden: "aangelijnd" });
  assert.deepEqual(records[0].conflicten, { stroom: [{ bron_id: "a", waarde: true }, { bron_id: "b", waarde: false }] });
});

test("hetzelfde bron_id twee keer telt één keer; ongeldige records worden geteld", () => {
  const { records, skipped } = mergeLists([[rec("a", "X", 52, 5), { lat: "nee" }], [rec("a", "X", 52, 5)]]);
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].bron_ids, ["a"]);
  assert.equal(skipped, 1);
});

test("10.000 punten binnen een seconde (raster, geen n²)", () => {
  const list = Array.from({ length: 10_000 }, (_, i) => rec(`p:${i}`, `Plek ${i}`, 50.8 + (i % 100) * 0.03, 3.4 + Math.floor(i / 100) * 0.04));
  const t = performance.now();
  const { records } = mergeLists([list, list.map((r) => ({ ...r, bron_id: `q:${r.bron_id}`, lat: r.lat + north(10) }))]);
  assert.equal(records.length, 10_000);
  assert.ok(performance.now() - t < 1000);
});

// ── Vaste ids over runs heen ─────────────────────────────────────────────────

const master = (master_id: string, bron_ids: string[]): MasterRecord => ({
  master_id, bron_ids, geohash: "u", naam: null, namen: [], lat: 52, lon: 5, faciliteiten: {}, conflicten: {}, match_score: 1,
});

test("reuseIds: nieuw anker met meer voorrang houdt het oude id; opgegane masters zijn stale", () => {
  const { records, stale } = reuseIds(
    [master("partner:1", ["partner:1", "osm:1", "osm:2"]), master("nieuw:9", ["nieuw:9"])],
    [{ master_id: "osm:1", bron_ids: ["osm:1"] }, { master_id: "osm:2", bron_ids: ["osm:2"] }],
  );
  assert.deepEqual(records.map((r) => r.master_id), ["osm:1", "nieuw:9"]);
  assert.deepEqual(stale, ["osm:2"]);
});

test("reuseIds: eigen anker-id al door een andere groep geclaimd → volgend vrij bron_id, nooit dubbel", () => {
  const { records } = reuseIds(
    [master("p:2", ["p:2", "q:5"]), master("osm:1", ["osm:1", "r:3"])],
    [{ master_id: "osm:1", bron_ids: ["osm:1", "p:2", "q:5"] }],
  );
  const ids = records.map((r) => r.master_id);
  assert.equal(new Set(ids).size, 2);
  assert.ok(ids.includes("osm:1"));
});

// ── Database ─────────────────────────────────────────────────────────────────

test("chunk: stukken van 500", () => {
  assert.deepEqual(chunk(Array.from({ length: 1201 }, (_, i) => i)).map((c) => c.length), [500, 500, 201]);
  assert.deepEqual(chunk([]), []);
});

function fakeDb(opts: { failChunk?: number; existing?: { master_id: string; bron_ids: string[] }[] } = {}) {
  const calls: { upserts: object[][]; deletes: string[][]; lookups: string[][] } = { upserts: [], deletes: [], lookups: [] };
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const db: MasterDb = {
    from: () => ({
      select: () => ({
        overlaps: (_c, values) => {
          calls.lookups.push(values);
          return ok((opts.existing ?? []).filter((e) => e.bron_ids.some((b) => values.includes(b))));
        },
      }),
      upsert: (rows) => {
        calls.upserts.push(rows);
        return calls.upserts.length - 1 === opts.failChunk ? Promise.resolve({ data: null, error: { message: "kapot" } }) : ok(null);
      },
      delete: () => ({ in: (_c, values) => (calls.deletes.push(values), ok(null)) }),
    }),
  };
  return { db, calls };
}

test("upsert in stukken van 500 op master_id", async () => {
  const { db, calls } = fakeDb();
  const records = Array.from({ length: 1234 }, (_, i) => master(`m:${i}`, [`m:${i}`]));
  const report = await upsertMaster(db, records, { stale: ["oud:1"] });
  assert.deepEqual(calls.upserts.map((c) => c.length), [500, 500, 234]);
  assert.ok("bijgewerkt_op" in calls.upserts[0][0]);
  assert.deepEqual(report, { upserted: 1234, chunks: 3, removed: 1, failed: [] });
});

test("mislukt stuk: rest gaat door, maar niets opruimen", async () => {
  const { db, calls } = fakeDb({ failChunk: 1 });
  const report = await upsertMaster(db, Array.from({ length: 1100 }, (_, i) => master(`m:${i}`, [`m:${i}`])), { stale: ["oud:1"] });
  assert.equal(report.upserted, 600);
  assert.deepEqual(report.failed, [{ chunk: 1, error: "kapot" }]);
  assert.deepEqual(calls.deletes, []);
});

test("runMergeMaster: proefrun schrijft niets; echte run houdt het oude id", async () => {
  const lists = [[rec("partner:7", "De Hoeve", 52, 5)], [rec("osm:1", "De Hoeve", 52, 5)]];
  const dry = fakeDb({ existing: [{ master_id: "osm:1", bron_ids: ["osm:1"] }] });
  const r1 = await runMergeMaster(dry.db, lists, { dryRun: true });
  assert.equal(r1.masters, 1);
  assert.deepEqual(dry.calls.upserts, []);

  const live = fakeDb({ existing: [{ master_id: "osm:1", bron_ids: ["osm:1"] }] });
  const r2 = await runMergeMaster(live.db, lists);
  assert.equal((live.calls.upserts[0][0] as MasterRecord).master_id, "osm:1");
  assert.equal(r2.stale, 0);
});
