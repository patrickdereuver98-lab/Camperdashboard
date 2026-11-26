// AI-lezer (besluit Patrick 20 november 2026, README 140): een taalmodel leest de pagina's van een plek een tweede keer
// en levert per feit een letterlijk citaat. Het model schrijft nooit zelf in `places`: elk feit gaat eerst door de
// controles hieronder (citaat letterlijk in de tekst, getal of tijd in het citaat, juiste onderwerp) en wordt daarna
// een voorstel in de Triage Inbox van Beheer (bron "ai-lezer"). Zo blijft "nooit verzinnen" gelden.
//
// De module is zuiver (geen netwerk, geen database), zodat de controles in `web/tests/ai-lezer.test.ts` draaien.

import { checkQuote, type QuoteAnswer } from "./quote.ts";
import { decodeEntities } from "./extract.ts";

/** Ophogen bij elke wijziging in de prompt of de controles: elke plek krijgt dan bij de volgende lezing van de site een
 * nieuwe hash en wordt opnieuw door de AI-lezer gelezen */
export const AI_VERSION = "1";

/** Hoogstens zoveel tekens per plek naar het model (en in `private.page_texts`) */
export const MAX_CHARS = 12_000;

/** Scheiding tussen pagina's in de opgeslagen tekst; een citaat mag er nooit overheen lopen */
const PAGE_MARK = "\n### ";
const PAGE_SPLIT = /(?:^|\n)### /;
/**
 * De tekst voor de zinscontrole van quote.ts: zonder kopregels, en elke regel als eigen zin (" | " is daar een
 * zinsgrens). Anders plakt een tabelregel zonder punt aan de volgende regel vast en leest de extractor de buurregel mee.
 */
