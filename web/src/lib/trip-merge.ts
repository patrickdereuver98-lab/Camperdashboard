/**
 * Een stop in Mijn reis. `nights` 0 is een tussenstop (lozen, water, lunch): je rijdt dezelfde dag verder.
 *
 * - `slug` is de sleutel van de stop: bij een VrijStaan-plek de slug van de plek, bij een eigen punt een eigen sleutel.
 * - `point`: een eigen punt (adres of punt op de kaart, met je eigen naam). Daarvan weten we alleen naam en ligging,
 *   geen plekgegevens. Een stop is een eigen punt als `point` er is, niet door de vorm van de slug.
 * - `notes`: je notities bij de stop (hoogstens 10 privé en 10 gedeelde, elk hoogstens 500 tekens). Standaard privé; `shared: true` betekent
 *   "Delen met reisgenoten": alleen die gaan mee in een gedeelde reis en in delen als tekst (besluit 19 november 2026).
 */
export type TripNote = { id: string; text: string; shared?: true };
export type TripPoint = { name: string; lat: number; lng: number; kind: "adres" | "kaart" };
export type Stop = { slug: string; nights: number; notes?: TripNote[]; point?: TripPoint };

export const MIN_NIGHTS = 0;
export const MAX_NIGHTS = 21;
export const MAX_NOTE = 500;
export const MAX_NOTES = 10;
export const MAX_POINT_NAME = 60;
export const MAX_STOPS = 200;

const SLUG = /^[a-z0-9-]{1,120}$/;
const NOTE_ID = /^[a-z0-9-]{1,40}$/;

/** Aantal nachten begrenzen: heel getal van 0 (tussenstop) tot en met 21, en 1 als het geen getal is */
export function clampNights(n: unknown): number {
  if (n === null || n === undefined || n === "") return 1;
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return 1;
  return Math.max(MIN_NIGHTS, Math.min(MAX_NIGHTS, x));
}

/** Notitietekst opschonen: tekst, ingekort tot 500 tekens; leeg valt weg */
export function cleanNote(note: unknown): string | undefined {
  if (typeof note !== "string") return undefined;
  const t = note.slice(0, MAX_NOTE);
  return t.trim() ? t : undefined;
}

/** Korte willekeurige sleutel (a-z, 0-9) voor een notitie of een eigen punt */
export function randomKey(length = 8): string {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

export const newPointSlug = () => `eigen-${randomKey(10)}`;
export const newNoteId = () => randomKey(8);

/** Eigen punt opschonen: naam (1 tot 60 tekens) en een geldige ligging; anders undefined */
export function cleanPoint(v: unknown): TripPoint | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, MAX_POINT_NAME) : "";
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!name || o.lat === null || o.lng === null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { name, lat, lng, kind: o.kind === "kaart" ? "kaart" : "adres" };
}

/**
 * Notities opschonen. `legacy` is de losse notitie uit versie 3 (`note`); die wordt één notitie met vaste sleutel, zodat
 * hetzelfde opslaan steeds hetzelfde oplevert. `legacyShared`: kwam die oude notitie uit een gedeelde reis (dan was hij
 * al met reisgenoten gedeeld), of van dit toestel of je account (dan wordt hij privé).
 */
export function cleanNotes(v: unknown, legacy?: unknown, legacyShared = false): TripNote[] | undefined {
  const out: TripNote[] = [];
  const ids = new Set<string>();
  const old = cleanNote(legacy);
  if (old) {
    const id = legacyShared ? "g0" : "n0";
    out.push(legacyShared ? { id, text: old, shared: true } : { id, text: old });
    ids.add(id);
  }
  for (const n of Array.isArray(v) ? v : []) {
    if (typeof n !== "object" || n === null) continue;
    const o = n as Record<string, unknown>;
    const text = cleanNote(o.text);
    if (!text || typeof o.id !== "string" || !NOTE_ID.test(o.id) || ids.has(o.id)) continue;
    // Privé en gedeeld tellen apart: notities van reisgenoten kunnen jouw privénotities niet verdringen
    const shared = o.shared === true;
    if (out.filter((n) => !!n.shared === shared).length >= MAX_NOTES) continue;
    ids.add(o.id);
    out.push(shared ? { id: o.id, text, shared: true } : { id: o.id, text });
  }
  return out.length ? out : undefined;
}

type MergeOptions = {
  /** Oude losse notities (`note`) als gedeeld lezen: zo stonden ze in een gedeelde reis van vóór versie 4 */
  legacyShared?: boolean;
};

/** Eén stop opschonen; undefined als het geen stop is (of een eigen punt zonder geldige ligging) */
export function cleanStop(s: unknown, { legacyShared = false }: MergeOptions = {}): Stop | undefined {
  if (typeof s !== "object" || s === null) return undefined;
  const o = s as Record<string, unknown>;
  if (typeof o.slug !== "string" || !SLUG.test(o.slug)) return undefined;
  const out: Stop = { slug: o.slug, nights: clampNights(o.nights) };
  if (o.point !== undefined) {
    const point = cleanPoint(o.point);
    if (!point) return undefined;
    out.point = point;
  }
  const notes = cleanNotes(o.notes, o.note, legacyShared);
  if (notes) out.notes = notes;
  return out;
}

