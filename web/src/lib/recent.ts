/**
 * Wat je eerder zocht en bekeek, alleen op dit toestel (UX-audit november, Z1). Nooit naar de server: het zoekvak
 * toont het als je het leeg opent. Hier de pure regels; de opslag zit in store.ts.
 */

export type RecentSearch = {
  /** Wat in de lijst staat: "Texel, stroom, gratis" */
  label: string;
  /** Het adres van die zoekopdracht (`/zoeken?…`), met alle filters */
  href: string;
  at: string;
};

export type RecentPlace = { slug: string; name: string; town: string; at: string };

export const RECENT_MAX = 5;

const isString = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length < 400;

/** Opslag lezen; alles wat er raar uitziet valt weg (nooit een kapot adres in het zoekvak) */
export function decodeRecentSearches(raw: unknown): RecentSearch[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((r): r is RecentSearch => !!r && isString(r.label) && isString(r.href) && r.href.startsWith("/") && !r.href.startsWith("//") && isString(r.at))
    .slice(0, RECENT_MAX);
}

export function decodeRecentPlaces(raw: unknown): RecentPlace[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((r): r is RecentPlace => !!r && isString(r.slug) && /^[a-z0-9-]+$/.test(r.slug) && isString(r.name) && typeof r.town === "string" && isString(r.at))
    .slice(0, RECENT_MAX);
}

/** Nieuwste bovenaan; dezelfde zoekopdracht of plek schuift naar boven in plaats van twee keer te staan */
export function addRecent<T>(list: T[], item: T, same: (a: T, b: T) => boolean, max = RECENT_MAX): T[] {
  return [item, ...list.filter((x) => !same(x, item))].slice(0, max);
}
