// AI-lezer: het model levert, de controle beslist. Elk geval hieronder komt uit de steekproef van 16 november 2026
// (review §4.4) of uit het voorstel van Gemini zelf (hele bedragen als "€ 20,00" vielen daar weg).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GEVALLEN } from "./golden/gevallen";
import { amounts, condense, parseAnswer, quoteSource, textHash, times, toLines, verifyAnswer, type AiAnswer } from "../supabase/functions/pipeline/ai";

const site = (pages: Record<string, string>) => condense(Object.entries(pages).map(([url, html]) => ({ url, html })));
const fields = (a: AiAnswer, text: string) => Object.fromEntries(verifyAnswer(a, text).proposals.map((p) => [p.field, p.value]));

test("bedragen: hele euro's, komma's en ,-", () => {
  assert.deepEqual(amounts("€ 20,00 per nacht"), [20]);
  assert.deepEqual(amounts("€18,5"), [18.5]);
  assert.deepEqual(amounts("kost 15,- per nacht"), [15]);
  assert.deepEqual(amounts("€ 24.50"), [24.5]);
});

test("tijden: 11:00, 11.00, 12 uur en 10u", () => {
  assert.deepEqual(times("vertrek voor 11.00 uur"), ["11:00"]);
  assert.deepEqual(times("tot 12 uur"), ["12:00"]);
  assert.deepEqual(times("uiterlijk 10u"), ["10:00"]);
});

