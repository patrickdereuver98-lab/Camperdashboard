// Mijn reis naar buiten: Google Maps (in delen, want Google neemt maar 9 tussenpunten), GPX voor het
// navigatiesysteem in de camper, en een agendabestand (.ics) met de overnachtingen.
import type { LatLng } from "./geo";

/** Google Maps neemt in een routelink maximaal 9 tussenpunten (plus vertrek en bestemming) */
export const GMAPS_MAX_WAYPOINTS = 9;

export interface GmapsPart {
  url: string;
  /** Stopnummers (1-based, zoals in de lijst) die in dit deel zitten */
  from: number;
  to: number;
}

const ll = (p: LatLng) => `${p.lat},${p.lng}`;

/**
 * Routelinks voor Google Maps. Zonder beginpunt begint het eerste deel bij je huidige locatie (zoals Google Maps
 * standaard doet). Elk volgend deel begint waar het vorige eindigde, zodat er geen stop wegvalt.
 */
export function googleMapsParts(stops: LatLng[], start?: LatLng | null, end?: LatLng | null): GmapsPart[] {
  const pts = [...stops, ...(end ? [end] : [])];
  if (!pts.length) return [];
  const parts: GmapsPart[] = [];
  let origin: LatLng | null = start ?? null;
  let i = 0;
  // Zonder beginpunt: het eerste deel heeft geen origin; dan mogen er 9 tussenpunten en 1 bestemming in
  while (i < pts.length) {
    const take = Math.min(pts.length - i, GMAPS_MAX_WAYPOINTS + 1);
    const chunk = pts.slice(i, i + take);
    const dest = chunk[chunk.length - 1];
    const q = new URLSearchParams({ api: "1", destination: ll(dest), travelmode: "driving" });
    if (origin) q.set("origin", ll(origin));
    if (chunk.length > 1) q.set("waypoints", chunk.slice(0, -1).map(ll).join("|"));
    const lastStop = Math.min(i + take, stops.length);
    parts.push({ url: `https://www.google.com/maps/dir/?${q}`, from: i + 1, to: lastStop });
    origin = dest;
    i += take;
  }
  return parts;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const coord = (n: number) => n.toFixed(6);

export interface ExportStop extends LatLng {
  name: string;
  /** Korte uitleg: plaats, nachten, vertrekregel */
  desc?: string;
  url?: string;
}

/**
 * GPX 1.1 met de stops als waypoints, als route (rtept: het navigatiesysteem rekent zelf, met je camperprofiel) en,
 * als we die hebben, de lijn over de weg als track.
 */
export function buildGpx(name: string, points: ExportStop[], geometry?: [number, number][] | null): string {
  const wpt = points
    .map(
      (p) =>
        `  <wpt lat="${coord(p.lat)}" lon="${coord(p.lng)}"><name>${xml(p.name)}</name>${p.desc ? `<desc>${xml(p.desc)}</desc>` : ""}${
          p.url ? `<link href="${xml(p.url)}"><text>${xml(p.name)}</text></link>` : ""
        }</wpt>`,
    )
    .join("\n");
  const rte = points.map((p) => `    <rtept lat="${coord(p.lat)}" lon="${coord(p.lng)}"><name>${xml(p.name)}</name></rtept>`).join("\n");
  const trk =
    geometry && geometry.length > 1
      ? `\n  <trk><name>${xml(name)}</name><trkseg>\n${geometry.map(([lng, lat]) => `    <trkpt lat="${coord(lat)}" lon="${coord(lng)}"/>`).join("\n")}\n  </trkseg></trk>`
      : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VrijStaan" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(name)}</name></metadata>
${wpt}
  <rte><name>${xml(name)}</name>
${rte}
  </rte>${trk}
</gpx>
`;
}

// ── Agenda (iCalendar) ──────────────────────────────────────────────────────

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}${String(min % 60).padStart(2, "0")}00`;

/** Regels van meer dan 75 tekens vouwen (RFC 5545) */
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

export interface IcsStay {
  uid: string;
  name: string;
  arrive: Date;
  leave: Date;
  nights: number;
  location?: string;
  description?: string;
  url?: string;
  lat: number;
  lng: number;
}

export interface IcsDrive {
  uid: string;
  title: string;
  day: Date;
  departMin: number;
  arriveMin: number;
}

/** Agenda met de overnachtingen als hele dagen en, als bekend, de rijtijden als afspraken (lokale tijd) */
export function buildIcs(stays: IcsStay[], drives: IcsDrive[], now = new Date()): string {
  const stamp = `${ymd(now)}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}00Z`;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VrijStaan//Mijn reis//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const s of stays) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.uid}@vrijstaan.nl`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(s.arrive)}`,
      `DTEND;VALUE=DATE:${ymd(s.nights === 0 ? new Date(s.arrive.getFullYear(), s.arrive.getMonth(), s.arrive.getDate() + 1) : s.leave)}`,
      `SUMMARY:${icsText(s.nights === 0 ? `Tussenstop: ${s.name}` : `Camperplek: ${s.name}`)}`,
      `GEO:${s.lat.toFixed(5)};${s.lng.toFixed(5)}`,
      "TRANSP:TRANSPARENT",
    );
    if (s.location) lines.push(`LOCATION:${icsText(s.location)}`);
    if (s.description) lines.push(`DESCRIPTION:${icsText(s.description)}`);
    if (s.url) lines.push(`URL:${s.url}`);
    lines.push("END:VEVENT");
  }
  for (const d of drives) {
    // Aankomst na middernacht: de afspraak loopt door tot de volgende dag
    const endDay = new Date(d.day.getFullYear(), d.day.getMonth(), d.day.getDate() + Math.floor(d.arriveMin / 1440));
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.uid}@vrijstaan.nl`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd(d.day)}T${hm(d.departMin % 1440)}`,
      `DTEND:${ymd(endDay)}T${hm(d.arriveMin % 1440)}`,
      `SUMMARY:${icsText(d.title)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** Bestand laten downloaden in de browser */
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
