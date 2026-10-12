/**
 * De beschrijving komt uit de meta-omschrijving van de website van de plek. Die is vaak afgekapt ("…", "Lees meer",
 * "[&hellip;]"), bevat losse links of is geen tekst over de plek (CMS-standaardzin, Duits, alleen trefwoorden).
 * We tonen alleen hele zinnen in het Nederlands; wat overblijft na het opschonen en te kort is, tonen we niet.
 * We schrijven zelf niets bij: geen tekst is beter dan een halve of verzonnen tekst.
 */

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", euro: "€" };

function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&([a-z]+);/gi, (all, n: string) => ENTITIES[n.toLowerCase()] ?? all);
}

/** Tekst die geen beschrijving van de plek is */
const BOILERPLATE = /joomla|wordpress|just another|lorem ipsum|cookie|javascript|coming soon|under construction|website (is )?in onderhoud|page not found|pagina niet gevonden|copyright|alle rechten/i;

/**
 * Geen lopende tekst: SEO-titels ("Camping X | Veluwe ✓ Wifi ✓"), prijslijsten (die staan al in het prijsblok en
 * kunnen verouderd zijn), telefoonnummers, kapotte tekens, of stukjes met "..." ertussen.
 */
const SCRAPED = /[|✓✔•►]|€\s?\d|\d+[.,]\d{2}\s?(euro|eur)\b|\b0\d[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}\b|Ã|â€|\s\.\.\.\s|\s…\s|%$|password|wachtwoord/i;
/** Aan elkaar geplakte stukken van de pagina: "CamperplaatsDe Bronckhorst", "ErkemederstrandDeze" */
const GLUED = /[a-zà-ÿ](?:De|Het|Een|Deze|Dit|Onze|Wij|Welkom|Op|In|Met|Bij)\s/;
/** Drie of meer woorden in hoofdletters achter elkaar */
const SHOUTING = /\b[A-Z]{3,}\s+[A-Z]{3,}\s+[A-Z]{3,}\b/;

const DUTCH = /\b(de|het|een|en|van|met|voor|op|is|zijn|je|u|wij|we|ons|onze|bij|aan|in|naar|ook|niet)\b/gi;
const FOREIGN = /\b(und|der|das|mit|für|wir|ist|sind|the|and|with|for|our|are|you)\b/gi;

/** "Over deze plek": hele zinnen uit de websitetekst, of undefined */
export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let s = decode(raw)
    // Losse links, ook "(https://svr.nl/)"; begint daarna een nieuwe zin, dan komt er een punt
    .replace(/\s*\(?\bhttps?:\/\/[^\s)]+\)?(?=\s+[A-Z])/g, ".")
    .replace(/\s*\(?\bhttps?:\/\/[^\s)]+\)?/gi, "")
    .replace(/\s*\bwww\.[^\s)]+/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Afgekapt door de website zelf: "…", "...", "[…]", "Lees meer" (soms vastgeplakt: "opLees meer")
  const cut = /(\s*\[?(?:…|\.\.\.|&hellip;)\]?|\s*(?:lees|read|meer|weiter)\s*(?:meer|verder|more|lesen|info|informatie)?\s*(?:»|›|>)?)\s*$/i;
  let truncated = false;
  for (let i = 0; i < 3 && cut.test(s); i++) {
    s = s.replace(cut, "");
    truncated = true;
  }
  if (/[a-zà-ÿ](?:Lees meer|Lees verder|Read more|Meer info)/.test(raw)) truncated = true;

  // Een punt zonder spatie erachter ("heuvelland.Met slechts") is een gemiste zinsgrens
  s = s.replace(/([a-zà-ÿ)])\.([A-Z])/g, "$1. $2").trim();

  // Een korte zin zonder punt is meestal gewoon af; een lange is waarschijnlijk afgekapt (meta-omschrijvingen
  // worden rond 155 tekens afgebroken)
  if (!truncated && !/[.!?)"”’]$/.test(s) && s.length < 140) s += ".";

  // Alleen hele zinnen: knip na de laatste zin die netjes eindigt
  if (truncated || !/[.!?)"”’]$/.test(s)) {
    const end = Math.max(s.lastIndexOf(". "), s.lastIndexOf("! "), s.lastIndexOf("? "), /[.!?]$/.test(s) && !truncated ? s.length - 1 : -1);
    if (end < 0) return undefined;
    s = s.slice(0, end + 1).trim();
  }

  if (s.length < 40 || BOILERPLATE.test(s) || SCRAPED.test(s) || GLUED.test(s) || SHOUTING.test(s)) return undefined;
  // Geen Nederlandse tekst (Duitse of Engelse omschrijving): niet tonen, de site is Nederlands eerst
  const nl = s.match(DUTCH)?.length ?? 0;
  const other = s.match(FOREIGN)?.length ?? 0;
  if (other > nl) return undefined;
  // Alleen trefwoorden of schreeuwen
  if (s.replace(/[^A-Z]/g, "").length > s.length * 0.3) return undefined;
  return s;
}
