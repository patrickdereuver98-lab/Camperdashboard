// Test de migratie bronnen_en_claims in PGlite (Postgres in WebAssembly), zonder de live database te raken.
//   cd web && npm i --no-save @electric-sql/pglite && node supabase/tests/bronnen/run.mjs
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";

const here = new URL(".", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, here), "utf8");
const db = await PGlite.create({ extensions: { pg_trgm, unaccent, pgcrypto } });
await db.exec(read("stub.sql"));
await db.exec(read("../../migrations/20261018233000_bronnen_en_claims.sql"));
try {
  await db.exec(read("cases.sql"));
  const { rows } = await db.query("select count(*)::int as n from pg_temp.result");
  console.log(`bronnen: ${rows[0].n} controles geslaagd`);
} catch (e) {
  console.error("bronnen: MISLUKT —", e.message);
  process.exit(1);
}
