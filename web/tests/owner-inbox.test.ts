import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  OWNER_PROMPT,
  cleanBody,
  emailAddress,
  htmlToText,
  isAutomatedSender,
  looksLikeOptOut,
  ownerReplyText,
  parseInbound,
  parseOwnerReply,
  placeIdFromSubject,
  stripQuoted,
  verifyResendSignature,
} from "../src/lib/owner-inbox.ts";

const KEY = Buffer.from("geheim-voor-de-test-1234567890ab");
const SECRET = `whsec_${KEY.toString("base64")}`;

function signed(body: string, ts: number, key = KEY) {
  const sig = createHmac("sha256", key).update(`msg_1.${ts}.${body}`).digest("base64");
  return new Headers({ "svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` });
}

test("handtekening: geldig, verkeerde sleutel, aangepaste body, te oud", () => {
  const now = 1_800_000_000;
  const body = '{"type":"email.received"}';
  assert.ok(verifyResendSignature(SECRET, signed(body, now), body, now));
  assert.ok(!verifyResendSignature(SECRET, signed(body, now, Buffer.from("andere")), body, now));
  assert.ok(!verifyResendSignature(SECRET, signed(body, now), body + " ", now));
  assert.ok(!verifyResendSignature(SECRET, signed(body, now - 600), body, now));
  assert.ok(!verifyResendSignature(SECRET, new Headers(), body, now));
});

test("handtekening: een van meerdere v1-handtekeningen is genoeg", () => {
  const now = 1_800_000_000;
  const body = "{}";
  const h = signed(body, now);
  h.set("svix-signature", `v1,ZmFrZQ== ${h.get("svix-signature")}`);
  assert.ok(verifyResendSignature(SECRET, h, body, now));
});

test("emailAddress haalt het adres uit een naam met haakjes", () => {
  assert.equal(emailAddress("Jan de Vries <Jan@Camping.NL>"), "jan@camping.nl");
  assert.equal(emailAddress("info@deproef.nl"), "info@deproef.nl");
  assert.equal(emailAddress(["a@b.nl"]), "a@b.nl");
  assert.equal(emailAddress("geen adres"), null);
  assert.equal(emailAddress(undefined), null);
});

test("parseInbound: alleen email.received met id en afzender", () => {
  const ok = parseInbound({
    type: "email.received",
    data: { email_id: "abc", from: "Eigenaar <info@deproef.nl>", subject: "Re: Klopt dit?", text: "Ja" },
  });
  assert.deepEqual(ok, { emailId: "abc", from: "info@deproef.nl", subject: "Re: Klopt dit?", text: "Ja", html: null });
  assert.equal(parseInbound({ type: "email.sent", data: { email_id: "abc", from: "a@b.nl" } }), null);
  assert.equal(parseInbound({ type: "email.received", data: { from: "a@b.nl" } }), null);
  assert.equal(parseInbound(null), null);
});

test("placeIdFromSubject vindt het id van de plek", () => {
  assert.equal(
    placeIdFromSubject("Re: Klopt dit nog? [VS-11111111-1111-1111-1111-11111111111A]"),
    "11111111-1111-1111-1111-11111111111a",
  );
  assert.equal(placeIdFromSubject("Re: vraag"), null);
});

test("stripQuoted laat alleen het nieuwe antwoord staan", () => {
  const mail = [
    "Klopt, maar de prijs is nu 18 euro.",
    "",
    "Groet, Jan",
    "",
    "Op ma 2 nov 2026 om 10:00 schreef VrijStaan <hallo@vrijstaan.nl>:",
    "> Prijs per nacht: 15 euro",
  ].join("\n");
  assert.equal(stripQuoted(mail), "Klopt, maar de prijs is nu 18 euro.\n\nGroet, Jan");
  assert.equal(stripQuoted("Prima\n> geciteerd\nOk"), "Prima\nOk");
  assert.equal(stripQuoted("Ja\nOn Mon, Nov 2 wrote:\noud"), "Ja");
});

test("htmlToText en cleanBody: html zonder tags, citaten weg", () => {
  assert.equal(htmlToText("<p>Vertrek&nbsp;voor 11:00</p><br>&euro; 18").trim(), "Vertrek voor 11:00\n\n€ 18");
  assert.equal(cleanBody({ text: null, html: "<div>Ja</div><blockquote>Prijs 15</blockquote>" }), "Ja");
  assert.equal(cleanBody({ text: "Tekst wint", html: "<p>html</p>" }), "Tekst wint");
});

test("ownerReplyText bevat de mail, geen afzenderadres; prompt is de opdracht", () => {
  const t = ownerReplyText("Re: vraag", "Prijs is 18 euro");
  assert.match(t, /Onderwerp: Re: vraag/);
  assert.match(t, /Prijs is 18 euro/);
  assert.doesNotMatch(t, /@/);
  assert.match(OWNER_PROMPT, /intent: 'confirm' \| 'update' \| 'unsubscribe' \| 'unknown'/);
});

test("parseOwnerReply: waarden controleren, twijfel wordt leeg", () => {
  assert.deepEqual(parseOwnerReply('{"intent":"update","price":18,"departure_time":"11:00","summary":"Nieuwe prijs."}'), {
    intent: "update",
    price: 18,
    departure_time: "11:00",
    checkin_from: null,
    departure_rule: "vast",
    power: null,
    water: null,
    dump_station: null,
    open_all_year: null,
    season: null,
    summary: "Nieuwe prijs.",
  });
  // Komma, 9:30 en 10.30 worden genormaliseerd
  assert.equal(parseOwnerReply('{"intent":"update","price":"17,5","departure_time":null,"summary":""}')?.price, 17.5);
  assert.equal(parseOwnerReply('{"intent":"update","price":null,"departure_time":"9:30","summary":""}')?.departure_time, "09:30");
  assert.equal(parseOwnerReply('{"intent":"update","price":null,"departure_time":"10.30","summary":""}')?.departure_time, "10:30");
  // Onzin wordt null; een update zonder waarde is 'unknown'
  const bad = parseOwnerReply('{"intent":"update","price":9999,"departure_time":"rond de middag","summary":"x"}');
  assert.deepEqual(bad, { intent: "unknown", price: null, departure_time: null, checkin_from: null, departure_rule: null, power: null, water: null, dump_station: null, open_all_year: null, season: null, summary: "x" });
  assert.equal(parseOwnerReply('{"intent":"hack","summary":"x"}')?.intent, "unknown");
  assert.equal(parseOwnerReply('{"intent":"confirm","price":null,"departure_time":null,"summary":"Klopt"}')?.intent, "confirm");
  assert.equal(parseOwnerReply("geen json"), null);
});

test("parseOwnerReply: aankomst, vertrekregel en afmelden", () => {
  const a = parseOwnerReply('{"intent":"update","price":null,"departure_time":null,"checkin_from":"14.00","departure_rule":null,"summary":"Aankomst."}');
  assert.equal(a?.checkin_from, "14:00");
  assert.equal(a?.intent, "update", "alleen een aankomsttijd is een bruikbare update");
  // Alleen een vertrekregel zonder tijd is ook een update
  assert.equal(parseOwnerReply('{"intent":"update","departure_rule":"vrij","summary":"x"}')?.departure_rule, "vrij");
  // 'vast' zonder tijd kan niemand toepassen: leeg. Een tijd gaat voor een tegenstrijdige regel.
  assert.equal(parseOwnerReply('{"intent":"update","price":18,"departure_rule":"vast","summary":"x"}')?.departure_rule, null);
  assert.equal(parseOwnerReply('{"intent":"update","departure_time":"11:00","departure_rule":"vrij","summary":"x"}')?.departure_rule, "vast");
  // Ongeldige waarden worden leeg
  const bad = parseOwnerReply('{"intent":"update","price":18,"checkin_from":"25:00","departure_rule":"soms","summary":"x"}');
  assert.equal(bad?.checkin_from, null);
  assert.equal(bad?.departure_rule, null);
  assert.equal(parseOwnerReply('{"intent":"unsubscribe","summary":"Geen mail meer."}')?.intent, "unsubscribe");
});

test("looksLikeOptOut: afmelden herkennen zonder AI", () => {
  for (const t of [
    "Graag afmelden voor jullie mails.",
    "Geen mail meer sturen aub",
    "Ik wil geen e-mails meer van jullie",
    "Please unsubscribe me",
    "Haal mij van de lijst",
    "Verwijder mijn e-mailadres uit jullie mailing",
    "Dit is spam",
    "Stop met mailen.",
  ]) {
    assert.ok(looksLikeOptOut(t), t);
  }
  for (const t of ["Aankomst vanaf 14:00, vertrek uiterlijk 11:00.", "Ja, dat klopt. Groet", "We sturen u graag een mail met de prijslijst."]) {
    assert.ok(!looksLikeOptOut(t), t);
  }
});

test("isAutomatedSender: bounces, noreply en afwezigheidsmeldingen", () => {
  assert.ok(isAutomatedSender("mailer-daemon@googlemail.com"));
  assert.ok(isAutomatedSender("postmaster@camping.nl"));
  assert.ok(isAutomatedSender("noreply@camping.nl"));
  assert.ok(isAutomatedSender("info@camping.nl", "Automatic reply: Klopt dit nog?"));
  assert.ok(isAutomatedSender("info@camping.nl", "Re: Afwezig tot 12 november"));
  assert.ok(!isAutomatedSender("info@camping.nl", "Re: Klopt dit nog? [VS-1]"));
  assert.ok(!isAutomatedSender("jan@camping.nl"));
});

test("parseOwnerReply: voorzieningen en openingsperiode", () => {
  const r = parseOwnerReply('{"intent":"update","power":true,"water":false,"dump_station":true,"open_all_year":false,"season":"  1 april   tot en met 31 oktober ","summary":"x"}');
  assert.equal(r?.intent, "update");
  assert.deepEqual([r?.power, r?.water, r?.dump_station, r?.open_all_year], [true, false, true, false]);
  assert.equal(r?.season, "1 april tot en met 31 oktober");
  // Alleen een voorziening is genoeg voor een update
  assert.equal(parseOwnerReply('{"intent":"update","water":true,"summary":"x"}')?.intent, "update");
  // Tekst in plaats van ja/nee wordt leeg, en dan is er niets te doen
  const bad = parseOwnerReply('{"intent":"update","power":"ja","water":"misschien","summary":"x"}');
  assert.equal(bad?.power, null);
  assert.equal(bad?.intent, "unknown");
  // Tegenspraak: het hele jaar open en een periode met data
  const both = parseOwnerReply('{"intent":"update","price":18,"open_all_year":true,"season":"april tot oktober","summary":"x"}');
  assert.equal(both?.open_all_year, null);
  assert.equal(both?.season, null);
  assert.equal(parseOwnerReply('{"intent":"update","season":"' + "x".repeat(200) + '","summary":"x"}')?.season?.length, 60);
});
