import { timingSafeEqual } from "node:crypto";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { randomUUID } from "node:crypto";
import { type OutreachItem, composeOutreach, runOutreach, sendViaResend } from "@/lib/outreach";

export const maxDuration = 60;

/**
 * POST /api/cron/owner-outreach: verstuurt de volgende mails naar eigenaren (AI Outreach Loop, stap 2).
 * Een rooster (GitHub Actions, .github/workflows/owner-outreach.yml) roept dit elke 20 minuten aan, met
 * `Authorization: Bearer OUTREACH_CRON_KEY`. Wie, hoeveel en wanneer bepaalt de database (outreach_next): staat de
 * campagne uit (standaard), buiten het verzendvenster, of is het dagquotum op, dan komt er een lege lijst terug.
 * Het antwoord bevat alleen aantallen, nooit adressen.
 *
 * Met `?proef=<adres>` gaat er één voorbeeldmail naar dat adres (verzonnen plek, onderwerp met [PROEF]), zonder iets in de
 * database te claimen of vast te leggen. Zo test je Resend, de afzender en de opmaak zonder een echte eigenaar te mailen.
 */
export async function POST(request: Request) {
  const cron = process.env.OUTREACH_CRON_KEY;
  const key = process.env.OUTREACH_KEY;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM;
  const replyTo = process.env.OUTREACH_REPLY_TO;
  if (!cron || !key || !apiKey || !from || !replyTo) return Response.json({ error: "Uitgaande mail niet ingesteld" }, { status: 503 });

  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
  const want = Buffer.from(cron);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return Response.json({ error: "Geen toegang" }, { status: 401 });

  const proef = new URL(request.url).searchParams.get("proef");
  if (proef !== null) {
    if (!/^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/.test(proef) || proef.length > 254) return Response.json({ error: "Geen geldig adres" }, { status: 400 });
    const sample: OutreachItem = {
      token: randomUUID(),
      place_id: randomUUID(),
      name: "Voorbeeldcamping De Linde",
      kind: "camping",
      town: "Voorbeelddorp",
      email: proef,
      departure: null,
      checkout_until: null,
      checkin_from: null,
      checkin_until: null,
      open_all_year: null,
      season: null,
      price_eur: null,
      power: null,
      dump_station: null,
      missing: ["vertrek", "aankomst", "seizoen", "prijs", "stroom", "lozen"],
    };
    const mail = composeOutreach(sample);
    const result = await sendViaResend(apiKey, from, replyTo, { ...mail, subject: `[PROEF] ${mail.subject}` }, `proef-${sample.token}`);
    return Response.json({ proef: true, resultaat: result.kind, ...("error" in result ? { error: result.error } : {}) }, { status: result.kind === "sent" ? 200 : 502 });
  }

  const rpc = async (name: string, args: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: key, ...args }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${name} gaf ${res.status}`);
    return res.status === 204 ? null : ((await res.json().catch(() => null)) as unknown);
  };

  try {
    const summary = await runOutreach({
      next: async (limit) => {
        const r = (await rpc("outreach_next", { p_limit: limit })) as { enabled?: boolean; reason?: string; items?: OutreachItem[] } | null;
        return { enabled: !!r?.enabled, reason: r?.reason, items: Array.isArray(r?.items) ? r.items : [] };
      },
      send: (mail, idempotencyKey) => sendViaResend(apiKey, from, replyTo, mail, idempotencyKey),
      sent: async (token, resendId) => void (await rpc("outreach_sent", { p_token: token, p_resend_id: resendId })),
      failed: async (token, error, permanent, suppress) =>
        void (await rpc("outreach_failed", { p_token: token, p_error: error, p_permanent: permanent, p_suppress: suppress ?? permanent })),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    });
    return Response.json(summary, { status: summary.stopped ? 502 : 200 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Mislukt" }, { status: 502 });
  }
}
