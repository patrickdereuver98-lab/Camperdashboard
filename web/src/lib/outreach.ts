import { SITE_URL } from "./env";

/**
 * AI Outreach Loop, stap 2: automatisch een korte mail naar eigenaren met een bekend e-mailadres, via Resend.
 * De regels (wie, hoeveel, wanneer, afmelden, noodrem) staan in de database (migratie 20261102200000_outreach.sql);
 * hier staat de mailtekst, de verzending en de lus eromheen. De route heeft geen service-role-sleutel.
 */

export type OutreachItem = {
  token: string;
  place_id: string;
  name: string;
  kind: string | null;
  town: string | null;
  email: string;
  departure: "vast" | "vrij" | "per24" | null;
  checkout_until: string | null;
  checkin_from: string | null;
  checkin_until: string | null;
};

export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Naam van de plek voor in een onderwerp of tekst: één regel, geen stuurtekens, hoogstens 80 tekens */
export function cleanName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "jullie plek";
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Wat we nu van de aankomst weten, in woorden */
export function arrivalLine(i: Pick<OutreachItem, "checkin_from" | "checkin_until">): string {
  const from = i.checkin_from && TIME.test(i.checkin_from) ? i.checkin_from : null;
  const until = i.checkin_until && TIME.test(i.checkin_until) ? i.checkin_until : null;
  if (from && until) return `tussen ${from} en ${until}`;
  if (from) return `vanaf ${from}`;
  if (until) return `uiterlijk ${until}`;
  return "onbekend";
}

/** Wat we nu van het vertrek weten, in woorden. Nooit een tijd tonen die we niet hebben. */
export function departureLine(i: Pick<OutreachItem, "departure" | "checkout_until">): string {
  if (i.departure === "vast" && i.checkout_until && TIME.test(i.checkout_until)) return `uiterlijk ${i.checkout_until}`;
  if (i.departure === "vrij") return "vrij, geen vaste tijd";
  if (i.departure === "per24") return "per 24 uur";
  return "onbekend";
}

export function outreachUrls(token: string, base = process.env.OUTREACH_BASE_URL || SITE_URL) {
  const root = base.replace(/\/+$/, "");
  return { unsubscribe: `${root}/api/afmelden/${token}`, page: `${root}/afmelden/${token}`, privacy: `${root}/privacy` };
}

