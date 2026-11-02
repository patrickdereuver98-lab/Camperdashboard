import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { isToken } from "@/lib/outreach";
import { rateLimited } from "@/lib/rate-limit";

/**
 * POST /api/afmelden/<token>: afmelden voor mail van VrijStaan.
 * - Zonder `?terug=1`: de "één klik"-afmelding van mailprogramma's (List-Unsubscribe-Post, RFC 8058). Antwoord 200.
 * - Met `?terug=1`: de knop op /afmelden/<token>. Stuurt door naar de bevestigingspagina.
 * GET stuurt door naar de pagina met de knop, zodat een virusscanner die de link opent niemand afmeldt.
 * Het antwoord is altijd hetzelfde, ook bij een onbekend token.
 */
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const limited = rateLimited(request, 30);
  if (limited) return limited;
  const { token } = await ctx.params;
  if (isToken(token)) {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/outreach_unsubscribe`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }).catch(() => null);
  }
  if (new URL(request.url).searchParams.get("terug") === "1") {
    return new Response(null, { status: 303, headers: { Location: "/afmelden/klaar" } });
  }
  return Response.json({ ok: true });
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return new Response(null, { status: 303, headers: { Location: `/afmelden/${isToken(token) ? token : "klaar"}` } });
}