const forCheck = (text: string) =>
  text
    .split("\n")
    .filter((l) => l.trim() && !/^### /.test(l))
    .join(" | ");
// Vrij vertrek zonder bevestiging van de extractor alleen bij een ondubbelzinnige zin (kernbelofte)
// Ook "geen aankomst- of vertrektijden", "geen verplichte/precieze/strakke aankomst- en vertrektijden" (26 november 2026:
// 9 van de 689 plekken zonder vertrekregel zeiden het zo op hun eigen site en vielen hier weg)
const PLAIN_FREE =
  /geen (?:(?:vaste|verplichte|precieze|strakke|speciale|specifieke|vastgestelde) )?(?:aankomst[-,\s]*(?:en|of|\/)?[\s-]*)?(?:vertrek|uitcheck|check-?out)|vertrek(?:t|ken)? (?:ook )?wanneer (?:je|u) (?:wilt|wil)|vertrek(ken)? wanneer|vrije? vertrek/;
// "Soepel" of "in overleg" is geen vrij vertrek: het hangt van de eigenaar af
const SOFT_FREE = /soepel|in overleg|flexibel|meestal|doorgaans/;
// Elke vrij-regel moet over vertrekken gaan, niet alleen over aankomen ("geen vaste aankomsttijden")
const DEPARTURE_WORD = /vertrek|uitcheck|check-?out|weggaan|verlaten|vrij (in en uit|komen en gaan)|komen en gaan/;

/** Een gelezen pagina; `url` null bij een PDF waarvan het adres niet bekend is */
// Entiteiten die decodeEntities (extract.ts) niet kent; de gewone lezer vangt alleen &euro; zelf af. Zonder dit stond
// "&euro; 15,00" in de tekst voor het model en viel elke prijs weg (eerste live run, 20 november 2026)
const MORE_ENTITIES: Record<string, string> = {
  euro: "€", bull: "•", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…",
  sup2: "²", sup3: "³", plusmn: "±", copy: "©", reg: "®", middot: "·", deg: "°", frac12: "½", times: "×",
};

/** Alle HTML-entiteiten weg, ook in tekst die al is opgeslagen */
export const cleanText = (s: string) => decodeEntities(s.replace(/&([a-z0-9]+);/gi, (m, n) => MORE_ENTITIES[n.toLowerCase()] ?? m));

export type SeenPage = { url: string | null; html: string };

// Regels die iets zeggen over vertrek, aankomst, prijs, maten, verblijfsduur of open/dicht. De rest (menu's, sfeertekst,
// cookiemeldingen) gaat niet naar het model: dat scheelt kosten en verkleint de kans op een verkeerd onderwerp.
const STRONG = /vertrek|aankomst|aankomen|inchecken|uitchecken|check[- ]?(?:in|out)|€|euro|\btarie|prijs|per nacht|24 uur|verblijf|max(?:imaal|imum|\.)|lengte|gesloten|opgeheven/i;
const WEAK = /uur\b|nacht|camper|kampeerauto|plaats|toeslag|toeristenbelasting|stroom|kwh|hond|seizoen|geopend|jaarrond|hele jaar|reserver|slagboom|meter|\bm\b/i;
const NOISE = /cookie|privacy|nieuwsbrief|inloggen|winkelwagen|©|copyright|alle rechten/i;

/** HTML of platte tekst (PDF) naar losse regels: blokken worden regels, lange regels worden zinnen */
export function toLines(html: string): string[] {
  const text = cleanText(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(?:br|hr)\s*\/?>|<\/(?:p|div|li|tr|h[1-6]|section|article|table|ul|ol|dd|dt|header|footer)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, " "),
  );
  const out: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/[\s ]+/g, " ").replace(/(?:\s*\|\s*)+$/, "").replace(/^(?:\s*\|\s*)+/, "").trim();
    // Een kaal bedrag of tijdstip op een eigen regel ("€ 20,00", "12:00 uur") hoort bij het etiket op de regel ervoor
    if (out.length && /\d/.test(line) && line.length <= 18 && /^(?:€\s?)?[\d.,:\-– ]+(?:\s?(?:€|euro|uur|u|p\.?p\.?|pp|\/\s?\w+))?$/i.test(line)) {
      out[out.length - 1] = `${out[out.length - 1]} | ${line}`.slice(0, 400);
      continue;
    }
    if (line.length < 8) continue;
    if (line.length <= 400) {
      out.push(line);
      continue;
    }
    // Lange alinea: in zinnen knippen (een decimaal of tijd als "10.00" is geen zinseinde)
    for (const s of line.split(/(?<=[a-zà-ÿ)][.!?])\s+(?=[A-Z0-9€"'(])/)) if (s.trim().length >= 8) out.push(s.trim().slice(0, 400));
  }
  return out;
}

/**
 * De tekst voor het model: per pagina een kopregel met het adres, daaronder alleen de relevante regels. Dubbele regels
 * (menu en voettekst op elke pagina) één keer. Past het niet, dan gaan de sterkste regels voor, in de volgorde van de site.
 */
export function condense(pages: SeenPage[], max = MAX_CHARS): string {
  const seen = new Set<string>();
  const kept: { page: number; order: number; line: string; score: number }[] = [];
  let order = 0;
  pages.forEach((p, page) => {
    for (const line of toLines(p.html)) {
      const key = line.toLowerCase();
      if (seen.has(key) || NOISE.test(line) || line.includes("###")) continue;
      const score = STRONG.test(line) ? 2 : WEAK.test(line) ? 1 : 0;
      if (!score) continue;
      seen.add(key);
      kept.push({ page, order: order++, line, score });
    }
  });
  // Budget: eerst sterk, dan zwak; binnen een soort de volgorde van de site
  const chosen = new Set<number>();
  let used = 0;
  for (const k of [...kept].sort((a, b) => b.score - a.score || a.order - b.order)) {
    const cost = k.line.length + 1;
    if (used + cost > max - pages.length * 80) continue;
    used += cost;
    chosen.add(k.order);
  }
  let out = "";
  pages.forEach((p, page) => {
    const lines = kept.filter((k) => k.page === page && chosen.has(k.order)).map((k) => k.line);
    if (lines.length) out += `${PAGE_MARK}${(p.url ?? "(pdf)").slice(0, 200)}\n${lines.join("\n")}`;
  });
  return out.trim().slice(0, max);
}

/** SHA-256 van de tekst plus de versie: verandert een van beide, dan leest de AI-lezer opnieuw */
export async function textHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${AI_VERSION}\n${text}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Prompt en schema (Gemini: OpenAPI-subset, geen $ref) ──────────────────────────────────────────────────────────────

export const SYSTEM = `Je leest teksten van de website van één camperplaats, camping, boerderij of jachthaven in Nederland.
Je haalt alleen feiten eruit die LETTERLIJK in de tekst staan. Niets afleiden, niets aanvullen, niet gokken.
Regels:
1. Elk feit krijgt een citaat: een stuk tekst van minstens 15 tekens dat letterlijk (tekenvoor-teken) in de tekst staat,
   uit één regel, waarin het getal, de tijd of de uitspraak zelf staat. Geen citaat, dan het veld null.
2. Alleen voor campers of kampeerplaatsen. Tijden en prijzen van chalets, B&B, hotelkamers, huurtenten, trekkershutten,
   stacaravans, vakantiehuizen, de receptie, het zwembad of de winkel tellen niet.
3. vertrekregel: "vrij" alleen als de tekst letterlijk zegt dat er geen vaste vertrektijd is of dat je vertrekt wanneer
   je wilt; "per24" alleen als het verblijf per 24 uur gaat vanaf aankomst; "vast" bij een vaste tijd waarop je weg moet
   (vertrektijd in HH:MM); anders "onbekend". "Vrij in- en uitrijden", "24/7 bereikbaar" of een toeslag "per 24 uur"
   (hond, stroom) is GEEN vertrekregel. Staan er twee verschillende vertrektijden voor campers, dan "onbekend".
4. nachtprijs: het basistarief per nacht voor één camper of kampeerplaats, zonder toeristenbelasting, stroom of andere
   toeslagen. Bij meerdere tarieven het laagste. Toeristenbelasting, hond, stroom, extra persoon of douche is nooit de
   nachtprijs.
5. laatste_aankomst: de uiterste tijd waarop je nog kunt aankomen of inchecken (HH:MM). aankomst_vanaf: de vroegste tijd.
6. max_lengte_m: de maximale lengte van een camper in meters. max_nachten: het maximale aantal nachten dat je mag blijven.
7. gesloten: true alleen als de tekst zegt dat de plek definitief of tot nader order gesloten is (niet: buiten het seizoen).`;

const S = "STRING";
const nullable = (type: string, description?: string) => ({ type, nullable: true, ...(description ? { description } : {}) });

export const SCHEMA = {
  type: "OBJECT",
  properties: {
    vertrekregel: { type: S, enum: ["vrij", "per24", "vast", "onbekend"] },
    vertrektijd: nullable(S, "HH:MM, alleen bij vast"),
    vertrek_citaat: nullable(S),
    aankomst_vanaf: nullable(S, "HH:MM"),
    aankomst_vanaf_citaat: nullable(S),
    laatste_aankomst: nullable(S, "HH:MM"),
    laatste_aankomst_citaat: nullable(S),
    nachtprijs: nullable("NUMBER", "euro"),
    nachtprijs_citaat: nullable(S),
    max_lengte_m: nullable("NUMBER"),
    max_lengte_citaat: nullable(S),
    max_nachten: nullable("INTEGER"),
    max_nachten_citaat: nullable(S),
    gesloten: nullable("BOOLEAN"),
    gesloten_citaat: nullable(S),
  },
  required: ["vertrekregel"],
};

/** Antwoord van het model; alles kan ontbreken of verkeerd getypt zijn, de controle vangt dat op */
export type AiAnswer = Partial<{
  vertrekregel: string;
  vertrektijd: string | null;
  vertrek_citaat: string | null;
  aankomst_vanaf: string | null;
  aankomst_vanaf_citaat: string | null;
  laatste_aankomst: string | null;
  laatste_aankomst_citaat: string | null;
  nachtprijs: number | null;
  nachtprijs_citaat: string | null;
  max_lengte_m: number | null;
  max_lengte_citaat: string | null;
  max_nachten: number | null;
  max_nachten_citaat: string | null;
  gesloten: boolean | null;
  gesloten_citaat: string | null;
}>;

// ── Controle ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Een voorstel voor één kolom van `places`, met het citaat en de pagina waar het staat */
export type Proposal = { field: string; value: unknown; quote: string; url: string | null; confirmed: boolean };
export type Verdict = { proposals: Proposal[]; closed: { quote: string; url: string | null } | null; rejected: string[] };

const norm = (s: string) =>
  s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").trim();

/** Het citaat staat letterlijk in één pagina van de tekst; geeft het adres van die pagina, of undefined */
export function quoteSource(quote: unknown, text: string): string | null | undefined {
  if (typeof quote !== "string") return undefined;
  const q = norm(quote);
  if (q.length < 15 || quote.includes("###")) return undefined;
  for (const block of text.split(PAGE_SPLIT)) {
    const nl = block.indexOf("\n");
    const url = nl > 0 && /^https?:\/\//.test(block) ? block.slice(0, nl).trim() : null;
    // Regel voor regel: een citaat mag niet over twee regels van verschillende plekken op de pagina lopen
    if (block.split("\n").some((line) => norm(line).includes(q))) return url;
  }
  return undefined;
}

/** Alle bedragen in een tekst als getal: "€ 20,00", "€20", "20,-", "18.50", "€ 1.250" niet (te groot) */
export function amounts(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/(?<![\d.,])(\d{1,3})(?:[.,](\d{1,2}))?(?:\s*,[-–])?(?![\d])/g)) {
    const whole = Number(m[1]);
    const cents = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    out.push(whole + cents / 100);
  }
  return out;
}

