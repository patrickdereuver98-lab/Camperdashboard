// Toont hoe de mail aan eigenaren eruitziet, zonder iets te versturen.
//   node --no-warnings --import ./tests/register.mjs scripts/outreach-preview.ts voorbeelden.json [uitvoermap]
// voorbeelden.json: een lijst plekken zoals outreach_next ze teruggeeft (zonder token en adres; die worden ingevuld).
// Met een uitvoermap schrijft hij ook elke mail als .html, om in een browser te bekijken.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { composeOutreach, type OutreachItem } from "../src/lib/outreach.ts";

const [file, outDir] = process.argv.slice(2);
if (!file) {
  console.error("Gebruik: outreach-preview.ts <voorbeelden.json> [uitvoermap]");
  process.exit(1);
}
const rows = JSON.parse(readFileSync(file, "utf8")) as Partial<OutreachItem>[];
if (outDir) mkdirSync(outDir, { recursive: true });

rows.forEach((r, n) => {
  const item = {
    token: "00000000-0000-4000-8000-00000000000" + (n % 10),
    place_id: r.place_id ?? (r as { id?: string }).id ?? "00000000-0000-4000-8000-000000000000",
    email: "eigenaar@voorbeeld.nl",
    checkin_until: null,
    ...r,
  } as OutreachItem;
  const mail = composeOutreach(item, "https://vrijstaan.nl");
  console.log(`\n${"=".repeat(78)}\nVoorbeeld ${n + 1}: ${item.name}\nOnderwerp: ${mail.subject}\n${"-".repeat(78)}\n${mail.text}`);
  if (outDir) writeFileSync(`${outDir}/mail-${n + 1}.html`, `<!doctype html><meta charset="utf-8"><title>${mail.subject}</title>${mail.html}`);
});
