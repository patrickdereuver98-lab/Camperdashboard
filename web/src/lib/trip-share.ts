import { departureShort, pluralize } from "./format";
import type { PlaceSummary } from "./types";

/**
 * Mijn reis als tekst en als agenda (UX-audit november). Alleen wat we weten: onbekende tijden laten we weg, we vullen
 * niets in. Alles gebeurt op het toestel; er gaat niets naar een agenda- of deeldienst.
 */

type Stop = {
  nights: number;
  place: Pick<PlaceSummary, "slug" | "name" | "town" | "checkinFrom" | "checkinUntil" | "departure" | "checkoutUntil" | "departureCheck">;
  /** Eigen punt: alleen de naam gaat mee (geen ligging, geen plaatsnaam) */
  own?: boolean;
  notes?: { text: string; shared?: boolean }[];
};
type Dated = { arrive: Date; leave: Date };

const DAY = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" });

/**
 * "1. Camperplaats De Duinen, Texel (2 nachten, do 6 nov. tot za 8 nov.)" per regel; voor WhatsApp-groepen. Een eigen
 * punt staat er met alleen zijn naam. Alleen notities met "Delen met reisgenoten" aan gaan mee; privénotities niet.
 */
export function tripText(stops: Stop[], dated: Dated[] | null): string {
  const lines = stops.flatMap((s, i) => {
    const when = dated?.[i] ? `, ${DAY.format(dated[i].arrive)} tot ${DAY.format(dated[i].leave)}` : "";
    const stay = s.nights === 0 ? "tussenstop" : pluralize(s.nights, "nacht", "nachten");
    const head = s.own ? `${i + 1}. ${s.place.name} (eigen punt, ${stay}${when})` : `${i + 1}. ${s.place.name}, ${s.place.town} (${stay}${when})`;
    const notes = (s.notes ?? []).filter((n) => n.shared).map((n) => `   Notitie: ${n.text.trim().replace(/\s*\n\s*/g, " ")}`);
    return [head, ...notes];
  });
  return ["Mijn camperreis", ...lines].join("\n");
}

const pad = (n: number) => String(n).padStart(2, "0");
const icsDate = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
// RFC 5545: komma, puntkomma en backslash escapen, regeleinden als \n
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
// Regels langer dan 75 tekens vouwen (met een spatie aan het begin van de vervolgregel)
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

/** Een agendabestand (.ics) met per stop een afspraak van aankomst tot vertrek (hele dagen) */
export function tripIcs(stops: Stop[], dated: Dated[], siteUrl: string, now: Date = new Date()): string {
  const stamp = `${icsDate(now)}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const events = stops.flatMap((s, i) => {
    const d = dated[i];
    if (!d) return [];
    const facts = [
      s.place.checkinFrom && s.place.checkinUntil ? `Aankomen tussen ${s.place.checkinFrom} en ${s.place.checkinUntil}` : s.place.checkinUntil ? `Aankomen tot ${s.place.checkinUntil}` : undefined,
      departureShort(s.place),
      `${siteUrl}/plek/${s.place.slug}`,
    ].filter(Boolean) as string[];
    return [
      "BEGIN:VEVENT",
      `UID:${s.place.slug}-${icsDate(d.arrive)}@vrijstaan`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(d.arrive)}`,
      `DTEND;VALUE=DATE:${icsDate(d.leave)}`,
      `SUMMARY:${esc(`Camper: ${s.place.name}`)}`,
      `LOCATION:${esc(s.place.town)}`,
      `DESCRIPTION:${esc(facts.join("\n"))}`,
      `URL:${siteUrl}/plek/${s.place.slug}`,
      "END:VEVENT",
    ];
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VrijStaan//Mijn reis//NL",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n");
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Reisdag (UX-audit): wat er vandaag speelt. Vertrek je vandaag ergens, dan die stop en waar je heen gaat; sta je
 * vannacht ergens, dan die stop. Buiten de reis: niets.
 */
export function tripToday(dated: Dated[], today: Date): { tonight?: number; leaving?: number } | undefined {
  const leaving = dated.findIndex((d) => sameDay(d.leave, today));
  const tonight = dated.findIndex((d) => d.arrive <= today && today < d.leave && !sameDay(d.leave, today));
  const result = { ...(leaving >= 0 ? { leaving } : {}), ...(tonight >= 0 ? { tonight } : {}) };
  return Object.keys(result).length ? result : undefined;
}