const same = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** Tijden in een tekst als "HH:MM": 11:00, 11.00, 11 uur, 11u */
export function times(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/(?<![\d,.])([01]?\d|2[0-3])(?:[:.]([0-5]\d)|\s*(?:uur|u)\b)/g)) out.push(`${m[1].padStart(2, "0")}:${m[2] ?? "00"}`);
  return out;
}

const hhmm = (v: unknown) => {
  const m = typeof v === "string" ? /^(\d{1,2})[:.](\d{2})$/.exec(v.trim()) : null;
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
};

// Onderwerp: een tijd of prijs van verhuur, receptie of voorzieningen hoort niet bij de camperplaats
const RENTAL = /\b(chalets?|huuraccommodaties?|accommodaties?|huurtent(en)?|stacaravans?|bungalows?|lodges?|safaritent(en)?|glamping|hotel|kamers?|b&b|bed (?:&|and) breakfast|trekkershut(ten)?|groepsaccommodaties?|vakantiewoning(en)?|vakantiehui(s|zen)|appartement(en)?|tiny ?houses?|cottages?|huisjes?|pipowagen|receptie|winkel|restaurant|zwembad|sauna|ontbijt|arrangement(en)?)\b/;
const PITCH = /camper|kampeerauto|kampeerplaats|camperplaats|camperplek|standplaats|staanplaats|kampeerplek|plaats per nacht|plek per nacht|stellplatz|motorhome|kampeerders/;

