import { bearer } from "@/lib/dependency-log";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { GEMINI_DEFAULT_MODEL, geminiJson } from "@/lib/gemini";
import { CHANNELS, CONTENT_SCHEMA, PILLARS, SYSTEM, checkContent, contentPrompt, parseVariants } from "@/lib/marketing/content";
import type { Channel, Pillar } from "@/lib/marketing/db-types";
import { parseFacts } from "@/lib/marketing/facts";
import { SEO_SCHEMA, parseSeoAdvice, seoPrompt } from "@/lib/marketing/seo-advice";
import { rateLimited } from "@/lib/rate-limit";

/**
 * POST /api/admin/marketing/write: teksten voor het marketingdashboard door Gemini (gedeelde helper lib/gemini.ts).
 *   { mode: "content", pillar, channel, note? }  → 3 varianten, elk met de controle uit lib/marketing/content.ts
 *   { mode: "seo", query, page, position }       → voorstel voor titel en omschrijving bij een kans
 * Alleen voor beheerders: het sessietoken gaat mee en de database beslist (marketing_facts weigert niet-admins).
 * Naar Gemini gaan alleen de publieke feiten en de wens van de beheerder; niets wordt opgeslagen.
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 20);
  if (limited) return limited;
  const token = bearer(request.headers);
  if (!token) return Response.json({ error: "Log in als beheerder" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "GEMINI_API_KEY ontbreekt op de server" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Ongeldige aanvraag" }, { status: 400 });

  // De feitenbank is alleen voor admins: dit is meteen de rolcontrole
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/marketing_facts`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return Response.json({ error: res?.status === 404 ? "De migratie van het marketingdashboard staat nog niet live" : "Alleen voor beheerders" }, { status: res?.status === 404 ? 503 : 403 });
  const facts = parseFacts(await res.json().catch(() => null));
  if (!facts) return Response.json({ error: "Feitenbank niet leesbaar" }, { status: 502 });
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;

  try {
    if (body.mode === "seo") {
      const query = typeof body.query === "string" ? body.query.slice(0, 200) : "";
      const page = typeof body.page === "string" ? body.page.slice(0, 500) : "";
      const position = typeof body.position === "number" ? body.position : 0;
      if (!query || !page) return Response.json({ error: "Zoekvraag en pagina ontbreken" }, { status: 400 });
      const raw = await geminiJson(key, model, seoPrompt(query, page, position, facts), { schema: SEO_SCHEMA, system: SYSTEM, maxOutputTokens: 600, temperature: 0.3 });
      const advice = parseSeoAdvice(raw);
      if (!advice) return Response.json({ error: "Gemini gaf geen bruikbaar antwoord, probeer het opnieuw" }, { status: 502 });
      return Response.json({ ...advice, model });
    }

    const pillar = body.pillar as Pillar;
    const channel = body.channel as Channel;
    if (!(pillar in PILLARS) || !(channel in CHANNELS)) return Response.json({ error: "Kies een onderwerp en een kanaal" }, { status: 400 });
    const note = typeof body.note === "string" ? body.note : "";
    const raw = await geminiJson(key, model, contentPrompt(pillar, channel, facts, note), { schema: CONTENT_SCHEMA, system: SYSTEM, maxOutputTokens: 3000, temperature: 0.6 });
    const variants = parseVariants(raw);
    if (!variants) return Response.json({ error: "Gemini gaf geen bruikbaar antwoord, probeer het opnieuw" }, { status: 502 });
    return Response.json({ variants: variants.map((v) => ({ ...v, issues: checkContent(v, channel, facts) })), facts, model });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI niet bereikbaar" }, { status: 502 });
  }
}
