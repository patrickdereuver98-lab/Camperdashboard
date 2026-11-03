import { SITE_URL } from "./env";

/**
 * AI Outreach Loop, stap 2: automatisch een korte mail naar eigenaren met een bekend e-mailadres, via Resend.
 * De regels (wie, hoeveel, wanneer, afmelden, noodrem) staan in de database (migratie 20261102200000_outreach.sql);
 * hier staat de mailtekst, de verzending en de lus eromheen. De route heeft geen service-role-sleutel.
 */

/**
 * Waar de mail naar vraagt (besluit eigenaar 3 november 2026): de zwaarst wegende gegevens voor publicatie en score
 * (vertrekregel, openingsperiode, prijs, stroom) plus aankomst en lozen; zelfde als private.outreach_missing.
 */
export const FACTS = ["vertrek", "aankomst", "seizoen", "prijs", "stroom", "lozen"] as const;
export type Fact = (typeof FACTS)[number];

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
  open_all_year: boolean | null;
  season: string | null;
  price_eur: number | null;
  power: boolean | null;
  dump_station: boolean | null;
  /** Uit de database (private.outreach_missing): waar de mail naar vraagt */
  missing: string[];
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

const yesNo = (v: boolean | null) => (v === true ? "ja" : v === false ? "nee" : null);

/** Wat we al weten van één gegeven, in woorden; null als we het niet weten */
export function knownValue(i: OutreachItem, fact: Fact): string | null {
  switch (fact) {
    case "vertrek": {
      const v = departureLine(i);
      return v === "onbekend" ? null : v;
    }
    case "aankomst": {
      const v = arrivalLine(i);
      return v === "onbekend" ? null : v;
    }
    case "seizoen":
      return i.open_all_year === true ? "het hele jaar open" : i.season?.trim() ? i.season.trim().slice(0, 60) : null;
    case "prijs":
      return typeof i.price_eur === "number" && i.price_eur >= 0 && i.price_eur <= 500
        ? `vanaf € ${i.price_eur.toLocaleString("nl-NL", { minimumFractionDigits: Number.isInteger(i.price_eur) ? 0 : 2 })} per nacht`
        : null;
    case "stroom":
      return yesNo(i.power);
    case "lozen":
      return yesNo(i.dump_station);
  }
}

const LABEL: Record<Fact, string> = { vertrek: "Vertrek", aankomst: "Aankomst", seizoen: "Open", prijs: "Prijs", stroom: "Stroom", lozen: "Lozen" };

/** Vraag per gegeven, in gewone woorden, en de invulregel (met "…": wie hem ongewijzigd terugstuurt, levert niets op) */
const ASK: Record<Fact, { question: string; fill: string }> = {
  vertrek: { question: "tot hoe laat moeten gasten weg, of mogen ze blijven zo lang ze willen?", fill: "uiterlijk … uur (of: vrij vertrek)" },
  aankomst: { question: "vanaf hoe laat mogen gasten komen?", fill: "vanaf … uur" },
  seizoen: { question: "het hele jaar open, of in welke periode?", fill: "van … tot … (of: het hele jaar)" },
  prijs: {
    question: "wat kost een nacht voor een camper met twee personen, inclusief toeristenbelasting, stroom en andere toeslagen?",
    fill: "€ … per nacht, alles inbegrepen",
  },
  stroom: { question: "is er stroom op de plek?", fill: "ja of nee" },
  lozen: { question: "kunnen campers hun toilet en afvalwater lozen?", fill: "ja of nee" },
};

/** Welke gegevens we vragen: wat de database mist, in vaste volgorde, en alleen wat we echt niet weten */
export function askedFacts(i: OutreachItem): Fact[] {
  const missing = new Set(i.missing);
  return FACTS.filter((f) => missing.has(f) && knownValue(i, f) === null);
}

export function outreachUrls(token: string, base = process.env.OUTREACH_BASE_URL || SITE_URL) {
  const root = base.replace(/\/+$/, "");
  return { unsubscribe: `${root}/api/afmelden/${token}`, page: `${root}/afmelden/${token}`, privacy: `${root}/privacy` };
}

/**
 * De mail: kort, vriendelijk, in de ik-vorm, zonder naam. Eerlijk over wie we zijn: een hobbyist die een gratis website
 * voor camperaars wil maken, geen gast. Er staat geen link naar een plekpagina en geen bewering over bezoekers of een live site.
 * Wel de naam en woonplaats van de plek, wat we al weten (om te laten corrigeren) en precies de vragen die nog open
 * staan. Vaste tekst, geen AI: er staat nooit iets in wat we niet weten.
 */
