// Controle op een letterlijk citaat. De zoekagenten (actie "verify") leveren per plek een zin en een bron-URL; we nemen
// het alleen over als die zin echt op de pagina staat en de extractor er zelf dezelfde regel en tijd uit leest, met
// dezelfde zinfilters (verhuur, receptie, doelgroep, voorwaarde, vraag). Zo blijft "nooit verzinnen" gelden.
// (De AI-lezer die hier eerst stond is geschrapt, besluit eigenaar 19 oktober 2026.)
// Staat de zin er wel, maar leest de extractor er iets anders uit ("Onze chalets: uitchecken voor 10 uur", "bereikbaar
// 24 uur per dag via de noodlijn"), dan is het hooguit een inzending voor Beheer, nooit een automatische overname
// (review november 2026, R18).

import { sentenceDeparture } from "./extract.ts";

export type QuoteAnswer = { departure: "vrij" | "per24" | "vast" | "onbekend"; checkout: string | null; quote: string | null };

/** Uitkomst van de controle: `confirmed` = de extractor leest op deze zin dezelfde regel en tijd */
export type QuoteCheck = { fields: Record<string, unknown>; confirmed: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').trim();

/**
 * Staat het citaat letterlijk op de pagina, met de tijd of de vrij-uitspraak in de zin zelf? Dan de velden, met
 * `confirmed` als de extractor er hetzelfde uit leest. Anders null (niet overnemen en geen inzending).
 */
export function checkQuote(a: QuoteAnswer, text: string): QuoteCheck | null {
  if (a.departure === "onbekend" || !a.quote || a.quote.length < 12) return null;
  const q = norm(a.quote);
  const page = norm(text);
  const at = page.indexOf(q);
  if (at < 0) return null;
  // De extractor leest de hele zin waarin het citaat staat, niet alleen het citaat: "het vertrek vóór 10.00 uur" uit "In
  // onze chalets en lodges is het vertrek vóór 10.00 uur" gaat over de chalets (review R63)
  const found = sentenceDeparture(wholeSentence(page, at, at + q.length));
  if (a.departure === "vast") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(a.checkout ?? "");
    if (!m) return null;
    const hour = Number(m[1]);
    if (hour < 7 || hour > 14 || Number(m[2]) > 59) return null;
    // De tijd moet in de zin staan: 11:00, 11.00, 11 uur of 11u
    const t = new RegExp(String.raw`\b0?${hour}(?:[:.]${m[2]}|\s*(?:uur|uhr|u\b|h\b|a\.?m\.?))`);
    if (!t.test(q)) return null;
    const checkout = `${String(hour).padStart(2, "0")}:${m[2]}`;
    return {
      fields: { departure: "vast", checkout_until: checkout, times_note: a.quote.slice(0, 290) },
      confirmed: found.departure === "vast" && found.checkout_until === checkout,
    };
  }
  const free = /geen ((vaste|verplichte|precieze|strakke|speciale|specifieke|vastgestelde) )?(aankomst|vertrek|uitcheck|check-?out)|wanneer (je|u) (wilt|wil)|elk (gewenst )?(moment|tijdstip)|vrije? (aankomst|vertrek)|keine (festen )?(an|ab)|jederzeit|any ?time|24 uur|24 stunden|24 hours/;
  if (!free.test(q) && !found.departure) return null;
  return { fields: { departure: a.departure, times_note: a.quote.slice(0, 290) }, confirmed: found.departure === a.departure };
}

/** De hele zin rond [from, to) in genormaliseerde tekst; een decimaal ("10.00") is geen zinseinde */
export function wholeSentence(page: string, from: number, to: number): string {
  const end = /(?<!\d)[.!?](?!\d)|\s\|\s|\n/g;
  let s = 0;
  let e = page.length;
  for (const m of page.matchAll(end)) {
    if (m.index! < from) s = m.index! + m[0].length;
    else if (m.index! >= to) {
      e = m.index!;
      break;
    }
  }
  return page.slice(s, e).trim();
}

/** Alleen een bevestigd citaat: de velden voor de database, of null */
export function verify(a: QuoteAnswer, text: string): Record<string, unknown> | null {
  const c = checkQuote(a, text);
  return c?.confirmed ? c.fields : null;
}
