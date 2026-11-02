import { bearer, parseDependencyUpdate } from "@/lib/dependency-log";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";

const MAX_BYTES = 8_000;

/**
 * POST /api/admin/log-dependency: de dependency-radar (GitHub Actions) meldt hier een Dependabot-update met het
 * AI-advies. Beveiligd met een geheim (`Authorization: Bearer <DEPENDENCY_LOG_KEY>`). De route kent het geheim zelf
 * niet en heeft geen service-role-sleutel: de database vergelijkt het met internal_secrets.dependency_log_key
 * (public.log_dependency) en weigert alles zonder die sleutel.
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 60);
  if (limited) return limited;

  const key = bearer(request.headers);
  if (!key) return Response.json({ error: "Geen sleutel" }, { status: 401 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "Te groot" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Geen geldige JSON" }, { status: 400 });
  }
  const update = parseDependencyUpdate(body);
  if ("error" in update) return Response.json({ error: update.error }, { status: 400 });

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_dependency`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: key, p_update: update }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  if (res.ok) return Response.json(await res.json(), { status: 200 });
  // 42501 uit de database = verkeerde of ontbrekende sleutel; de rest niet doorgeven (geen interne details)
  const err = (await res.json().catch(() => ({}))) as { code?: string };
  if (err.code === "42501") return Response.json({ error: "Geen toegang" }, { status: 403 });
  return Response.json({ error: "Opslaan lukte niet" }, { status: 502 });
}
