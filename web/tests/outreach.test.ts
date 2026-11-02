import { strict as assert } from "node:assert";
import { test } from "node:test";
import { placeIdFromSubject } from "../src/lib/owner-inbox.ts";
import {
  type OutreachItem,
  arrivalLine,
  cleanName,
  composeOutreach,
  departureLine,
  parseResendEvent,
  runOutreach,
  sendViaResend,
} from "../src/lib/outreach.ts";

const item = (over: Partial<OutreachItem> = {}): OutreachItem => ({
  token: "11111111-1111-4111-8111-111111111111",
  place_id: "22222222-2222-4222-8222-222222222222",
  name: "Camping De Vlinder",
  kind: "camping",
  town: "Leek",
  email: "info@devlinder.nl",
  departure: null,
  checkout_until: null,
  checkin_from: null,
  checkin_until: null,
  ...over,
});

test("de mail noemt wat we weten en verzint niets", () => {
  const m = composeOutreach(item({ departure: "vast", checkout_until: "11:00", checkin_from: "14:00" }), "https://site.test");
  assert.match(m.text, /Aankomst: vanaf 14:00/);
  assert.match(m.text, /Vertrek: uiterlijk 11:00/);
  const leeg = composeOutreach(item(), "https://site.test");
  assert.match(leeg.text, /Aankomst: onbekend/);
  assert.match(leeg.text, /Vertrek: onbekend/);
  assert.equal(arrivalLine({ checkin_from: "14:00", checkin_until: "18:00" }), "tussen 14:00 en 18:00");
  assert.equal(departureLine({ departure: "vast", checkout_until: null }), "onbekend", "vast zonder tijd is onbekend");
  assert.equal(departureLine({ departure: "vrij", checkout_until: null }), "vrij, geen vaste tijd");
  assert.equal(departureLine({ departure: "vast", checkout_until: "ongeldig" }), "onbekend");
});

