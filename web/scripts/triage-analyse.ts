// Analyse van de open voorstellen van de AI-lezer in de Triage Inbox: komt elk voorstel nog door de huidige controle
// (pipeline/ai.ts), met dezelfde opgeslagen tekst en hetzelfde antwoord van het model? Schrijft niets; zet de uitkomst
// in een JSON-bestand voor de besluitronde (26 november 2026, op verzoek van Patrick).
//
//   SUPABASE_ACCESS_TOKEN=… node --import ./tests/register.mjs scripts/triage-analyse.ts <uit.json>
import { writeFileSync } from "node:fs";
import { cleanText, verifyAnswer, type AiAnswer } from "../supabase/functions/pipeline/ai.ts";

const PROJECT = "qkrmthrhwmmmwswmfgwc";
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ontbreekt");
const out = process.argv[2] ?? "triage-analyse.json";

async function sql<T>(query: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T[];
}

type Q = { id: string; place_id: string; name: string; field: string; old: unknown; new: unknown; quote: string | null; text: string | null; antwoord: AiAnswer | null };
const rows = await sql<Q>(`
  select u.id, u.place_id, p.name, u.field_changed as field, u.old_value as old, u.new_value as new, u.quote,
         t.text, t.ai_result -> 'antwoord' as antwoord
    from public.updates_queue u
    join public.places p on p.id = u.place_id
    left join private.page_texts t on t.place_id = u.place_id
   where u.status = 'pending' and u.source = 'ai-lezer'`);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) || Number(a) === Number(b);
const result = rows.map((r) => {
  if (!r.text || !r.antwoord) return { ...r, text: undefined, antwoord: undefined, verdict: "geen-lezing" };
  const v = verifyAnswer(r.antwoord, cleanText(r.text));
  const still = v.proposals.find((p) => p.field === r.field && same(p.value, r.new));
  const why = v.rejected.filter((x) => x.startsWith(fieldKey(r.field)));
  return { id: r.id, place_id: r.place_id, name: r.name, field: r.field, old: r.old, new: r.new, quote: r.quote, verdict: still ? "geldig" : "afgewezen", why };
});

function fieldKey(f: string): string {
  return ({ departure: "vertrek", checkout_until: "vertrek", price_eur: "prijs", checkin_from: "checkin_from", checkin_until: "checkin_until", max_length_m: "lengte", max_stay_nights: "nachten", website: "website" } as Record<string, string>)[f] ?? f;
}

writeFileSync(out, JSON.stringify(result, null, 1));
const tally: Record<string, Record<string, number>> = {};
for (const r of result) (tally[r.field] ??= {})[r.verdict] = ((tally[r.field] ??= {})[r.verdict] ?? 0) + 1;
console.log(JSON.stringify(tally, null, 1));
