// Officiële bekendmakingen (besluit Patrick 20 november 2026, README 140): gemeenten publiceren vergunningen en besluiten
// voor camperplaatsen in het Gemeenteblad, vaak met adres en coördinaten. Dat is open overheidsdata (tier 1 in het
// bronnenbeleid) en vindt plekken die niet in OpenStreetMap staan. We nemen alleen titel, adres, plaats, datum en de link
// over; Beheer beslist of het een plek wordt (public.discovery_candidates).
//
// API: SRU 2.0 van repository.overheid.nl (gratis, zonder sleutel). Zuiver: ophalen gebeurt in index.ts.

import { decodeEntities } from "./extract.ts";

export const SRU = "https://repository.overheid.nl/sru";
export const PAGE_SIZE = 100;
/** Hoogstens zoveel pagina's per ronde (±1.500 publicaties); de ronde van volgende week pakt de rest */
export const MAX_PAGES = 15;

const TERMS = ["camperplaats", "camperstandplaats", "camperterrein", "camperplek", "kampeerauto"];
export const QUERY = `c.product-area==officielepublicaties AND (${TERMS.map((t) => `dt.title="${t}"`).join(" OR ")})`;

export function pageUrl(start: number): string {
  const q = new URLSearchParams({ operation: "searchRetrieve", version: "2.0", query: QUERY, maximumRecords: String(PAGE_SIZE), startRecord: String(start) });
  return `${SRU}?${q}`;
}

export type Candidate = {
  id: string;
  title: string;
  url: string;
  authority: string | null;
  type: string | null;
  street: string | null;
  postcode: string | null;
  town: string | null;
  date: string | null;
  lat: number | null;
  lng: number | null;
};

const first = (rec: string, tag: string) => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`).exec(rec);
  const v = m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
  return v || null;
};

/** Eén antwoordpagina naar kandidaten; records zonder titel of zonder link op zoek.officielebekendmakingen.nl vallen weg */
export function parsePage(xml: string): { items: Candidate[]; next: number | null; total: number } {
  const total = Number(/<sru:numberOfRecords>(\d+)</.exec(xml)?.[1] ?? 0);
  const nextRaw = /<sru:nextRecordPosition>(\d+)</.exec(xml)?.[1];
  const items: Candidate[] = [];
  for (const rec of xml.split("<sru:record>").slice(1)) {
    const id = first(rec, "dcterms:identifier");
    const title = first(rec, "dcterms:title");
    const url = first(rec, "gzd:preferredUrl");
    if (!id || !title || !url || !/^https:\/\/zoek\.officielebekendmakingen\.nl\//.test(url)) continue;
    // "53.0931776337648 7.14357567607883" (breedte, lengte)
    const point = /^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/.exec(first(rec, "overheidwetgeving:locatiepunt") ?? "");
    let lat = point ? Number(point[1]) : null;
    let lng = point ? Number(point[2]) : null;
    if (lat === null || lng === null || lat < 50.7 || lat > 53.7 || lng < 3.2 || lng > 7.3) lat = lng = null;
    const pc = first(rec, "overheidwetgeving:postcodeHuisnummer");
    const date = first(rec, "dcterms:available") ?? first(rec, "dcterms:modified");
    items.push({
      id: id.slice(0, 100),
      title: title.slice(0, 600),
      url,
      authority: first(rec, "dcterms:creator"),
      type: first(rec, "dcterms:type"),
      street: first(rec, "overheidwetgeving:straatnaam"),
      postcode: pc ? pc.split(" ")[0] : null,
      town: first(rec, "overheidwetgeving:woonplaats"),
      date: date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null,
      lat,
      lng,
    });
  }
  return { items, next: nextRaw ? Number(nextRaw) : null, total };
}
