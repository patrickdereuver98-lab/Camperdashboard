/** Aantal detailpagina's dat tijdens de build wordt geprerenderd; de rest wordt bij het eerste bezoek gerenderd en gecachet */
export const PRERENDER_LIMIT = 100;

/** Volgorde voor prerenderen: meeste reviews, hoogste score, met foto, meest complete gegevens */
type Rankable = { slug: string; ratingCount?: number; ratingAvg?: number; imageUrl?: string; completeness?: number };

export function rankForPrerender<T extends Rankable>(
  places: T[],
  limit = PRERENDER_LIMIT,
): T[] {
  return [...places]
    .sort(
      (a, b) =>
        (b.ratingCount ?? 0) - (a.ratingCount ?? 0) ||
        (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
        Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
        (b.completeness ?? 0) - (a.completeness ?? 0) ||
        a.slug.localeCompare(b.slug),
    )
    .slice(0, limit);
}
