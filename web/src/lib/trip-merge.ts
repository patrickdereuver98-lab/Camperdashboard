/**
 * Een stop in Mijn reis. `nights` 0 is een tussenstop (lozen, water, lunch): je rijdt dezelfde dag verder.
 * `note` is je eigen notitie bij de stop (maximaal 500 tekens).
 */
export type Stop = { slug: string; nights: number; note?: string };

export const MIN_NIGHTS = 0;
export const MAX_NIGHTS = 21;
export const MAX_NOTE = 500;

/** Aantal nachten begrenzen: heel getal van 0 (tussenstop) tot en met 21, en 1 als het geen getal is */
export function clampNights(n: unknown): number {
  if (n === null || n === undefined || n === "") return 1;
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return 1;
  return Math.max(MIN_NIGHTS, Math.min(MAX_NIGHTS, x));
}

/** Notitie opschonen: tekst, ingekort tot 500 tekens; leeg valt weg */
export function cleanNote(note: unknown): string | undefined {
  if (typeof note !== "string") return undefined;
  const t = note.slice(0, MAX_NOTE);
  return t.trim() ? t : undefined;
}

/**
 * Reis op dit toestel samenvoegen met de reis in het account: de volgorde en het aantal nachten van dit toestel
 * gaan voor, plekken die alleen in het account staan komen erachter. Ongeldige items vallen weg.
 */
export function mergeTrips(local: Stop[], remote: unknown): Stop[] {
  const valid = (s: unknown): s is Stop =>
    typeof (s as Stop)?.slug === "string" && /^[a-z0-9-]{1,120}$/.test((s as Stop).slug);
  const norm = (s: Stop): Stop => {
    const note = cleanNote(s.note);
    return note ? { slug: s.slug, nights: clampNights(s.nights), note } : { slug: s.slug, nights: clampNights(s.nights) };
  };
  const out: Stop[] = [];
  const seen = new Set<string>();
  for (const s of [...local, ...(Array.isArray(remote) ? remote : [])]) {
    if (!valid(s) || seen.has(s.slug)) continue;
    seen.add(s.slug);
    out.push(norm(s));
  }
  return out.slice(0, 200);
}

export const sameTrip = (a: Stop[], b: Stop[]) =>
  a.length === b.length && a.every((s, i) => s.slug === b[i].slug && s.nights === b[i].nights && (s.note ?? "") === (b[i].note ?? ""));
