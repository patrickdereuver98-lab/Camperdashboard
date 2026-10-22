// Controle op een letterlijk citaat. De zoekagenten (actie "verify") leveren per plek een zin en een bron-URL; we nemen
// het alleen over als die zin echt op de pagina staat en de tijd of de "geen vaste tijd"-uitspraak er zelf in staat.
// Zo blijft "nooit verzinnen" gelden. (De AI-lezer die hier eerst stond is geschrapt, besluit eigenaar 19 oktober 2026.)

export type QuoteAnswer = { departure: "vrij" | "per24" | "vast" | "onbekend"; checkout: string | null; quote: string | null };

const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').trim();

/**
 * Het antwoord alleen overnemen als het te controleren is: de zin staat letterlijk in de tekst, en de tijd of de
 * vrij-uitspraak staat in die zin zelf. Geeft de velden voor de database terug, of null.
 */
export function verify(a: QuoteAnswer, text: string): Record<string, unknown> | null {
  if (a.departure === "onbekend" || !a.quote || a.quote.length < 12) return null;
  const q = norm(a.quote);
  if (!norm(text).includes(q)) return null;
  if (a.departure === "vast") {
    const m = /^(\d{1,2}):(\d{2})$/.exec(a.checkout ?? "");
    if (!m) return null;
    const hour = Number(m[1]);
    if (hour < 7 || hour > 14 || Number(m[2]) > 59) return null;
    // De tijd moet in de zin staan: 11:00, 11.00, 11 uur of 11u
    const t = new RegExp(String.raw`\b0?${hour}(?:[:.]${m[2]}|\s*(?:uur|uhr|u\b|h\b))`);
    if (!t.test(q)) return null;
    return { departure: "vast", checkout_until: `${String(hour).padStart(2, "0")}:${m[2]}`, times_note: a.quote.slice(0, 290) };
  }
  const free = /geen (vaste )?(aankomst|vertrek|uitcheck|check-?out)|wanneer (je|u) (wilt|wil)|elk (gewenst )?(moment|tijdstip)|vrije? (aankomst|vertrek)|keine (festen )?(an|ab)|jederzeit|any ?time|24 uur|24 stunden|24 hours/;
  if (!free.test(q)) return null;
  return { departure: a.departure, times_note: a.quote.slice(0, 290) };
}