test("onderwerp bevat [VS-<id>] zodat het antwoord aan de plek hangt; afmeldlink en headers staan erin", () => {
  const m = composeOutreach(item(), "https://site.test/");
  assert.equal(placeIdFromSubject(m.subject), "22222222-2222-4222-8222-222222222222");
  assert.equal(m.to, "info@devlinder.nl");
  assert.equal(m.headers["List-Unsubscribe"], "<https://site.test/api/afmelden/11111111-1111-4111-8111-111111111111>");
  assert.equal(m.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(m.text, /https:\/\/site\.test\/afmelden\/11111111-1111-4111-8111-111111111111/);
  assert.match(m.html, /Meld je af/);
  assert.match(m.text, /privacy/);
});

test("stijl: geen gedachtestreepjes, uitroeptekens of middenpunten; geen persoonsnaam", () => {
  const m = composeOutreach(item(), "https://site.test");
  assert.doesNotMatch(m.text, /[—–!·]/);
  assert.doesNotMatch(m.text, /Patrick/i);
});

test("naam van de plek kan geen kop of HTML injecteren", () => {
  assert.equal(cleanName("Camping\r\nBcc: x@y.nl <b>"), "Camping Bcc: x@y.nl b");
  const m = composeOutreach(item({ name: '<script>alert(1)</script> "Camping"' }), "https://site.test");
  assert.doesNotMatch(m.html, /<script>/);
  assert.doesNotMatch(m.subject, /[\r\n]/);
  assert.throws(() => composeOutreach(item({ token: "geen-uuid" })));
});

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

test("Resend: gelukt, adres afgewezen, tijdelijk en onze eigen instelling", async () => {
  const mail = composeOutreach(item(), "https://site.test");
  const ok = fakeFetch(200, { id: "re_1" });
  assert.deepEqual(await sendViaResend("k", "VrijStaan <a@b.nl>", "r@b.nl", mail, "outreach-x", ok.f), { kind: "sent", id: "re_1" });
  const sent = JSON.parse(String(ok.calls[0].init.body));
  assert.deepEqual(sent.to, ["info@devlinder.nl"]);
  assert.equal(sent.reply_to, "r@b.nl");
  assert.equal((ok.calls[0].init.headers as Record<string, string>)["Idempotency-Key"], "outreach-x");

  const badTo = await sendViaResend("k", "f", "r", mail, "i", fakeFetch(422, { message: "Invalid `to` field" }).f);
  assert.equal(badTo.kind, "permanent");
  // Een ander validatieprobleem of een niet-geverifieerd domein is onze fout, niet die van het adres
  assert.equal((await sendViaResend("k", "f", "r", mail, "i", fakeFetch(403, { message: "domain is not verified" }).f)).kind, "config");
  assert.equal((await sendViaResend("k", "f", "r", mail, "i", fakeFetch(422, { message: "Invalid `from` field" }).f)).kind, "config");
  assert.equal((await sendViaResend("k", "f", "r", mail, "i", fakeFetch(429, { message: "rate" }).f)).kind, "transient");
  assert.equal((await sendViaResend("k", "f", "r", mail, "i", fakeFetch(500, {}).f)).kind, "transient");
});

test("runOutreach: meldt elke uitkomst en stopt bij een instellingsfout", async () => {
  const log: string[] = [];
  const items = [item({ token: "11111111-1111-4111-8111-111111111111" }), item({ token: "33333333-3333-4333-8333-333333333333" }), item({ token: "44444444-4444-4444-8444-444444444444" })];
  const results = [{ kind: "sent", id: "re_a" }, { kind: "permanent", error: "adres" }, { kind: "config", error: "domein" }] as const;
  let n = 0;
  const out = await runOutreach(
    {
      next: async () => ({ enabled: true, items }),
      send: async () => results[n++],
      sent: async (t, id) => void log.push(`sent ${t.slice(0, 2)} ${id}`),
      failed: async (t, e, p) => void log.push(`failed ${t.slice(0, 2)} ${e} ${p}`),
      sleep: async () => void log.push("pauze"),
    },
    10,
    "https://site.test",
  );
  assert.deepEqual(log, ["sent 11 re_a", "pauze", "failed 33 adres true", "pauze", "failed 44 domein false"]);
  assert.deepEqual({ sent: out.sent, rejected: out.rejected, postponed: out.postponed, stopped: out.stopped }, { sent: 1, rejected: 1, postponed: 1, stopped: "domein" });
});

test("runOutreach: campagne uit of leeg doet niets", async () => {
  let sends = 0;
  const out = await runOutreach({
    next: async () => ({ enabled: false, reason: "uit", items: [] }),
    send: async () => (sends++, { kind: "sent", id: "x" }),
    sent: async () => {},
    failed: async () => {},
    sleep: async () => {},
  });
  assert.equal(sends, 0);
  assert.deepEqual({ enabled: out.enabled, sent: out.sent }, { enabled: false, sent: 0 });
});

test("parseResendEvent: delivered, permanente bounce en klacht; tijdelijke bounce en rest niet", () => {
  assert.deepEqual(parseResendEvent({ type: "email.delivered", data: { email_id: "re_1" } }), { type: "delivered", emailId: "re_1" });
  assert.deepEqual(parseResendEvent({ type: "email.complained", data: { email_id: "re_1" } }), { type: "complained", emailId: "re_1" });
  assert.deepEqual(parseResendEvent({ type: "email.bounced", data: { email_id: "re_1", bounce: { type: "Permanent" } } }), { type: "bounced", emailId: "re_1" });
  assert.deepEqual(parseResendEvent({ type: "email.bounced", data: { email_id: "re_1" } }), { type: "bounced", emailId: "re_1" });
  assert.equal(parseResendEvent({ type: "email.bounced", data: { email_id: "re_1", bounce: { type: "Transient" } } }), null);
  assert.equal(parseResendEvent({ type: "email.received", data: { email_id: "re_1" } }), null);
  assert.equal(parseResendEvent({ type: "email.delivered", data: {} }), null);
  assert.equal(parseResendEvent(null), null);
});
