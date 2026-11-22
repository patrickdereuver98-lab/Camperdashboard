// Laadt een resultaatbestand van google-ratings.mjs (--out) in de database (README 141).
//   node --no-warnings --import ./tests/register.mjs scripts/google-ingest.mjs resultaat.json        Nodig: SUPABASE_DB_URL (psql) of SUPABASE_ACCESS_TOKEN (sql.sh)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { matchKnown } from "../src/lib/google-rating.ts";
import { forgetSql, foundSql, saveSql } from "./google-sql.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Gebruik: node scripts/google-ingest.mjs resultaat.json");
  process.exit(2);
}
const data = JSON.parse(readFileSync(file, "utf8"));
// Resultaat van google-discover.mjs: plekken die Google kent
const discover = !Array.isArray(data) && data.kind === "discover";
const items = discover ? data.found : data;
const here = dirname(fileURLToPath(import.meta.url));
// De SQL gaat via een bestand: met alle velden van Google past een groep niet meer in één commandoregel (E2BIG)
const dir = mkdtempSync(join(tmpdir(), "google-ingest-"));
const run = (sql) => {
  const f = join(dir, "q.sql");
  writeFileSync(f, sql);
  return process.env.SUPABASE_DB_URL
    ? execFileSync("psql", [process.env.SUPABASE_DB_URL, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-f", f], { encoding: "utf8" })
    : execFileSync(join(here, "sql.sh"), ["-f", f], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
};

// Ontdekken: vergelijk met ALLE eigen plekken, ook concepten en verborgen plekken. De zoekopdracht zelf ziet met de openbare
// sleutel alleen gepubliceerde plekken, en een plek die we wel hebben maar nog niet tonen is geen gat.
if (discover) {
  const raw = run("select coalesce(json_agg(json_build_object('id', id, 'name', name, 'lat', lat, 'lng', lng, 'status', status)), '[]'::json) as p from public.places where merged_into is null;");
  // sql.sh geeft [{"p": [...]}], psql geeft de lijst zelf
  const parsed = JSON.parse(raw.trim());
  const known = (Array.isArray(parsed) && parsed[0] && "p" in parsed[0] ? parsed[0].p : parsed).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  let m = 0;
  for (const f of items) {
    delete f.matched_place_id;
    delete f.matched_m;
    const hit = matchKnown(f, known);
    if (hit) {
      f.matched_place_id = hit.id;
      f.matched_m = hit.meters;
      m++;
    }
  }
  console.log(`${m} van ${items.length} kennen we al (vergeleken met ${known.length} eigen plekken)`);
}

let n = 0;
for (let i = 0; i < items.length; i += 10) {
  const sql = items
    .slice(i, i + 10)
    .map((it) => (discover ? foundSql(it) : it.forget ? forgetSql(it.place_id) : saveSql(it.place_id, it.result, it.checked_at)))
    .join("");
  if (sql) run(sql);
  n += Math.min(10, items.length - i);
}
rmSync(dir, { recursive: true, force: true });
console.log(`${n} resultaten geladen`);
