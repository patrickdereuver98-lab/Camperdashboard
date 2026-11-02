import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { GEMINI_DEFAULT_MODEL } from "@/lib/gemini";
import {
  type Inbound,
  type OwnerReply,
  askOwnerReply,
  cleanBody,
  isAutomatedSender,
  looksLikeOptOut,
  parseInbound,
  placeIdFromSubject,
  verifyResendSignature,
} from "@/lib/owner-inbox";
import { parseResendEvent } from "@/lib/outreach";
import { rateLimited } from "@/lib/rate-limit";

const MAX_BYTES = 512_000;

/**
 * POST /api/webhooks/inbound-email: Resend Inbound (event `email.received`) meldt hier een antwoord van een eigenaar.
 *
 * Dezelfde webhook krijgt ook de gebeurtenissen van onze uitgaande mail (email.delivered, email.bounced en
 * email.complained; zet ze aan in Resend). Die gaan naar public.outreach_event: een harde bounce of spamklacht zet het
 * adres op de afmeldlijst, en een klacht zet de hele campagne uit.
 *
 * 1. Handtekening van Resend controleren (RESEND_WEBHOOK_SECRET, "whsec_…"). Zonder geldige handtekening: 401.
 * 2. Tekst van de mail ophalen (staat niet altijd in de webhook; dan via de Resend-API met RESEND_API_KEY).
 * 3. Gemini bepaalt intent, prijs en vertrektijd (GEMINI_API_KEY). Alleen onderwerp en tekst gaan naar Google.
 * 4. public.log_owner_reply zoekt de plek (id in het onderwerp, anders het e-mailadres), zet wijzigingen in de Triage
 *    Inbox en zet bij een bevestiging vanaf het bekende adres places.verified_at. De route heeft geen
 *    service-role-sleutel: de database controleert OWNER_INBOX_KEY tegen internal_secrets.owner_inbox_key.
 *
 * Een 5xx laat Resend het later opnieuw proberen; dezelfde mail twee keer verwerken kan niet (uniek email_id).
 */
export async function POST(request: Request) {
  const limited = rateLimited(request, 60);
  if (limited) return limited;

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const inboxKey = process.env.OWNER_INBOX_KEY;
  if (!secret || !inboxKey) return Response.json({ error: "Inbox niet ingesteld" }, { status: 503 });

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "Te groot" }, { status: 413 });
  if (!verifyResendSignature(secret, request.headers, raw)) {
    return Response.json({ error: "Ongeldige handtekening" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Geen geldige JSON" }, { status: 400 });
  }
  const event = parseResendEvent(payload);
  if (event) {
    const outreachKey = process.env.OUTREACH_KEY;
    if (!outreachKey) return Response.json({ ignored: true }, { status: 200 });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/outreach_event`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: outreachKey, p_resend_id: event.emailId, p_type: event.type }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    }).catch(() => null);
    // Een 5xx laat Resend opnieuw proberen; een klacht of bounce mag niet verloren gaan
    return r?.ok ? Response.json({ ok: true }, { status: 200 }) : Response.json({ error: "Opslaan lukte niet" }, { status: 502 });
  }
  // Andere events (bv. email.sent) of een mail zonder afzender: aannemen en niets doen, anders blijft Resend proberen
  const inbound = parseInbound(payload);
  if (!inbound) return Response.json({ ignored: true }, { status: 200 });
  // Bounces, afwezigheidsmeldingen en noreply-adressen: een systeem, geen eigenaar
  if (isAutomatedSender(inbound.from, inbound.subject)) return Response.json({ ignored: true }, { status: 200 });

  const content = inbound.text || inbound.html ? inbound : await fetchContent(inbound);
  if (!content) return Response.json({ error: "Inhoud van de mail niet op te halen" }, { status: 502 });
  const body = cleanBody(content);

  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  let reply: OwnerReply = { intent: "unknown", price: null, departure_time: null, checkin_from: null, departure_rule: null, summary: "Lege mail" };
  let usedAi = false;
  if (body && looksLikeOptOut(body)) {
    // Afmelden hangt nooit van een AI-antwoord af
    reply = { ...reply, intent: "unsubscribe", summary: "Wil geen mail meer." };
  } else if (body) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "GEMINI_API_KEY ontbreekt op de server" }, { status: 503 });
    try {
      reply = await askOwnerReply(key, model, inbound.subject, body);
      usedAi = true;
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "AI niet bereikbaar" }, { status: 502 });
    }
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_owner_reply`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_secret: inboxKey,
      p_reply: {
        email_id: inbound.emailId,
        from: inbound.from,
        subject: inbound.subject,
        place_id: placeIdFromSubject(inbound.subject),
        ...reply,
        ai_model: usedAi ? model : null,
      },
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);

  if (!res) return Response.json({ error: "Database niet bereikbaar" }, { status: 502 });
  if (res.ok) return Response.json(await res.json(), { status: 200 });
  const err = (await res.json().catch(() => ({}))) as { code?: string };
  // 42501 = verkeerde OWNER_INBOX_KEY; 22023 = onbruikbare mail (opnieuw proberen helpt niet)
  if (err.code === "42501") return Response.json({ error: "Geen toegang tot de database" }, { status: 500 });
  if (err.code === "22023") return Response.json({ ignored: true }, { status: 200 });
  return Response.json({ error: "Opslaan lukte niet" }, { status: 502 });
}

/** Resend stuurt bij Inbound alleen de kop mee; tekst en html staan achter GET /emails/receiving/{id} */
async function fetchContent(i: Inbound): Promise<Pick<Inbound, "text" | "html"> | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(i.emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return null;
  const d = (await res.json().catch(() => null)) as { text?: unknown; html?: unknown } | null;
  if (!d) return null;
  return {
    text: typeof d.text === "string" && d.text.trim() ? d.text : null,
    html: typeof d.html === "string" && d.html.trim() ? d.html : null,
  };
}