test("condense houdt alleen relevante regels, één keer, met het adres van de pagina", () => {
  const text = site({
    "https://a.nl/": "<nav>Home</nav><p>Welkom op onze mooie boerderij in het groen.</p><p>Camperplaats € 15,00 per nacht.</p><footer>Cookies en privacy</footer>",
    "https://a.nl/faq": "<p>Camperplaats € 15,00 per nacht.</p><p>Vertrek voor 11.00 uur.</p>",
  });
  assert.match(text, /### https:\/\/a\.nl\/\n/);
  assert.match(text, /### https:\/\/a\.nl\/faq\nVertrek voor 11\.00 uur\./);
  assert.equal(text.match(/€ 15,00/g)?.length, 1);
  assert.doesNotMatch(text, /Welkom|Cookies/);
});

test("condense knipt tabelcellen niet aan elkaar zonder scheiding", () => {
  const lines = toLines("<table><tr><td>Hond</td><td>€ 2,00</td></tr><tr><td>Camperplaats</td><td>€ 17,00</td></tr></table>");
  assert.deepEqual(lines, ["Hond | € 2,00", "Camperplaats | € 17,00"]);
});

test("de hash verandert met de tekst", async () => {
  assert.notEqual(await textHash("a"), await textHash("b"));
  assert.equal(await textHash("a"), await textHash("a"));
});

test("citaat moet letterlijk in één regel staan; verzonnen citaat valt weg", () => {
  const text = site({ "https://a.nl/regels": "<p>Vertrek is vóór 11:00 uur.</p><p>Camperplaats De Heide kost € 18,50 per nacht.</p>" });
  assert.equal(quoteSource("Vertrek is vóór 11:00 uur.", text), "https://a.nl/regels");
  assert.equal(quoteSource("Vertrek is vóór 12:00 uur.", text), undefined);
  // Over twee regels heen telt niet
  assert.equal(quoteSource("11:00 uur. Camperplaats De Heide", text), undefined);
  const v = verifyAnswer({ vertrekregel: "vast", vertrektijd: "12:00", vertrek_citaat: "Vertrek is vóór 12:00 uur." }, text);
  assert.equal(v.proposals.length, 0);
  assert.match(v.rejected[0], /niet letterlijk/);
});

test("vaste vertrektijd en hele prijs komen door (Gemini-bug: € 20,00)", () => {
  const text = site({ "https://a.nl/tarieven": "<p>Camperplaats € 20,00 per nacht inclusief 2 personen.</p><p>De reguliere vertrektijd is 11:00 uur.</p>" });
  const out = fields(
    {
      vertrekregel: "vast",
      vertrektijd: "11:00",
      vertrek_citaat: "De reguliere vertrektijd is 11:00 uur.",
      nachtprijs: 20,
      nachtprijs_citaat: "Camperplaats € 20,00 per nacht inclusief 2 personen.",
    },
    text,
  );
  assert.deepEqual(out, { departure: "vast", checkout_until: "11:00", price_eur: 20 });
});

test("Bodelaeke: 'hond per 24 uur' is geen vertrekregel", () => {
  const text = site({ "https://a.nl/": "<p>Elke hond € 1,- per 24 uur.</p>" });
  const v = verifyAnswer({ vertrekregel: "per24", vertrek_citaat: "Elke hond € 1,- per 24 uur." }, text);
  assert.equal(v.proposals.length, 0);
});

test("Landgraaf: 'checkin/checkout 24/7' is geen vrij vertrek", () => {
  const text = site({ "https://a.nl/": "<p>Selfservice checkin/checkout (24/7) bij de zuil.</p>" });
  assert.equal(verifyAnswer({ vertrekregel: "vrij", vertrek_citaat: "Selfservice checkin/checkout (24/7)" }, text).proposals.length, 0);
});

test("letterlijk geen vaste vertrektijd wordt vrij, bevestigd door de extractor", () => {
  const text = site({ "https://a.nl/info": "<p>Bij ons geldt geen vaste vertrektijd voor campers.</p>" });
  const v = verifyAnswer({ vertrekregel: "vrij", vertrek_citaat: "Bij ons geldt geen vaste vertrektijd voor campers." }, text);
  assert.deepEqual(v.proposals.map((p) => [p.field, p.value, p.confirmed, p.url]), [["departure", "vrij", true, "https://a.nl/info"]]);
});

test("Kluijthoek: vertrektijd van de chalets telt niet", () => {
  const text = site({ "https://a.nl/": "<p>In onze chalets is het vertrek vóór 10.00 uur.</p>" });
  assert.equal(verifyAnswer({ vertrekregel: "vast", vertrektijd: "10:00", vertrek_citaat: "In onze chalets is het vertrek vóór 10.00 uur." }, text).proposals.length, 0);
});

test("Leudal: prijs van de huurtent is geen camperprijs", () => {
  const text = site({ "https://a.nl/": "<p>Huurtent vanaf € 45,00 per nacht.</p><p>€ 17,00 per nacht (2 personen) incl. toeristenbelasting voor de camperplaats.</p>" });
  assert.deepEqual(fields({ nachtprijs: 45, nachtprijs_citaat: "Huurtent vanaf € 45,00 per nacht." }, text), {});
  assert.deepEqual(
    fields({ nachtprijs: 17, nachtprijs_citaat: "€ 17,00 per nacht (2 personen) incl. toeristenbelasting voor de camperplaats." }, text),
    { price_eur: 17 },
  );
});

test("Hoeve Welgelegen: toeristenbelasting is geen nachtprijs", () => {
  const text = site({ "https://a.nl/": "<p>Toeristenbelasting p.p.p.n. € 1,45</p>" });
  assert.deepEqual(fields({ nachtprijs: 1.45, nachtprijs_citaat: "Toeristenbelasting p.p.p.n. € 1,45" }, text), {});
});

test("prijs die niet in het citaat staat valt weg", () => {
  const text = site({ "https://a.nl/": "<p>Camperplaats € 18,50 per nacht.</p>" });
  assert.deepEqual(fields({ nachtprijs: 19, nachtprijs_citaat: "Camperplaats € 18,50 per nacht." }, text), {});
});

test("laatste aankomst, lengte en maximaal aantal nachten met citaat", () => {
  const text = site({
    "https://a.nl/regels": "<p>Aankomst is mogelijk tot 21.00 uur.</p><p>Campers tot maximaal 8 meter lengte zijn welkom.</p><p>U mag maximaal 3 x 24 uur blijven staan.</p>",
  });
  const out = fields(
    {
      vertrekregel: "onbekend",
      laatste_aankomst: "21:00",
      laatste_aankomst_citaat: "Aankomst is mogelijk tot 21.00 uur.",
      max_lengte_m: 8,
      max_lengte_citaat: "Campers tot maximaal 8 meter lengte zijn welkom.",
      max_nachten: 3,
      max_nachten_citaat: "U mag maximaal 3 x 24 uur blijven staan.",
    },
    text,
  );
  assert.deepEqual(out, { checkin_until: "21:00", max_length_m: 8, max_stay_nights: 3 });
});

test("hoogte is geen lengte", () => {
  const text = site({ "https://a.nl/": "<p>Let op: doorrijhoogte maximaal 3,5 meter.</p>" });
  assert.deepEqual(fields({ max_lengte_m: 3.5, max_lengte_citaat: "Let op: doorrijhoogte maximaal 3,5 meter." }, text), {});
});

test("Heelderpeel: tot nader order gesloten wordt een melding, buiten het seizoen niet", () => {
  const text = site({ "https://a.nl/": "<p>Heelderpeel is tot nader order gesloten.</p><p>De camping is gesloten van november tot maart.</p>" });
  assert.equal(verifyAnswer({ gesloten: true, gesloten_citaat: "Heelderpeel is tot nader order gesloten." }, text).closed?.url, "https://a.nl/");
  assert.equal(verifyAnswer({ gesloten: true, gesloten_citaat: "De camping is gesloten van november tot maart." }, text).closed, null);
});

test("onzin van het model levert niets op", () => {
  assert.deepEqual(parseAnswer("geen json"), {});
  assert.deepEqual(verifyAnswer(parseAnswer('{"vertrekregel":"vast","vertrektijd":"25:99"}'), "").proposals, []);
});

test("gouden set: het inkorten houdt elke verwachte vertrektijd en prijs", () => {
  for (const g of GEVALLEN) {
    const html = readFileSync(new URL(`./golden/paginas/${g.naam}.txt`, import.meta.url), "utf8");
    const text = condense([{ url: g.url, html }]);
    if (g.tijd) assert.ok(times(text).includes(g.tijd), `${g.naam}: tijd ${g.tijd}`);
    if (g.prijs) assert.ok(amounts(text).some((a) => Math.abs(a - (g.prijs as number)) < 0.005), `${g.naam}: prijs ${g.prijs}`);
  }
});

test("kaal bedrag op een eigen regel hoort bij het etiket ervoor", () => {
  assert.deepEqual(toLines("Toeristenplaats standaard (tot 2 pers)\n€ 27,00\nHome"), ["Toeristenplaats standaard (tot 2 pers) | € 27,00"]);
});