export function composeOutreach(i: OutreachItem, base?: string): Mail {
  if (!UUID.test(i.token) || !UUID.test(i.place_id)) throw new Error("Ongeldig token of plek-id");
  const name = cleanName(i.name);
  const town = i.town ? cleanName(i.town) : null;
  const where = town ? `${name} in ${town}` : name;
  const url = outreachUrls(i.token, base);
  const asked = askedFacts(i);
  if (!asked.length) throw new Error("Niets te vragen");
  const known = FACTS.map((f) => [f, knownValue(i, f)] as const).filter((x): x is readonly [Fact, string] => x[1] !== null);

  const intro =
    "Ik ben als hobby bezig met VrijStaan en hoop er iets moois van te maken: een gratis website voor iedereen, met zoveel mogelijk camperplekken en kloppende informatie. " +
    `Daarom vraag ik graag even bevestiging van de gegevens van ${where}.`;
  const askedTitle = asked.length === 1 ? "Dit ene heb ik nog nodig:" : "Dit heb ik nog nodig:";
  const knownLine = known.length
    ? `Dit heb ik al staan: ${known.map(([f, v]) => `${LABEL[f].toLowerCase()} ${v}`).join(", ")}. Klopt dat niet, zeg het dan gerust.`
    : "";
  const how = "Een paar woorden per regel is genoeg. Vul de puntjes maar in:";
  const after = "Ik kijk je antwoord na voor ik het op de site zet. Alvast hartelijk bedankt voor de moeite.";

  const askedLines = asked.map((f) => `${LABEL[f]}: ${ASK[f].question}`);
  const fillLines = asked.map((f) => `${LABEL[f]}: ${ASK[f].fill}`);

  const text = [
    "Hallo,",
    "",
    intro,
    "",
    askedTitle,
    ...askedLines.map((l) => `- ${l}`),
    "",
    how,
    "",
    ...fillLines,
    ...(knownLine ? ["", knownLine] : []),
    "",
    after,
    "",
    "Vriendelijke groet,",
    "VrijStaan",
    "",
    "--",
    `Je krijgt deze mail één keer, omdat dit e-mailadres openbaar bij ${name} staat. Wat ik met gegevens doe, lees je op ${url.privacy}.`,
    `Geen mail meer van mij? Meld je af: ${url.page}`,
  ].join("\n");

  const p = (x: string) => `<p style="margin:0 0 14px">${x}</p>`;
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.55;color:#1f2a24;max-width:560px">` +
    p("Hallo,") +
    p(esc(intro)) +
    p(`<strong>${askedTitle}</strong>`) +
    `<ul style="margin:0 0 14px;padding-left:20px">${askedLines.map((l) => `<li style="margin:0 0 6px">${esc(l)}</li>`).join("")}</ul>` +
    p(esc(how)) +
    `<p style="margin:0 0 14px;padding:10px 12px;background:#f4f1ea;border-radius:8px">${fillLines.map((l) => esc(l)).join("<br>")}</p>` +
    (knownLine ? p(esc(knownLine)) : "") +
    p(esc(after)) +
    p("Vriendelijke groet,<br>VrijStaan") +
    `<p style="margin:24px 0 0;font-size:14px;color:#5b6b61">Je krijgt deze mail één keer, omdat dit e-mailadres openbaar bij ${esc(name)} staat. ` +
    `Wat ik met gegevens doe, lees je in de <a href="${esc(url.privacy)}">privacyverklaring</a>. ` +
    `Geen mail meer van mij? <a href="${esc(url.page)}">Meld je af</a>.</p></div>`;

  return {
    to: i.email.trim(),
    // [VS-<id>] in het onderwerp: zo koppelt de inbox een antwoord aan de plek (placeIdFromSubject)
    subject: `Een korte vraag over ${name} [VS-${i.place_id.toLowerCase()}]`,
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
  failed: (token: string, error: string, permanent: boolean, suppress?: boolean) => Promise<void>;
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
    let mail: Mail;
    try {
      mail = composeOutreach(item, base);
    } catch (e) {
      // Aan onze kant (bijvoorbeeld niets meer te vragen): deze plek opgeven, maar het adres niet uitsluiten
      await d.failed(item.token, e instanceof Error ? e.message : "mail samenstellen mislukt", true, false);
      out.rejected += 1;
      continue;
    }
    const result = await d.send(mail, `outreach-${item.token}`);
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