/**
 * Het zinsdeel van een citaat met de vertrektijd zelf: "Vertrek vóór 11.30 uur, de chalets voor 10.00 uur" gaat met
 * 11:30 niet over de chalets, en "uitcheck is om 11:00 uur voor kampeerders en 10:00 uur voor de accommodaties" ook niet
 * (26 november 2026). Zonder tijd (vrij, per 24 uur) of zonder herkenbaar zinsdeel: het hele citaat, zoals voorheen.
 */
export function rentalPart(q: string, checkout: string | null): string {
  if (!checkout) return q;
  const [h, m] = checkout.split(":").map(Number);
  const t = new RegExp(String.raw`\b0?${h}(?:[:.]${String(m).padStart(2, "0")}|\s*(?:uur|u\b|a\.?m\.?))`);
  const parts = q.split(/[,;(]|\s+en\s+(?=\d|voor|om|tot|de |het )/);
  const hit = parts.filter((x) => t.test(x));
  return hit.length === 1 ? hit[0] : q;
}
// Woorden vlak vóór een bedrag die het bedrag tot een toeslag maken
const EXTRA = /(toeristen\s?belasting|toeristenbijdrage|hond(en)?|huisdier(en)?|stroom|elektra|kwh|douche|extra (persoon|personen|volwassene|kind)|per persoon|p\.?p\.?|kind(eren)?|bezoek(ers)?|auto|aanhanger|boot|wasmachine|borg)\W{0,12}(?:[a-z.]+\W{0,4}){0,3}$/;

// Woorden vlak ná een bedrag die het tot een toeslag maken ("€ 12,50 per persoon", "€ 3,50 voor stroom")
const EXTRA_AFTER = /^[\d.,\s-]*(?:€|euro|eur)?\s*(per (persoon|hond|kind|kwh|douche)|p\.?\s?p\.?|pp\b|voor (de |het )?(stroom|elektra|hond|douche|bezoek)|toeslag)/;

const WORDS: Record<string, number> = { een: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, veertien: 14 };

/**
 * Controleer elk feit van het model tegen de tekst. Wat niet letterlijk te onderbouwen is, valt weg (met reden). Wat
 * overblijft is een voorstel, geen feit: Beheer beslist in de Triage Inbox.
 */
// Steekproef van 70 voorstellen (21 november 2026): deze woorden maakten een tijd, maat of duur tot een uitzondering
// ("aankomst na 11.00 alleen bij topdrukte", "uitchecken tot 10:00 op doordeweekse dagen", "max. 5 dagen laagseizoen")
const CONDITION = /\b(alleen (bij|op|in|tijdens|voor)|topdrukte|bij drukte|in drukke (tijden|periodes?)|drukke dagen|doordeweek\w*|in het weekend|weekenddagen|in de winter|winterperiode|in de zomer|hoogseizoen|laagseizoen|als we de plek\w* nodig|indien|wanneer de plek)/;
// Trekkersplekken voor wandelaars en fietsers: geen tarief of regel voor campers
const HIKERS = /\b(trekkers?(veld|plaats|tarief|hut)?|wandelaars?|fietsers?)\b/;
// "Langer dan 6 meter: toeslag" of een tariefregel is geen maximum ("Camper groter dan 6 meter | 5,50"); "langer dan 8
// meter niet toegestaan" wel. Langer/groter dan telt dus alleen met een verbod erbij.
const LENGTH_NOT_MAX = /extra kosten|toeslag|moeilijk|beperkt|draaicirkel|€|euro|per nacht|enkele plaatsen/;
const lengthIsMax = (q: string) =>
  !LENGTH_NOT_MAX.test(q) && (!/langer dan|groter dan/.test(q) || /\b(niet|geen)\b/.test(q));
// Gesloten alleen bij taal die blijvend is; "momenteel gesloten, vanaf maart weer open" is een winterstop
const CLOSED_FOR_GOOD = /definitief|tot nader order|onbepaalde tijd|opgeheven|gestopt|bestaat niet meer|niet meer (open|mogelijk|beschikbaar)/;

export function verifyAnswer(a: AiAnswer, text: string): Verdict {
  const proposals: Proposal[] = [];
  const rejected: string[] = [];
  const fail = (field: string, why: string) => rejected.push(`${field}: ${why}`);

  // Vertrekregel: dezelfde citaatcontrole als de zoekagenten (quote.ts): de zin moet op de pagina staan, de tijd in de
  // zin, en `confirmed` zegt of de eigen extractor er met zijn zinfilters (verhuur, doelgroep, voorwaarde) hetzelfde leest
  const rule = a.vertrekregel;
  if (rule === "vrij" || rule === "per24" || rule === "vast") {
    const url = quoteSource(a.vertrek_citaat, text);
    const checkout = rule === "vast" ? hhmm(a.vertrektijd) : null;
    const q = String(a.vertrek_citaat ?? "");
    if (url === undefined) fail("vertrek", "citaat niet letterlijk in de tekst");
    else if (rule === "vast" && !checkout) fail("vertrek", "vaste regel zonder geldige tijd");
    else if (RENTAL.test(rentalPart(norm(q), checkout)) && !PITCH.test(rentalPart(norm(q), checkout))) fail("vertrek", "citaat gaat over verhuur of een voorziening");
    else if (rule === "vrij" && !DEPARTURE_WORD.test(norm(q))) fail("vertrek", "citaat gaat niet over vertrekken");
    else if (rule === "vrij" && SOFT_FREE.test(norm(q))) fail("vertrek", "geen vrij vertrek, alleen soepel of in overleg");
    else if (CONDITION.test(norm(q))) fail("vertrek", "regel geldt alleen onder een voorwaarde");
    // "Vertrek vóór 17:00 uur i.p.v. 11:00 uur" is een betaalde late vertrektijd, geen regel
    else if (/i\.\s?p\.\s?v\.?|in plaats van|laat vertrek|later vertrek|late check-?out/.test(norm(q))) fail("vertrek", "citaat gaat over later vertrekken");
    else if (HIKERS.test(norm(q)) && !PITCH.test(norm(q))) fail("vertrek", "citaat gaat over trekkers");
    else {
      const check = checkQuote({ departure: rule as QuoteAnswer["departure"], checkout, quote: q }, forCheck(text));
      if (!check) fail("vertrek", "citaat onderbouwt de regel of tijd niet");
      // Per 24 uur alleen als de extractor het zelf ook leest ("hond € 1,- per 24 uur" is een toeslag, review R56);
      // vrij zonder bevestiging alleen bij een letterlijke zin als "geen vaste vertrektijd"
      else if (!check.confirmed && (rule === "per24" || (rule === "vrij" && !PLAIN_FREE.test(norm(q)))))
        fail("vertrek", "de extractor leest uit deze zin geen vertrekregel");
      else {
        proposals.push({ field: "departure", value: rule, quote: q, url, confirmed: check.confirmed });
        if (rule === "vast") proposals.push({ field: "checkout_until", value: checkout, quote: q, url, confirmed: check.confirmed });
      }
    }
  }

  // Tijden van aankomst
  const timeField = (field: string, value: unknown, quote: unknown, key: RegExp, lo: number, hi: number) => {
    if (value == null) return;
    const t = hhmm(value);
    const url = quoteSource(quote, text);
    const q = norm(String(quote ?? ""));
    if (!t) return fail(field, "geen geldige tijd");
    if (url === undefined) return fail(field, "citaat niet letterlijk in de tekst");
    if (!times(q).includes(t)) return fail(field, "tijd staat niet in het citaat");
    const hour = Number(t.slice(0, 2));
    if (hour < lo || hour > hi) return fail(field, "tijd buiten het gebruikelijke bereik");
    if (!key.test(q)) return fail(field, "citaat gaat niet over aankomst");
    if (CONDITION.test(q)) return fail(field, "tijd geldt alleen onder een voorwaarde");
    if (HIKERS.test(q) && !PITCH.test(q)) return fail(field, "citaat gaat over trekkers");
    // "Verwacht je dat je aankomst later is dan 16.00 uur? Neem contact op" is geen uiterste tijd
    if (field === "checkin_until" && /later (is )?dan|na \d{1,2}[:.]?\d{0,2}\s*(uur)?\s*(\?|bel|neem|graag)/.test(q)) return fail(field, "geen uiterste aankomsttijd");
    if (RENTAL.test(q) && !PITCH.test(q)) return fail(field, "citaat gaat over verhuur of een voorziening");
    proposals.push({ field, value: t, quote: String(quote), url, confirmed: false });
  };
  // Alleen met een woord over aankomen of inchecken: "Bar open tot 22:00" of "elektra vanaf 8 uur" is geen aankomsttijd
  const ARRIVE = /\b(aankom\w*|aangekomen|arriv\w*|incheck\w*|check[- ]?in|binnenrijden|binnenkomen|slagboom|welkom vanaf)/;
  timeField("checkin_from", a.aankomst_vanaf, a.aankomst_vanaf_citaat, ARRIVE, 6, 18);
  timeField("checkin_until", a.laatste_aankomst, a.laatste_aankomst_citaat, ARRIVE, 14, 23);

  // Nachtprijs: het bedrag staat in het citaat, het citaat gaat over de kampeerplaats, en het bedrag is geen toeslag
  if (a.nachtprijs != null) {
    const price = Number(a.nachtprijs);
    const url = quoteSource(a.nachtprijs_citaat, text);
    const raw = String(a.nachtprijs_citaat ?? "");
    const q = norm(raw);
    const at = amountIndex(q, price);
    if (!Number.isFinite(price) || price < 4 || price > 75) fail("prijs", "bedrag buiten 4 tot 75 euro");
    else if (url === undefined) fail("prijs", "citaat niet letterlijk in de tekst");
    else if (at < 0) fail("prijs", "bedrag staat niet in het citaat");
    else if (!/€|euro|eur\b|,-/.test(q)) fail("prijs", "citaat noemt geen bedrag in euro");
    else if (EXTRA.test(q.slice(Math.max(0, at - 40), at)) || EXTRA_AFTER.test(q.slice(at, at + 40))) fail("prijs", "bedrag is een toeslag");
    else if (RENTAL.test(q) && !PITCH.test(q)) fail("prijs", "citaat gaat over verhuur");
    else if (/\b(per week|per maand|per seizoen|jaarplaats|seizoensplaats)\b/.test(q)) fail("prijs", "geen prijs per nacht");
    else if (HIKERS.test(q) && !PITCH.test(q)) fail("prijs", "tarief voor trekkers");
    else if (/korte overnachting|dagtarief|dagbezoek|overdag/.test(q)) fail("prijs", "geen gewone nachtprijs");
    else proposals.push({ field: "price_eur", value: Math.round(price * 100) / 100, quote: raw, url, confirmed: false });
  }

  // Maximale lengte van de camper
  if (a.max_lengte_m != null) {
    const len = Number(a.max_lengte_m);
    const url = quoteSource(a.max_lengte_citaat, text);
    const q = norm(String(a.max_lengte_citaat ?? ""));
    if (!Number.isFinite(len) || len < 4 || len > 20) fail("lengte", "lengte buiten 4 tot 20 meter");
    else if (url === undefined) fail("lengte", "citaat niet letterlijk in de tekst");
    else if (!numbersIn(q).some((n) => same(n, len))) fail("lengte", "lengte staat niet in het citaat");
    // Getal en lengtewoord in hetzelfde zinsdeel: "max lengte 8 m, breedte 3 m" geeft 8, nooit 3
    else if (!clauses(q).some((c) => numbersIn(c).some((n) => same(n, len)) && LENGTH.test(c) && !/hoogte|hoog\b|breedte|breed\b|afstand|km\b/.test(c)))
      fail("lengte", "citaat gaat niet over de lengte");
    else if (!lengthIsMax(q)) fail("lengte", "geen maximum (toeslag, tarief of maar enkele plaatsen)");
    else proposals.push({ field: "max_length_m", value: len, quote: String(a.max_lengte_citaat), url, confirmed: false });
  }

  // Maximaal aantal nachten ("maximaal 3 nachten", "3 x 24 uur", "hooguit drie nachten")
  if (a.max_nachten != null) {
    const n = Number(a.max_nachten);
    const url = quoteSource(a.max_nachten_citaat, text);
    const q = norm(String(a.max_nachten_citaat ?? ""));
    // Aantal en "nacht" in hetzelfde zinsdeel: "maximaal 3 nachten, 2 honden" geeft 3, nooit 2
    const said = clauses(q)
      .filter((c) => /nacht|dagen|etmaal|x\s?24|24 uur/.test(c))
      .flatMap((c) => [...numbersIn(c), ...Object.entries(WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(c)).map(([, v]) => v)]);
    if (!Number.isInteger(n) || n < 1 || n > 30) fail("nachten", "aantal buiten 1 tot 30");
    else if (url === undefined) fail("nachten", "citaat niet letterlijk in de tekst");
    else if (!said.includes(n)) fail("nachten", "aantal staat niet in het citaat");
    else if (!/nacht|dagen|etmaal|x\s?24|24 uur|verblijf|blijven|staan/.test(q) || !/max|hooguit|ten hoogste|niet langer|maximum|tot\b|mag/.test(q))
      fail("nachten", "citaat noemt geen maximum");
    else if (CONDITION.test(q) || (HIKERS.test(q) && !PITCH.test(q))) fail("nachten", "maximum geldt alleen onder een voorwaarde of voor trekkers");
    else proposals.push({ field: "max_stay_nights", value: n, quote: String(a.max_nachten_citaat), url, confirmed: false });
  }

  // Gesloten: geen veld in de inbox, wel een melding voor Beheer
  let closed: Verdict["closed"] = null;
  if (a.gesloten === true) {
    const url = quoteSource(a.gesloten_citaat, text);
    const q = norm(String(a.gesloten_citaat ?? ""));
    if (url === undefined) fail("gesloten", "citaat niet letterlijk in de tekst");
    else if (!CLOSED_FOR_GOOD.test(q)) fail("gesloten", "geen blijvende sluiting (winterstop of tijdelijk)");
    else if (/seizoen|winter|tijdelijk|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|feestdag|\bvan\b.*\btot\b|tot en met|t\/m|receptie|zwembad|restaurant|winkel|sanitair/.test(q))
      fail("gesloten", "citaat gaat over een seizoen, dag of voorziening");
    else closed = { quote: String(a.gesloten_citaat), url };
  }

  return { proposals, closed, rejected };
}

/** Plaats van het bedrag in de tekst, of -1. Alleen een getal met € ervoor of ",-", "euro" erna is een bedrag. */
function amountIndex(q: string, price: number): number {
  for (const m of q.matchAll(/(?<![\d.,])(\d{1,3})(?:[.,](\d{1,2}))?(?:\s*,[-–])?(?![\d])/g)) {
    if (!amounts(m[0]).some((x) => same(x, price))) continue;
    const before = q.slice(Math.max(0, m.index! - 3), m.index!);
    const after = q.slice(m.index! + m[0].length, m.index! + m[0].length + 6);
    if (/€\s?$/.test(before) || /,[-–]$/.test(m[0]) || /^\s?(euro|eur\b)/.test(after)) return m.index!;
  }
  return -1;
}

/** Zinsdelen: een getal hoort bij het woord in hetzelfde deel */
const clauses = (q: string) => q.split(/[,;|]|\s(?:en|maar|of)\s/);
const LENGTH = /lengte|lang\b|langer|(camper|voertuig|kampeerauto)\w*\b.*\b(meter|\d\s?m)\b|(meter|\d\s?m)\b.*\b(camper|voertuig|kampeerauto)/;

/** Getallen met een decimaal ("7,5", "8.00") en hele getallen */
function numbersIn(q: string): number[] {
  return [...q.matchAll(/(?<![\d.,])(\d{1,3})(?:[.,](\d{1,2}))?(?![\d])/g)].map((m) => Number(m[1]) + (m[2] ? Number(`0.${m[2]}`) : 0));
}

/** Het antwoord van het model als JSON; bij onzin een leeg antwoord (dan levert de controle niets op) */
export function parseAnswer(raw: string): AiAnswer {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as AiAnswer) : {};
  } catch {
    return {};
  }
}
