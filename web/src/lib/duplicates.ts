export type DupSide = { id: string; slug: string; name: string; status: string; osm: boolean; completeness: number };

/**
 * Welke van twee dubbele plekken bewaren we standaard? Eerst wat online staat, dan de meest complete gegevens,
 * dan de OSM-plek (die wordt bij elke import ververst), dan de kortste slug (meestal de oudste, mooiste link).
 */
export function pickKeep<T extends DupSide>(a: T, b: T): { keep: T; remove: T } {
  const rank = (p: DupSide) => [p.status === "published" ? 1 : 0, Math.round(p.completeness * 100), p.osm ? 1 : 0, -p.slug.length];
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < ra.length; i++) {
    if (ra[i] !== rb[i]) return ra[i] > rb[i] ? { keep: a, remove: b } : { keep: b, remove: a };
  }
  return { keep: a, remove: b };
}

/** Hoe zeker is het een dubbel? Dichtbij + gelijkende naam = vrijwel zeker */
export function duplicateConfidence(distanceM: number, nameSimilarity: number): "hoog" | "middel" | "laag" {
  if (distanceM <= 30 || (distanceM <= 100 && nameSimilarity >= 0.5)) return "hoog";
  if (distanceM <= 75 || nameSimilarity >= 0.3) return "middel";
  return "laag";
}
