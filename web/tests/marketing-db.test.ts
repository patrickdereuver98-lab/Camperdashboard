// TS-07: de marketing-scripts geven SQL via stdin aan psql, niet als argument. Een groot JSON-blok als argument
// gaf E2BIG (argv is begrensd). Getest met een nep-psql die zijn argumenten en stdin terugschrijft.
import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { json, PSQL_ARGS, sql } from "../scripts/marketing/db";

let dir = "";
const saved = { PATH: process.env.PATH, SUPABASE_DB_URL: process.env.SUPABASE_DB_URL };

before(() => {
  dir = mkdtempSync(join(tmpdir(), "nep-psql-"));
  writeFileSync(
    join(dir, "psql"),
    `#!/bin/sh\nprintf '%s\\n' "$@" > "${dir}/args"\ncat > "${dir}/stdin"\necho "  42  "\n`,
  );
  chmodSync(join(dir, "psql"), 0o755);
  process.env.PATH = `${dir}:${saved.PATH}`;
  process.env.SUPABASE_DB_URL = "postgres://nep@localhost/db";
});

after(() => {
  process.env.PATH = saved.PATH;
  if (saved.SUPABASE_DB_URL === undefined) delete process.env.SUPABASE_DB_URL;
  else process.env.SUPABASE_DB_URL = saved.SUPABASE_DB_URL;
  rmSync(dir, { recursive: true, force: true });
});

test("sql() stuurt de opdracht via stdin en niet als argument", () => {
  const out = sql("select 42");
  assert.equal(out, "42");
  const args = readFileSync(join(dir, "args"), "utf8").trim().split("\n");
  assert.deepEqual(args, ["postgres://nep@localhost/db", ...PSQL_ARGS]);
  assert.ok(!args.includes("-c"));
  assert.equal(readFileSync(join(dir, "stdin"), "utf8"), "select 42;\n");
});

test("sql() werkt ook met een JSON-blok van ruim 1 MB (te groot voor argv)", () => {
  const rows = Array.from({ length: 20000 }, (_, i) => ({ query: `camperplaats ${i} ${"x".repeat(40)}`, clicks: i }));
  const statement = `insert into public.seo_daily select * from jsonb_to_recordset(${json(rows)}) as r(query text, clicks int);`;
  assert.ok(statement.length > 1024 * 1024);
  assert.equal(sql(statement), "42");
  assert.equal(readFileSync(join(dir, "stdin"), "utf8"), `${statement}\n`);
});
