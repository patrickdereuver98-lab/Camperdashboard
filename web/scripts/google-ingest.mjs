// Laadt een resultaatbestand van google-ratings.mjs (--out) in de database (README 141).
//   node --no-warnings --import ./tests/register.mjs scripts/google-ingest.mjs resultaat.json        Nodig: SUPABASE_DB_URL (psql) of SUPABASE_ACCESS_TOKEN (sql.sh)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
const run = (sql) =>
  process.env.SUPABASE_DB_URL
    ? execFileSync("psql", [process.env.SUPABASE_DB_URL, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8" })
    : execFileSync(join(here, "sql.sh"), [sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

let n = 0;
for (let i = 0; i < items.length; i += 25) {
  const sql = items
    .slice(i, i + 25)
    .map((it) => (discover ? foundSql(it) : it.forget ? forgetSql(it.place_id) : saveSql(it.place_id, it.result, it.checked_at)))
    .join("");
  if (sql) run(sql);
  n += Math.min(25, items.length - i);
}
console.log(`${n} resultaten geladen`);
