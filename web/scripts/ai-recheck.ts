// Herbeoordeling van opgeslagen AI-lezingen met de huidige controle (pipeline/ai.ts), zonder Gemini opnieuw aan te
// roepen. Voor plekken zonder vertrekregel: wat de controle nu wel goedkeurt, gaat via public.apply_ai_reading als
// voorstel naar de Triage Inbox (beheer beslist; dubbele en eerder afgewezen voorstellen slaat die functie over).
//
//   SUPABASE_ACCESS_TOKEN=… node --import ./tests/register.mjs scripts/ai-recheck.ts          (proef, schrijft niets)
//   SUPABASE_ACCESS_TOKEN=… node --import ./tests/register.mjs scripts/ai-recheck.ts --write  (schrijft voorstellen)
//
// Ronde 26 november 2026: de controle herkende "geen aankomst- of vertrektijden" niet als vrij vertrek en wees
// kampeertijden af als de zin ook chalets noemde.
import { AI_VERSION, cleanText, verifyAnswer, type AiAnswer } from "../supabase/functions/pipeline/ai.ts";

const PROJECT = "qkrmthrhwmmmwswmfgwc";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ontbreekt");
const write = process.argv.includes("--write");

async function sql<T>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

/** Dollar-quoting met een eigen tag, zodat citaten met aanhalingstekens veilig zijn */
const lit = (s: string) => {
  const tag = "$r" + Math.random().toString(36).slice(2, 8) + "$";
  return `${tag}${s}${tag}`;
};

type Row = { place_id: string; name: string; hash: string; ai_model: string | null; text: string; ai_result: { antwoord?: AiAnswer } };

const rows = await sql<Row>(`
  select t.place_id, p.name, t.ai_hash as hash, t.ai_model, t.text, t.ai_result
    from private.page_texts t join public.places p on p.id = t.place_id
   where p.status = 'published' and p.departure is null and t.ai_result ? 'antwoord' and t.ai_hash is not null`);

let found = 0;
let written = 0;
for (const r of rows) {
  const answer = r.ai_result.antwoord ?? {};
  const verdict = verifyAnswer(answer, cleanText(r.text));
  const proposals = verdict.proposals.filter((p) => p.field === "departure" || p.field === "checkout_until");
  if (!proposals.length) continue;
  found++;
  const dep = proposals.find((p) => p.field === "departure");
  const out = proposals.find((p) => p.field === "checkout_until");
  console.log(`${r.name}: ${dep?.value}${out ? ` ${out.value}` : ""}${dep?.confirmed ? " (extractor bevestigt)" : ""}\n   "${String(dep?.quote ?? "").slice(0, 140)}"`);
  if (!write) continue;
  const result = { versie: AI_VERSION, antwoord: answer, afgewezen: verdict.rejected, herbeoordeeld: "2026-11-26" };
  const [res] = await sql<{ r: { proposals?: number } }>(
    `select public.apply_ai_reading('${r.place_id}'::uuid, ${lit(r.hash)}, ${lit(r.ai_model ?? "gemini-2.5-flash")}, ${lit(JSON.stringify(result))}::jsonb, ${lit(JSON.stringify(proposals))}::jsonb, null, null) as r`,
  );
  written += res?.r?.proposals ?? 0;
}
console.log(`\n${rows.length} lezingen bekeken, ${found} plekken met een vertrekregel die nu door de controle komt${write ? `, ${written} voorstellen geschreven` : " (proef, niets geschreven)"}`);