/** De mail. Je-vorm, korte zinnen, geen verkooppraat (stijlgids). Afzender is VrijStaan, zonder persoonsnaam. */
export function composeOutreach(i: OutreachItem, base?: string): Mail {
  if (!UUID.test(i.token) || !UUID.test(i.place_id)) throw new Error("Ongeldig token of plek-id");
  const name = cleanName(i.name);
  const url = outreachUrls(i.token, base);
  const arrival = arrivalLine(i);
  const departure = departureLine(i);

  const text = [
    "Hallo,",
    "",
    `Wij maken VrijStaan, een gratis gids voor camperaars. ${name} staat erin, op basis van gegevens die openbaar zijn. Camperaars willen vooral weten hoe laat ze mogen komen en hoe laat ze weg moeten.`,
    "",
    "Dit weten we nu:",
    `Aankomst: ${arrival}`,
    `Vertrek: ${departure}`,
    "",
    'Klopt dit? Antwoord met één zin op deze mail, bijvoorbeeld: "Aankomst vanaf 14:00, vertrek uiterlijk 11:00." Is het anders, zet dan de juiste tijden erbij. Wisselen de tijden per seizoen of per dag, dan mag je dat erbij zetten.',
    "",
    "Alvast bedankt.",
    "VrijStaan",
    "",
    "--",
    `Je krijgt deze mail één keer, omdat dit e-mailadres openbaar bij ${name} staat. Wat we met gegevens doen, lees je op ${url.privacy}.`,
    `Geen mail meer van ons? Meld je af: ${url.page}`,
  ].join("\n");

  const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.55;color:#1f2a24;max-width:560px">` +
    p("Hallo,") +
    p(
      `Wij maken VrijStaan, een gratis gids voor camperaars. ${esc(name)} staat erin, op basis van gegevens die openbaar zijn. Camperaars willen vooral weten hoe laat ze mogen komen en hoe laat ze weg moeten.`,
    ) +
    p(`Dit weten we nu:<br>Aankomst: <strong>${esc(arrival)}</strong><br>Vertrek: <strong>${esc(departure)}</strong>`) +
    p(
      "Klopt dit? Antwoord met één zin op deze mail, bijvoorbeeld: &ldquo;Aankomst vanaf 14:00, vertrek uiterlijk 11:00.&rdquo; Is het anders, zet dan de juiste tijden erbij. Wisselen de tijden per seizoen of per dag, dan mag je dat erbij zetten.",
    ) +
    p("Alvast bedankt.<br>VrijStaan") +
    `<p style="margin:24px 0 0;font-size:14px;color:#5b6b61">Je krijgt deze mail één keer, omdat dit e-mailadres openbaar bij ${esc(name)} staat. ` +
    `Wat we met gegevens doen, lees je in de <a href="${esc(url.privacy)}">privacyverklaring</a>. ` +
    `Geen mail meer van ons? <a href="${esc(url.page)}">Meld je af</a>.</p></div>`;

  return {
    to: i.email.trim(),
    // [VS-<id>] in het onderwerp: zo koppelt de inbox een antwoord aan de plek (placeIdFromSubject)
    subject: `Klopt dit nog? Aankomst en vertrek bij ${name} [VS-${i.place_id.toLowerCase()}]`,
    text,
    html,
    headers: {
      "List-Unsubscribe": `<${url.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

// ── Verzenden via Resend ───────────────────────────────────────────────────────────────────────────────────────
export type SendResult =
  | { kind: "sent"; id: string }
  /** Resend wees het adres af: nooit meer proberen */
  | { kind: "permanent"; error: string }
  /** Tijdelijk (limiet, storing): de plek komt na 30 minuten opnieuw, met dezelfde Idempotency-Key */
  | { kind: "transient"; error: string }
  /** Onze instelling klopt niet (sleutel, domein): de hele ronde stopt, het adres is niet de schuld */
  | { kind: "config"; error: string };

export async function sendViaResend(
  apiKey: string,
  from: string,
  replyTo: string,
  mail: Mail,
  idempotencyKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({
        from,
        to: [mail.to],
        reply_to: replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        headers: mail.headers,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    return { kind: "transient", error: "Resend niet bereikbaar" };
  }
  const body = (await res.json().catch(() => ({}))) as { id?: unknown; name?: unknown; message?: unknown };
  if (res.ok && typeof body.id === "string") return { kind: "sent", id: body.id };
  const error = `Resend ${res.status}: ${typeof body.message === "string" ? body.message : "geen uitleg"}`.slice(0, 280);
  if (res.status === 401 || res.status === 403) return { kind: "config", error };
  // Alleen een afgewezen ontvanger telt als "dit adres deugt niet"; een ander validatieprobleem is onze fout
  if ((res.status === 400 || res.status === 422) && /\b(to|recipient|email address)\b/i.test(String(body.message ?? ""))) {
    return { kind: "permanent", error };
  }
  if (res.status === 400 || res.status === 422) return { kind: "config", error };
  return { kind: "transient", error };
}

// ── De lus: ophalen, versturen, melden ──────────────────────────────────────────────────────────────────────────
export type OutreachDeps = {
  next: (limit: number) => Promise<{ enabled: boolean; reason?: string; items: OutreachItem[] }>;
  send: (mail: Mail, idempotencyKey: string) => Promise<SendResult>;
  sent: (token: string, resendId: string) => Promise<void>;
  failed: (token: string, error: string, permanent: boolean) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};

export type OutreachSummary = {
  enabled: boolean;
  reason?: string;
  sent: number;
  rejected: number;
  postponed: number;
  stopped?: string;
};

/** Pauze tussen twee mails: rustig versturen is beter voor de reputatie van het domein */
export const SEND_GAP_MS = 2500;

export async function runOutreach(d: OutreachDeps, limit = 10, base?: string): Promise<OutreachSummary> {
  const next = await d.next(limit);
  const out: OutreachSummary = { enabled: next.enabled, reason: next.reason, sent: 0, rejected: 0, postponed: 0 };
  for (const [idx, item] of next.items.entries()) {
    if (idx > 0) await d.sleep(SEND_GAP_MS);
    let result: SendResult;
    try {
      result = await d.send(composeOutreach(item, base), `outreach-${item.token}`);
    } catch (e) {
      result = { kind: "permanent", error: e instanceof Error ? e.message : "mail samenstellen mislukt" };
    }
    if (result.kind === "sent") {
      await d.sent(item.token, result.id);
      out.sent += 1;
    } else if (result.kind === "permanent") {
      await d.failed(item.token, result.error, true);
      out.rejected += 1;
    } else if (result.kind === "transient") {
      await d.failed(item.token, result.error, false);
      out.postponed += 1;
    } else {
      // Instelling fout: niets meer proberen, de rest blijft geclaimd en komt over 30 minuten opnieuw
      await d.failed(item.token, result.error, false);
      out.postponed += next.items.length - idx;
      out.stopped = result.error;
      break;
    }
  }
  return out;
}

// ── Gebeurtenissen van Resend (zelfde webhook als de inbox) ─────────────────────────────────────────────────────
export type ResendEvent = { type: "delivered" | "bounced" | "complained"; emailId: string };

/** email.delivered, email.bounced (alleen permanente) en email.complained. Andere events → null. */
export function parseResendEvent(payload: unknown): ResendEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; data?: Record<string, unknown> };
  if (typeof p.type !== "string" || !p.data || typeof p.data !== "object") return null;
  const emailId = typeof p.data.email_id === "string" ? p.data.email_id : null;
  if (!emailId || emailId.length > 100) return null;
  if (p.type === "email.delivered") return { type: "delivered", emailId };
  if (p.type === "email.complained") return { type: "complained", emailId };
  if (p.type === "email.bounced") {
    const bounce = p.data.bounce as { type?: unknown } | undefined;
    // Een tijdelijke bounce (volle mailbox) is geen reden om het adres uit te sluiten
    if (typeof bounce?.type === "string" && /transient/i.test(bounce.type)) return null;
    return { type: "bounced", emailId };
  }
  return null;
}

export const isToken = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
