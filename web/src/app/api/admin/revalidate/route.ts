import { revalidateTag } from "next/cache";
import { bearer } from "@/lib/dependency-log";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { CACHE_TAGS } from "@/lib/places";
import { rateLimited } from "@/lib/rate-limit";

/**
 * POST /api/admin/revalidate: na een wijziging in beheer de caches van de publieke site verversen (R36). De
 * beheerder stuurt zijn eigen sessietoken mee (Authorization: Bearer); de database beslist met is_admin of dat mag.
 * Stale-while-revalidate ("max"): de eerstvolgende bezoeker krijgt nog de oude versie terwijl de nieuwe wordt
 * opgehaald, daarna iedereen de nieuwe. Zonder deze aanroep zijn wijzigingen er na hooguit vijf minuten.
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 30, "revalidate");
  if (limited) return limited;
  const token = bearer(request.headers);
  if (!token) return Response.json({ error: "Log in als beheerder" }, { status: 401 });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res) return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  if (!res.ok || (await res.json().catch(() => false)) !== true) return Response.json({ error: "Geen toegang" }, { status: 403 });

  for (const tag of CACHE_TAGS) revalidateTag(tag, "max");
  return Response.json({ ok: true, tags: CACHE_TAGS });
}
