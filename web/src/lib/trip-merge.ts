export type Stop = { slug: string; nights: number };

/**
 * Reis op dit toestel samenvoegen met de reis in het account: de volgorde en het aantal nachten van dit toestel
 * gaan voor, plekken die alleen in het account staan komen erachter. Ongeldige items vallen weg.
 */
export function mergeTrips(local: Stop[], remote: unknown): Stop[] {
  const valid = (s: unknown): s is Stop =>
    typeof (s as Stop)?.slug === "string" && /^[a-z0-9-]{1,120}$/.test((s as Stop).slug);
  const norm = (s: Stop): Stop => ({ slug: s.slug, nights: Math.max(1, Math.min(21, Math.round(Number(s.nights) || 1))) });
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
  a.length === b.length && a.every((s, i) => s.slug === b[i].slug && s.nights === b[i].nights);
