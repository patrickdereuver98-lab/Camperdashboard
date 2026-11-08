// Review november 2026, golf 1: juiste kernfeiten uit de dataketen (R17, R18, R19, R25/DATA-10, DATA-16).
import { test } from "node:test";
import assert from "node:assert/strict";
import { extract, sentenceDeparture } from "../supabase/functions/pipeline/extract";
import { checkQuote, verify } from "../supabase/functions/pipeline/quote";
import { gone, pdfOutcome, withDeadline } from "../supabase/functions/pipeline/pages";

const base = new URL("https://camper.example.nl/");
const page = (html: string) => extract([html], base) as Record<string, unknown>;

// ── R17: doelgroepfilter op de strenge "vrij"-regel ──────────────────────────
test("R17: geen vaste vertrektijden voor seizoensgasten of jaarplaatsen is geen vertrekregel", () => {
  const r = page("<p>Voor seizoensgasten en jaarplaatsen hanteren wij geen vaste vertrektijden.</p>");
  assert.equal(r.departure, undefined);
  assert.equal(page("<p>Voor dagrecreanten en wandelaars geldt: vrij in- en uitrijden.</p>").departure, undefined);
  assert.equal(page("<p>Groepen: geen vaste vertrektijden, in overleg.</p>").departure, undefined);
});

test("R17: geen vaste vertrektijden op de camperplaats blijft vrij", () => {
  assert.equal(page("<p>Op de camperplaats gelden geen vaste vertrektijden.</p>").departure, "vrij");
  // Een doelgroep in een andere zin doet er niet toe
  assert.equal(page("<p>Wandelaars zijn welkom. Op de camperplaats gelden geen vaste vertrektijden.</p>").departure, "vrij");
});

// ── R18: citaat alleen overnemen als de extractor hetzelfde leest ────────────
test("R18: chalet-citaat wordt geen vaste vertrektijd, hooguit een inzending", () => {
  const text = "Onze chalets: uitchecken voor 10 uur. Kampeerplaatsen vrij.";
  const a = { departure: "vast" as const, checkout: "10:00", quote: "Onze chalets: uitchecken voor 10 uur." };
  assert.equal(verify(a, text), null);
  assert.equal(checkQuote(a, text)?.confirmed, false);
});

test("R18: openingstijd van de receptie is geen vertrektijd", () => {
  const quote = "De receptie is dagelijks van 9 uur tot 12 uur geopend.";
  const a = { departure: "vast" as const, checkout: "12:00", quote };
  assert.equal(verify(a, quote), null);
  assert.equal(checkQuote(a, quote)?.confirmed, false);
});

test("R18: 24 uur bereikbaar via de noodlijn is geen vrije vertrektijd", () => {
  const text = "Bereikbaar 24 uur per dag via de noodlijn, jaarplaatsen.";
  const a = { departure: "vrij" as const, checkout: null, quote: text };
  assert.equal(verify(a, text), null);
  assert.equal(checkQuote(a, text)?.confirmed, false);
});

test("R18: een citaat waar de extractor dezelfde regel en tijd uit leest, wordt overgenomen", () => {
  const text = "Welkom. Uitchecken op de camperplaats kan tot 11:00 uur. Honden zijn welkom.";
  const quote = "Uitchecken op de camperplaats kan tot 11:00 uur";
  assert.deepEqual(verify({ departure: "vast", checkout: "11:00", quote }, text), {
    departure: "vast", checkout_until: "11:00", times_note: quote,
  });
  // Andere tijd dan de extractor leest: niet bevestigd (en ook niet als tijd in de zin, dus null)
  assert.equal(checkQuote({ departure: "vast", checkout: "12:00", quote }, text), null);
  // Doelgroep: staat op de pagina, maar alleen als inzending
  const seizoen = "Voor seizoensgasten en jaarplaatsen hanteren wij geen vaste vertrektijden.";
  assert.equal(checkQuote({ departure: "vrij", checkout: null, quote: seizoen }, seizoen)?.confirmed, false);
});

test("R18: per24 alleen met een letterlijke per-24-uur-regel, niet met een tarief per 24 uur", () => {
  const regel = "De aankomsttijd is ook de vertrektijd op de camperplaats.";
  assert.equal(verify({ departure: "per24", checkout: null, quote: regel }, regel)?.departure, "per24");
  const tarief = "Camperplaats: € 12,50 per 24 uur, betalen bij de automaat.";
  assert.deepEqual(sentenceDeparture(tarief), {});
  assert.equal(verify({ departure: "per24", checkout: null, quote: tarief }, tarief), null);
});

// ── R19: camperprijs gaat voor, tent-only telt niet ────────────────────────
test("R19: bij een tent- en een camperprijs wint de camperprijs", () => {
  const r = page("<p>Tarieven: tent € 12,00 per nacht.</p><p>Camper € 28,00 per nacht.</p>");
  assert.equal(r.price_eur, 28);
  const t = page("<table><tr><td>Tent</td><td>€ 12,00 per nacht</td></tr><tr><td>Camper</td><td>€ 28,00 per nacht</td></tr></table>");
  assert.equal(t.price_eur, 28);
});

test("R19: een tentprijs alleen is geen nachtprijs", () => {
  assert.equal(page("<p>Tent € 12,00 per nacht.</p>").price_eur, undefined);
  // Tent samen met caravan of camper is wel een plekprijs
  assert.equal(page("<p>Tent, caravan of camper, 2 personen, per nacht € 22,00</p>").price_eur, 22);
});

// ── R25/DATA-10: gratis alleen zonder voorwaarde ───────────────────────────
test("DATA-10: gratis met voorwaarde is geen prijs 0", () => {
  assert.equal(page("<p>Gratis overnachten, mits u eet in ons restaurant.</p>").price_eur, undefined);
  assert.equal(page("<p>Gratis overnachten bij een besteding van € 25 in de winkel.</p>").price_eur, undefined);
  assert.equal(page("<p>Gratis overnachten voor kinderen tot 12 jaar.</p>").price_eur, undefined);
  assert.equal(page("<p>Op onze camperplaats is overnachten is gratis.</p>").price_eur, 0);
  assert.equal(page("<p>Gratis overnachten op de camperplaats aan de haven.</p>").price_eur, 0);
});

// ── R21 en DATA-16: hulpfuncties van de scraper ────────────────────────────
test("R21: 404 en 410 zijn geen hapering, een mislukte PDF wel", () => {
  assert.equal(gone(new Error("HTTP 404")), true);
  assert.equal(gone(new Error("HTTP 410")), true);
  assert.equal(gone(new Error("HTTP 403")), false);
  assert.equal(gone(new Error("HTTP 503")), false);
  assert.deepEqual(
    pdfOutcome([{ text: "<p>a</p>", failed: false }, { text: null, failed: true }, { text: null, failed: false }]),
    { texts: ["<p>a</p>"], failed: 1 },
  );
});

test("DATA-16: na de grens wordt het signaal afgebroken en de belofte afgewezen", async () => {
  let seen: AbortSignal | undefined;
  const slow = (signal: AbortSignal) => {
    seen = signal;
    return new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => resolve("te laat"), 1000);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(signal.reason);
      });
    });
  };
  await assert.rejects(withDeadline(slow, 20, "Site te traag (45 s)"), /Site te traag/);
  assert.equal(seen?.aborted, true);
  // Op tijd: gewoon het resultaat, en het signaal blijft heel
  let fast: AbortSignal | undefined;
  assert.equal(await withDeadline(async (s) => ((fast = s), "klaar"), 1000, "te traag"), "klaar");
  assert.equal(fast?.aborted, false);
});