/**
 * Reis op dit toestel samenvoegen met de reis in het account: de volgorde en het aantal nachten van dit toestel
 * gaan voor, stops die alleen in het account staan komen erachter. Ongeldige items vallen weg.
 */
export function mergeTrips(local: unknown[], remote: unknown, options: MergeOptions = {}): Stop[] {
  const out: Stop[] = [];
  const seen = new Set<string>();
  const add = (list: unknown[], opts: MergeOptions) => {
    for (const raw of list) {
      const s = cleanStop(raw, opts);
      if (!s || seen.has(s.slug)) continue;
      seen.add(s.slug);
      out.push(s);
    }
  };
  add(local, {});
  add(Array.isArray(remote) ? remote : [], options);
  return capNotes(out.slice(0, MAX_STOPS));
}

/**
 * Notities over de hele reis begrensd tot MAX_NOTE_CHARS tekens: zo blijft een reis ruim onder de grens van de database
 * (`stops` < 200 kB), anders zou opslaan in je account of de gedeelde reis steeds mislukken. Wat te veel is valt weg,
 * van achteren.
 */
export const MAX_NOTE_CHARS = 60_000;
function capNotes(stops: Stop[]): Stop[] {
  let left = MAX_NOTE_CHARS;
  return stops.map((s) => {
    if (!s.notes) return s;
    const notes = s.notes.filter((n) => (left -= n.text.length) >= 0);
    const rest: Stop = { ...s };
    delete rest.notes;
    return notes.length ? { ...rest, notes } : rest;
  });
}

/** Zelfde reis: volgorde, nachten, eigen punten en notities (alles na opschonen) */
export const sameTrip = (a: Stop[], b: Stop[]) => JSON.stringify(mergeTrips(a, [])) === JSON.stringify(mergeTrips(b, []));

/** Is deze stop een eigen punt (geen VrijStaan-plek)? */
export const isPoint = (s: Pick<Stop, "point">): s is { point: TripPoint } => !!s.point;

/** De gedeelde notities van een stop */
export const sharedNotes = (s: Pick<Stop, "notes">) => (s.notes ?? []).filter((n) => n.shared);

/**
 * Wat er van de reis naar je reisgenoten gaat (`shared_trips`): alle stops, maar alleen de notities met "Delen met
 * reisgenoten" aan. Privénotities blijven op dit toestel en in je eigen account.
 */
export function forShared(stops: Stop[]): Stop[] {
  return stops.map((s) => {
    const { notes, ...rest } = s;
    const shared = sharedNotes({ notes });
    return shared.length ? { ...rest, notes: shared } : rest;
  });
}

/**
 * De gedeelde reis is binnengekomen: volgorde, nachten, eigen punten en gedeelde notities komen van daar. Je
 * privénotities bij stops die er nog in staan blijven staan. Een privénotitie met dezelfde tekst als een gedeelde
 * notitie bij die stop valt weg (de omzetting van versie 3: toen ging elke notitie mee).
 */
export function withShared(local: Stop[], remote: Stop[]): Stop[] {
  const mine = new Map(local.map((s) => [s.slug, (s.notes ?? []).filter((n) => !n.shared)]));
  return remote.map((s) => {
    const shared = sharedNotes(s);
    const texts = new Set(shared.map((n) => n.text.trim()));
    const ids = new Set(shared.map((n) => n.id));
    const own = (mine.get(s.slug) ?? []).filter((n) => !texts.has(n.text.trim()) && !ids.has(n.id));
    const notes = [...shared, ...own];
    const rest: Stop = { ...s };
    delete rest.notes;
    return notes.length ? { ...rest, notes } : rest;
  });
}

// ── Bewerkingen op de stops (puur; store.ts schrijft het resultaat weg) ──

/** Notitie bewaren bij een stop: nieuw (achteraan) of aangepast (zelfde plaats); lege tekst haalt hem weg */
export function saveNote(stops: Stop[], slug: string, note: TripNote): Stop[] {
  return stops.map((s) => {
    if (s.slug !== slug) return s;
    const list = s.notes ?? [];
    const has = list.some((n) => n.id === note.id);
    const notes = !note.text.trim() ? list.filter((n) => n.id !== note.id) : has ? list.map((n) => (n.id === note.id ? note : n)) : [...list, note];
    return { ...s, notes };
  });
}

export const removeNote = (stops: Stop[], slug: string, id: string): Stop[] =>
  stops.map((s) => (s.slug === slug ? { ...s, notes: (s.notes ?? []).filter((n) => n.id !== id) } : s));

/** Eigen punt op plaats `at` (standaard achteraan), als tussenstop tenzij anders gevraagd */
export function addPoint(stops: Stop[], point: TripPoint, slug: string, at = stops.length, nights = 0): Stop[] {
  const i = Math.max(0, Math.min(stops.length, at));
  return [...stops.slice(0, i), { slug, nights: clampNights(nights), point }, ...stops.slice(i)];
}
