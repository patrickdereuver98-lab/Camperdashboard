// Analyse na de Google-ronde (README 141), als markdown op stdout, in de workflow naar de samenvatting.
//   node scripts/google-analyse.mjs        Nodig: SUPABASE_DB_URL (psql)
import { execFileSync } from "node:child_process";
import { QUERIES } from "./google-analyse-queries.mjs";

const db = process.env.SUPABASE_DB_URL;
if (!db) {
  console.error("SUPABASE_DB_URL is nodig.");
  process.exit(2);
}

function csv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const esc = (v) => String(v ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
console.log(`# Google-analyse (${new Date().toISOString().slice(0, 10)})\n`);
for (const { title, sql } of QUERIES) {
  console.log(`## ${title}\n`);
  try {
    const out = execFileSync("psql", [db, "-X", "--csv", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    const rows = csv(out.trim());
    if (rows.length < 2) { console.log("_Geen gegevens._\n"); continue; }
    console.log(`| ${rows[0].map(esc).join(" | ")} |\n|${rows[0].map(() => "---").join("|")}|`);
    for (const r of rows.slice(1)) console.log(`| ${r.map(esc).join(" | ")} |`);
    console.log("");
  } catch (e) {
    console.log(`_Query mislukt: ${String(e.message).split("\n")[0]}_\n`);
  }
}
