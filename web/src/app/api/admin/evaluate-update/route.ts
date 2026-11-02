import { bearer } from "@/lib/dependency-log";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { rateLimited } from "@/lib/rate-limit";
import { GEMINI_DEFAULT_MODEL, askGemini, triageText } from "@/lib/update-triage";

type Row = {
  id: string;
  place_id: string;
  field_changed: string;
  old_value: unknown;
  new_value: unknown;
  status: string;
  places: { name: string } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/evaluate-update { id }: één update uit de Triage Inbox laten beoordelen door Gemini.
 * De beheerder stuurt zijn eigen sessietoken mee (Authorization: Bearer). Alle lees- en schrijfacties gaan met dat
 * token, dus RLS (role = 'admin') beslist; deze route heeft geen service-role-sleutel. GEMINI_API_KEY staat alleen
 * op de server (Vercel).
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 30);
  if (limited) return limited;
  const token = bearer(request.headers);
  if (!token) return Response.json({ error: "Log in als beheerder" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ error: "GEMINI_API_KEY ontbreekt op de server" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
  if (!id) return Response.json({ error: "Geef een geldig id" }, { status: 400 });

  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const rest = (path: string, init?: RequestInit) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });

  const res = await rest(`updates_queue?id=eq.${id}&select=id,place_id,field_changed,old_value,new_value,status,places(name)`);
  if (!res.ok) return Response.json({ error: "Geen toegang" }, { status: res.status === 401 ? 401 : 403 });
  const [row] = (await res.json()) as Row[];
  // RLS geeft een lege lijst aan wie geen admin is: zelfde antwoord als bij een onbekend id
  if (!row) return Response.json({ error: "Niet gevonden of geen toegang" }, { status: 404 });

  const hist = await rest(
    `updates_queue?place_id=eq.${row.place_id}&id=neq.${row.id}&status=neq.pending&select=field_changed,new_value,status&order=created_at.desc&limit=8`,
  );
  const history = hist.ok
    ? ((await hist.json()) as { field_changed: string; new_value: unknown; status: string }[]).map((h) => ({
        field: h.field_changed,
        newValue: h.new_value,
        status: h.status,
      }))
    : [];

  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  let verdict: { score: number; advice: string };
  try {
    verdict = await askGemini(
      key,
      model,
      triageText({ field: row.field_changed, oldValue: row.old_value, newValue: row.new_value, placeName: row.places?.name, history }),
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "AI niet bereikbaar" }, { status: 502 });
  }

  const save = await rest(`updates_queue?id=eq.${row.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ai_score: verdict.score, ai_advice: verdict.advice, ai_model: model, ai_checked_at: new Date().toISOString() }),
  });
  if (!save.ok) return Response.json({ error: "Opslaan van het advies lukte niet" }, { status: 502 });
  return Response.json({ id: row.id, ...verdict, model });
}
