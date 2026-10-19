import { perPersonPrice, type Extra } from "./trip-extras";

const eurFmt = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const eurRound = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function eur(n: number, round = false): string {
  if (round || Number.isInteger(n)) return eurRound.format(n);
  return eurFmt.format(n);
}

export function priceLabel(priceEur?: number, from?: boolean): string {
  if (priceEur === undefined) return "Prijs onbekend";
  if (priceEur === 0) return "Gratis";
  return from ? `vanaf ${eur(priceEur)}` : eur(priceEur);
}

/** Booking-achtige woordlabels bij een score op 10 */
export function scoreWord(score: number): string {
  if (score >= 9) return "Uitzonderlijk";
  if (score >= 8.5) return "Fantastisch";
  if (score >= 8) return "Heel goed";
  if (score >= 7) return "Goed";
  if (score >= 6) return "Redelijk";
  return "Matig";
}

export function scoreLabel(n: number) {
  return n.toFixed(1).replace(".", ",");
}

// Altijd Nederlandse tijd: de server draait in UTC, dus rond middernacht zou een andere dag verschijnen
const dateFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

export function formatMonth(iso: string) {
  return monthFmt.format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} u ${rest} min` : `${h} uur`;
}

export function pluralize(n: number, one: string, many: string) {
  return `${new Intl.NumberFormat("nl-NL").format(n)} ${n === 1 ? one : many}`;
}

export function websiteLabel(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** "11:30" of "9.00" als minuten na middernacht; undefined als het geen geldige tijd is */
export function timeToMinutes(t?: string): number | undefined {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(t ?? "");
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : undefined;
}

type Departure = { departure?: "vrij" | "per24" | "vast"; checkoutUntil?: string; departureCheck?: "bevestigd" | "voorwaardelijk" | "afgewezen" };

/**
 * Korte vertrekregel voor kaarten, kaartpopup en kerngegevens; undefined = onbekend. Een regel uit een bron (website,
 * zoekagent met letterlijk citaat, OSM) is genoeg (besluit eigenaar 18 oktober 2026); alleen een door beheer
 * afgewezen regel tonen we niet.
 */
export function departureShort(p: Departure): string | undefined {
  if (p.departure === "vrij" || p.departure === "per24") {
    const per24 = p.departure === "per24";
    if (p.departureCheck === "afgewezen") return undefined;
    if (p.departureCheck === "voorwaardelijk") return per24 ? "Meestal per 24 uur" : "Meestal geen vaste vertrektijd";
  }
  if (p.departure === "vrij") return "Geen vaste vertrektijd";
  if (p.departure === "per24") return "Per 24 uur, geen vaste tijd";
  // Een tijd die we niet kunnen lezen tonen we niet; zo komt de tekst overeen met departureKind
  if (p.departure === "vast") return timeToMinutes(p.checkoutUntil) !== undefined ? `Vertrek uiterlijk ${p.checkoutUntil}` : "Vaste vertrektijd";
  return undefined;
}

/** Vertrekregel op de plekpagina (blok "Vertrekken"); "Onbekend" als we het niet weten */
export function departureLong(p: Departure): string {
  const claimed = p.departure === "vrij" || p.departure === "per24";
  const per24 = p.departure === "per24";
  if (!p.departure || (claimed && p.departureCheck === "afgewezen")) return "Onbekend";
  if (claimed && p.departureCheck === "voorwaardelijk") return per24 ? "Meestal per 24 uur" : "Meestal geen vaste tijd";
  if (p.departure === "vrij") return "Geen vaste vertrektijd";
  if (per24) return "Geen vaste tijd, je betaalt per 24 uur";
  return timeToMinutes(p.checkoutUntil) !== undefined ? `Uiterlijk ${p.checkoutUntil}` : "Vaste vertrektijd";
}

/**
 * De bronzin onder de vertrektijd op de plekpagina, klein en gedempt (besluit eigenaar 19 oktober 2026):
 * "Bron: “…” (website)". Geeft undefined als er geen bronzin is. Het citaat blijft letterlijk; we halen alleen
 * de technische voorvoegsels ("AI-lezer: ", "(bron: url)") weg.
 */
export function timesSourceLine(note?: string): string | undefined {
  let q = note?.replace(/\s+/g, " ").trim();
  if (!q) return undefined;
  if (/^volgens openstreetmap/i.test(q)) return "Bron: OpenStreetMap";
  q = q.replace(/^AI-lezer:\s*/i, "");
  let source = "website";
  const m = /\s*\(bron: (https?:\/\/[^\s)]+)\)$/i.exec(q);
  if (m) {
    q = q.slice(0, m.index).trim();
    try {
      source = new URL(m[1]).hostname.replace(/^www\./, "");
    } catch {
      // onleesbare url: dan blijft het "website"
    }
  }
  if (/^volgens de gegevens op de website/i.test(q)) return `Bron: gegevens op de ${source}`;
  if (!q) return `Bron: ${source}`;
  return `Bron: “${q}” (${source})`;
}

/** "Toeristenbelasting € 1,35 per persoon per nacht" */
export function extraLabel(x: { label: string; amount: number; unit?: string }): string {
  return `${eur(x.amount)}${x.unit ? ` ${x.unit}` : ""}`;
}

/**
 * Prijs voor kaarten, kaartpopup en plekpagina: de nachtprijs, of als die ontbreekt de prijs per persoon volgens
 * dezelfde regel als Mijn reis (`perPersonPrice`). `perNight` zegt of het bedrag per nacht is; `extras` of er nog
 * andere toeslagen bekend zijn. undefined = prijs onbekend.
 */
export function cardPrice(p: { priceEur?: number; priceFrom?: boolean; priceExtras?: Extra[] }):
  | { value: string; perNight: boolean; perPerson: boolean; extras: boolean }
  | undefined {
  const extras = p.priceExtras ?? [];
  if (p.priceEur !== undefined) return { value: priceLabel(p.priceEur, p.priceFrom), perNight: p.priceEur > 0, perPerson: false, extras: extras.length > 0 };
  const pp = perPersonPrice(p);
  if (pp) return { value: `${eur(pp.amount)} p.p.`, perNight: pp.perNight, perPerson: true, extras: extras.some((x) => x !== pp.extra) };
  return undefined;
}

/** Tekst bij een kaartmarker: dezelfde prijs als op de kaart in de lijst, met "+" bij een vanaf-prijs; leeg = onbekend */
export function markerPrice(p: { priceEur?: number; priceFrom?: boolean; priceExtras?: Extra[] }): string {
  const price = cardPrice(p);
  if (!price) return "";
  return p.priceFrom && p.priceEur !== undefined ? `${price.value.replace(/^vanaf /, "")}+` : price.value;
}
