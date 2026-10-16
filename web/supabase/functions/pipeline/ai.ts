// AI-lezer: alleen als de vaste regels in extract.ts geen vertrektijd vinden, maar er wel over vertrekken wordt
// geschreven. Het taalmodel moet de letterlijke zin teruggeven; we nemen het antwoord alleen over als die zin echt op
// de pagina staat en de tijd of de "geen vaste tijd"-uitspraak er zelf in staat. Zo blijft "nooit verzinnen" gelden.

export type AiAnswer = { departure: "vrij" | "per24" | "vast" | "onbekend"; checkout: string | null; quote: string | null };

const HINT = /vertrek|uitcheck|check-?out|auschecken|abreise|departure|aankomst en vertrek|per 24 uur|24 uur/gi;

/** Alleen de stukken tekst rond vertrekwoorden (goedkoop en gericht), hoogstens `max` tekens */
export function passages(text: string, max = 6000): string {
  const windows: [number, number][] = [];
  for (const m of text.matchAll(HINT)) {
    const s = Math.max(0, m.index! - 250);
    const e = Math.min(text.length, m.index! + 250);
    const last = windows[windows.length - 1];
    if (last && s <= last[1]) last[1] = e;
    else windows.push([s, e]);
  }
  let out = "";
  for (const [s, e] of windows) {
    const piece = text.slice(s, e).trim();
    if (out.length + piece.length + 5 > max) break;
    out += (out ? "\n---\n" : "") + piece;
  }
  return out;
}

export const needsAi = (text: string) => new RegExp(HINT.source, "i").test(text);

export const SYSTEM = `Je leest tekst van de website van een Nederlandse camping of camperplaats. Bepaal hoe laat een camper (kampeerplaats, staanplaats) uiterlijk weg moet op de dag van vertrek.

Regels:
- Gebruik alleen wat er letterlijk staat. Raad nooit. Twijfel je, antwoord "onbekend".
- "vrij": de tekst zegt dat er geen vaste vertrektijd is, of dat je vertrekt wanneer je wilt.
- "per24": je betaalt per 24 uur vanaf aankomst, zonder klokvaste vertrektijd.
- "vast": er staat een uiterlijke vertrektijd voor kampeerplaatsen. Geef die als HH:MM.
- Tijden voor chalets, verhuur, hotelkamers, de receptie of de slagboom tellen niet. "Later vertrekken tegen toeslag" is geen vertrektijd. Een tijd die alleen geldt bij drukte of in het hoogseizoen: "onbekend".
- quote: kopieer de ene zin waarop je antwoord rust exact, teken voor teken, uit de tekst. Bij "onbekend": null.`;

/** JSON-schema voor de uitvoer (gestructureerde uitvoer van de Messages API) */
export const SCHEMA = {
  type: "object",
  properties: {
    departure: { type: "string", enum: ["vrij", "per24", "vast", "onbekend"] },
    checkout: { type: ["string", "null"], description: "HH:MM bij vast, anders null" },
    quote: { type: ["string", "null"], description: "De letterlijke zin uit de tekst" },
  },
  required: ["departure", "checkout", "quote"],
  additionalProperties: false,
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[\s ]+/g, " ").replace(/[‘’`´]/g, "'").replace(/[“”]/g, '"').trim();

/**
 * Het antwoord alleen overnemen als het te controleren is: de zin staat letterlijk in de tekst, en de tijd of de
 * vrij-uitspraak staat in die zin zelf. Geeft de velden voor de database terug, of null.
 */
export function verify(a: AiAnswer, text: string): Record<string, unknown> | null {
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
    return { departure: "vast", checkout_until: `${String(hour).padStart(2, "0")}:${m[2]}`, times_note: `AI-lezer: ${a.quote.slice(0, 290)}` };
  }
  const free = /geen (vaste )?(aankomst|vertrek|uitcheck|check-?out)|wanneer (je|u) (wilt|wil)|elk (gewenst )?(moment|tijdstip)|vrije? (aankomst|vertrek)|keine (festen )?(an|ab)|jederzeit|any ?time|24 uur|24 stunden|24 hours/;
  if (!free.test(q)) return null;
  return { departure: a.departure, times_note: `AI-lezer: ${a.quote.slice(0, 290)}` };
}
