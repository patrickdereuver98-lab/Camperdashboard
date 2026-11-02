import { bearer } from "@/lib/dependency-log";
import { SITE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { GEMINI_DEFAULT_MODEL, geminiJson } from "@/lib/gemini";
import { MARKETING_SCHEMA, marketingText, ogImagePath, parseMarketing } from "@/lib/marketing";
import { getPlace } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";

const SLUG = /^[a-z0-9-]{1,120}$/;

/**
 * POST /api/admin/generate-marketing { slug }: 2 Facebook-posts en 2 Google Ads-teksten voor een plek, door Gemini
 * (gedeelde helper lib/gemini.ts). Alleen voor beheerders: het sessietoken gaat mee (Authorization: Bearer) en de
 * database (has_admin_role) beslist. Naar het model gaan alleen openbare, bekende feiten van de plek
 * (marketingFacts); niets wordt opgeslagen.
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 20);
  if (limited) return limited;
  const token = bearer(request.headers);
  if (!token) return Response.json({ error: "Log in als beheerder" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "GEMINI_API_KEY ontbreekt op de server" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null;
  const slug = typeof body?.slug === "string" && SLUG.test(body.slug) ? body.slug : null;
  if (!slug) return Response.json({ error: "Kies een plek" }, { status: 400 });

  const role = await fetch(`${SUPABASE_URL}/rest/v1/rpc/has_admin_role`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!role?.ok || (await role.json().catch(() => false)) !== true) return Response.json({ error: "Alleen voor beheerders" }, { status: 403 });

  const place = await getPlace(slug);
  if (!place) return Response.json({ error: "Plek niet gevonden" }, { status: 404 });

  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  let raw: string;
  try {
    raw = await geminiJson(key, model, marketingText(place, `${SITE_URL}/plek/${place.slug}`), { schema: MARKETING_SCHEMA, maxOutputTokens: 2000, temperature: 0.4 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI niet bereikbaar" }, { status: 502 });
  }
  const copy = parseMarketing(raw);
  if (!copy) return Response.json({ error: "Gemini gaf geen bruikbaar antwoord, probeer het opnieuw" }, { status: 502 });
  return Response.json({ ...copy, model, slug: place.slug, name: place.name, ogImage: ogImagePath(place.slug) });
}
