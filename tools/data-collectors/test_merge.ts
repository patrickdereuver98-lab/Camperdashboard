// Merge-engine lokaal draaien op JSON-lijsten in de standaardvorm, zonder database.
//
//   deno run --allow-read tools/data-collectors/test_merge.ts data/mapped_api_data.json [meer lijsten …]
//
// Lijsten in volgorde van voorrang. Het script voegt samen, controleert elk master-record tegen de regels van de tabel
// geo_master (migratie 20261030120000_geo_master.sql) en stuurt alles door upsertMaster met een nep-client, zodat je
// precies ziet wat er per stuk van 500 naar Supabase zou gaan. Exitcode 1 bij een fout.

import { CHUNK_SIZE, mergeLists, upsertMaster, type MasterDb, type MasterRecord } from "../../web/supabase/functions/pipeline/merge_master.ts";

const paths = Deno.args;
if (!paths.length) {
  console.error("Gebruik: deno run --allow-read test_merge.ts <lijst.json> [meer lijsten …]");
  Deno.exit(2);
}
const lists = await Promise.all(paths.map(async (p) => JSON.parse(await Deno.readTextFile(p)) as unknown[]));
const { records, skipped } = mergeLists(lists);

/** Zelfde regels als de CHECKs en NOT NULLs van geo_master */
function problems(r: MasterRecord): string[] {
  const out: string[] = [];
  if (typeof r.master_id !== "string" || !r.master_id) out.push("master_id leeg");
  if (!/^[0-9b-hjkmnp-z]{1,12}$/.test(r.geohash)) out.push(`geohash ongeldig: ${r.geohash}`);
  if (typeof r.lat !== "number" || !Number.isFinite(r.lat) || Math.abs(r.lat) > 90) out.push(`lat ongeldig: ${r.lat}`);
  if (typeof r.lon !== "number" || !Number.isFinite(r.lon) || Math.abs(r.lon) > 180) out.push(`lon ongeldig: ${r.lon}`);
  if (r.naam !== null && typeof r.naam !== "string") out.push("naam geen tekst of null");
  if (!Array.isArray(r.namen) || r.namen.some((n) => typeof n !== "string")) out.push("namen geen lijst met tekst");
  if (!Array.isArray(r.bron_ids) || !r.bron_ids.length || r.bron_ids.some((b) => typeof b !== "string")) out.push("bron_ids leeg");
  for (const k of ["faciliteiten", "conflicten"] as const) {
    if (!r[k] || typeof r[k] !== "object" || Array.isArray(r[k])) out.push(`${k} geen object`);
  }
  if (!(r.match_score >= 0 && r.match_score <= 1)) out.push(`match_score buiten 0–1: ${r.match_score}`);
  return out;
}

let errors = 0;
const ids = new Set<string>();
for (const r of records) {
  const p = problems(r);
  if (ids.has(r.master_id)) p.push("master_id dubbel");
  ids.add(r.master_id);
  if (p.length) {
    errors++;
    console.error(`FOUT ${r.master_id}: ${p.join("; ")}`);
  }
}

// Upsert met een nep-client: laat zien wat er naar de database zou gaan
const sent: object[][] = [];
const ok = () => Promise.resolve({ data: null, error: null });
const fakeDb: MasterDb = {
  from: () => ({
    select: () => ({ overlaps: () => Promise.resolve({ data: [], error: null }) }),
    upsert: (rows) => (sent.push(rows), ok()),
    delete: () => ({ in: () => ok() }),
  }),
};
const report = await upsertMaster(fakeDb, records);

const sources = lists.reduce((n, l) => n + l.length, 0);
console.log(JSON.stringify(records, null, 2));
console.log(`\n${sources} records in ${lists.length} lijst(en), ${skipped} ongeldig → ${records.length} masters, ` +
  `${records.filter((r) => r.bron_ids.length > 1).length} samengevoegd, ` +
  `${records.filter((r) => Object.keys(r.conflicten).length).length} met conflicten`);
console.log(`upsert: ${report.chunks} stuk(ken) van max. ${CHUNK_SIZE} (${sent.map((c) => c.length).join(", ") || "geen"}), ` +
  `kolommen: ${sent[0] ? Object.keys(sent[0][0]).join(", ") : "-"}`);
if (errors || report.failed.length) {
  console.error(`${errors} ongeldige records`);
  Deno.exit(1);
}
console.log("GESLAAGD: klaar voor upsert");
