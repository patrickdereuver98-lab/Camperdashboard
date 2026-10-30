// Ontdubbelen vóór de import: zelfde plek als punt en vlak in OSM wordt één rij, twijfelgevallen blijven apart
import { test } from "node:test";
import assert from "node:assert/strict";
import { clusters, dedupeOsm, distanceM, nameKey, sameName } from "../supabase/functions/pipeline/dedupe";

const row = (osm_type: string, osm_id: number, name: string | undefined, lat: number, lng: number, extra: Record<string, unknown> = {}): Record<string, unknown> & { lat: number; lng: number } => ({
  osm_type, osm_id, name, kind: "camping", lat, lng, ...extra,
});

test("afstand in meters", () => {
  assert.ok(Math.abs(distanceM({ lat: 52, lng: 5 }, { lat: 52.001, lng: 5 }) - 111) < 1);
});

test("namen: zelfde na opschonen, of zelfde kern bij hetzelfde soort plek", () => {
  assert.equal(nameKey("Minicamping 't Haike"), "haike");
  assert.ok(sameName({ lat: 0, lng: 0, name: "Jachthaven De Lemsterpoort" }, { lat: 0, lng: 0, name: "Jachthaven 'De Lemsterpoort'" }));
  assert.ok(sameName({ lat: 0, lng: 0, name: "camping 't Haike", kind: "camping" }, { lat: 0, lng: 0, name: "Minicamping 't Haike", kind: "camping" }));
  // Camping en camperplaats van dezelfde boer zijn twee plekken tot een mens anders beslist
  assert.ok(!sameName({ lat: 0, lng: 0, name: "Camping de Boomgaard", kind: "camping" }, { lat: 0, lng: 0, name: "Camperplaats de Boomgaard", kind: "camperplaats" }));
  assert.ok(!sameName({ lat: 0, lng: 0, name: "Veld 11" }, { lat: 0, lng: 0, name: "Veld 12" }));
  assert.ok(!sameName({ lat: 0, lng: 0, name: "Enkhuizer Strand" }, { lat: 0, lng: 0, name: "Droomparken Enkhuizer Strand" }));
  // Zonder naam nooit samenvoegen op afstand alleen
  assert.ok(!sameName({ lat: 0, lng: 0 }, { lat: 0, lng: 0 }));
});

test("clusters: binnen 100 m én zelfde naam, transitief, verder weg apart", () => {
  const rows = [
    row("node", 1, "Camping De Zeeman", 52.0, 5.0),
    row("way", 2, "Camping De Zeeman", 52.0004, 5.0), // 44 m
    row("relation", 3, "Camping de Zeeman", 52.0008, 5.0), // 44 m van way 2, 89 m van node 1
    row("node", 4, "Camping De Zeeman", 52.01, 5.0), // 1,1 km: andere plek
    row("node", 5, undefined, 52.0001, 5.0),
  ];
  const groups = clusters(rows).map((g) => g.sort()).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(groups, [[0, 1, 2], [3], [4]]);
});

test("dedupeOsm: rijkste rij leidt, vult aan uit de andere en noemt ze in osm_refs", () => {
  const rows = [
    row("node", 10, "Camping Zonnehoek", 52.1, 5.1, { phone: "0123" }),
    row("way", 20, "Camping Zonnehoek", 52.1001, 5.1, { website: "https://zonnehoek.nl", power: true }),
    row("node", 30, "Andere plek", 52.3, 5.3),
  ];
  const out = dedupeOsm(rows);
  assert.equal(out.length, 2);
  const z = out.find((r) => r.name === "Camping Zonnehoek")!;
  assert.equal(z.osm_type, "way");
  assert.equal(z.osm_id, 20);
  assert.equal(z.phone, "0123");
  assert.deepEqual(z.osm_refs, ["node/10"]);
  assert.equal("osm_refs" in out.find((r) => r.name === "Andere plek")!, false);
});

test("snel genoeg voor heel Nederland", () => {
  const rows = Array.from({ length: 5000 }, (_, i) => row("node", i, `Plek ${i}`, 50.8 + (i % 100) * 0.028, 3.4 + Math.floor(i / 100) * 0.07));
  const t = performance.now();
  assert.equal(dedupeOsm(rows).length, 5000);
  assert.ok(performance.now() - t < 1000);
});
