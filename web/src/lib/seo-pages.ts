// Landingspagina's voor zoekmachines: provincie, plaats of eiland, en provincie per vertrekgroep.
// Alles hier is puur (geen Next.js), zodat de slug- en drempelregels in `tests/seo-pages.test.ts` te testen zijn.
import { inBbox, type Bbox } from "./bbox";
import { departureKind, type DepartureGroup } from "./search";
import { eur } from "./format";
import { PROVINCES, type PlaceSummary } from "./types";

/**
 * Minimum aantal gepubliceerde plekken voor een indexeerbare pagina. Daaronder bestaat de pagina wel (links blijven
 * werken als het aantal even zakt), maar met `noindex` en zonder plek in de sitemap: geen dunne pagina's.
 */
export const MIN_PLACES = 3;

export const indexable = (count: number) => count >= MIN_PLACES;

/** "Noord-Holland" → "noord-holland", "Ee (Fr)" → "ee-fr", "Sint-Oedenrode" → "sint-oedenrode", "'s-Hertogenbosch" → "s-hertogenbosch" */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const provinceSlug = (p: string) => slugify(p);

export function provinceFromSlug(slug: string): (typeof PROVINCES)[number] | undefined {
  return PROVINCES.find((p) => provinceSlug(p) === slug);
}

// ── Eilanden ────────────────────────────────────────────────────────────────

export interface Island {
  slug: string;
  name: string;
  province: (typeof PROVINCES)[number];
  /** Rechthoek om het eiland, ruim van de vaste wal af (Den Helder, Harlingen, Holwerd en Lauwersoog vallen erbuiten) */
  bbox: Bbox;
  /** Voor "Bekijk op de kaart": zelfde middelpunt en straal als het zoekvak */
  center: { lat: number; lng: number };
  radiusKm: number;
}

/** De Waddeneilanden: door water begrensd, dus een rechthoek is hier exact genoeg. Streken (Veluwe, Twente) bewust niet: hun grens is een kwestie van smaak. */
export const ISLANDS: Island[] = [
  { slug: "texel", name: "Texel", province: "Noord-Holland", bbox: [4.69, 52.99, 4.93, 53.19], center: { lat: 53.07, lng: 4.8 }, radiusKm: 15 },
  { slug: "vlieland", name: "Vlieland", province: "Friesland", bbox: [4.85, 53.21, 5.12, 53.32], center: { lat: 53.27, lng: 5.0 }, radiusKm: 10 },
  { slug: "terschelling", name: "Terschelling", province: "Friesland", bbox: [5.13, 53.34, 5.6, 53.47], center: { lat: 53.4, lng: 5.35 }, radiusKm: 15 },
  { slug: "ameland", name: "Ameland", province: "Friesland", bbox: [5.6, 53.41, 5.95, 53.48], center: { lat: 53.45, lng: 5.77 }, radiusKm: 12 },
  { slug: "schiermonnikoog", name: "Schiermonnikoog", province: "Friesland", bbox: [6.08, 53.46, 6.34, 53.52], center: { lat: 53.48, lng: 6.17 }, radiusKm: 8 },
];

// ── Gebieden binnen een provincie: plaatsen en eilanden ─────────────────────

export interface Area {
  slug: string;
  name: string;
  kind: "plaats" | "eiland";
  /** "in Den Burg", "op Texel" */
  prep: "in" | "op";
  places: PlaceSummary[];
  island?: Island;
}

/** Alle plaatsen en eilanden in een provincie met minstens één plek, meeste plekken eerst */
export function areasIn(places: PlaceSummary[], province: string): Area[] {
  const inProv = places.filter((p) => p.province === province);
  const out: Area[] = [];
  for (const island of ISLANDS.filter((i) => i.province === province)) {
    const on = inProv.filter((p) => inBbox(p, island.bbox));
    if (on.length) out.push({ slug: island.slug, name: island.name, kind: "eiland", prep: "op", places: on, island });
  }
  const taken = new Set(out.map((a) => a.slug));
  const byTown = new Map<string, PlaceSummary[]>();
  for (const p of inProv) {
    const slug = p.town ? slugify(p.town) : "";
    if (!slug || taken.has(slug)) continue;
    byTown.set(slug, [...(byTown.get(slug) ?? []), p]);
  }
  for (const [slug, list] of byTown) out.push({ slug, name: commonest(list.map((p) => p.town)), kind: "plaats", prep: "in", places: list });
  return out.sort((a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name, "nl"));
}

export function findArea(places: PlaceSummary[], province: string, slug: string): Area | undefined {
  return areasIn(places, province).find((a) => a.slug === slug);
}

/** Meest gebruikte schrijfwijze ("Den Burg" boven "den Burg"); bij gelijke stand de eerste in het alfabet */
function commonest(names: string[]): string {
  const n = new Map<string, number>();
  for (const s of names) n.set(s, (n.get(s) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nl"))[0][0];
}

// ── Provincie per vertrekgroep ──────────────────────────────────────────────

export const DEPARTURE_SEO = {
  vrij: {
    base: "/zonder-vertrektijd",
    title: (prov: string) => `Camperplaatsen zonder vertrektijd in ${prov}`,
    short: "Zonder vertrektijd",
    /** Bijzin na "waar" */
    rule: "je vertrekt wanneer je wilt of per 24 uur betaalt vanaf aankomst",
  },
  uitslapers: {
    base: "/uitslapers",
    title: (prov: string) => `Camperplaatsen voor uitslapers in ${prov}`,
    short: "Voor uitslapers",
    rule: "je pas om 12:00 of later weg hoeft",
  },
} as const satisfies Partial<Record<DepartureGroup, unknown>>;

export type SeoDeparture = keyof typeof DEPARTURE_SEO;

export const departurePath = (g: SeoDeparture, province: string) => `${DEPARTURE_SEO[g].base}/${provinceSlug(province)}`;

export const inGroup = (places: PlaceSummary[], g: SeoDeparture) => places.filter((p) => departureKind(p) === g);

/**
 * Volgorde op de landingspagina's: zonder tijd of locatie, zodat de pagina vast te prerenderen is. Meest complete
 * gegevens eerst, dan met foto, dan de score (alleen als er reviews zijn); geen betaalde plaatsing.
 */
export function rankForLanding<T extends Pick<PlaceSummary, "completeness" | "imageUrl" | "ratingAvg" | "ratingCount" | "name">>(places: T[]): T[] {
  const score = (p: T) => (p.ratingCount ? (p.ratingAvg ?? 0) : 0);
  return [...places].sort(
    (a, b) =>
      b.completeness - a.completeness ||
      Number(!!b.imageUrl) - Number(!!a.imageUrl) ||
      score(b) - score(a) ||
      a.name.localeCompare(b.name, "nl"),
  );
}

// ── Kerncijfers en tekst ────────────────────────────────────────────────────

export interface Counts {
  total: number;
  free: number;
  vrij: number;
  uitslapers: number;
  unknownDeparture: number;
}

export function countsOf(places: PlaceSummary[]): Counts {
  const c: Counts = { total: places.length, free: 0, vrij: 0, uitslapers: 0, unknownDeparture: 0 };
  for (const p of places) {
    if (p.priceEur === 0) c.free++;
    const k = departureKind(p);
    if (k === "vrij") c.vrij++;
    else if (k === "uitslapers") c.uitslapers++;
    else if (k === "onbekend") c.unknownDeparture++;
  }
  return c;
}

const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(n);
const plekken = (n: number) => `${nl(n)} ${n === 1 ? "plek" : "plekken"}`;

/**
 * Korte inleiding van een plaats-, eiland- of provinciepagina, alleen uit de cijfers. Wat we niet weten, zeggen we
 * niet: zonder plekken in een vertrekgroep valt die zin weg.
 */
export function areaIntro(where: string, c: Counts): string[] {
  if (!c.total) return [`Er staan nog geen camperplaatsen ${where} in de gids.`];
  const lines = [`${c.total === 1 ? "Er staat 1 camperplaats" : `Er staan ${nl(c.total)} camperplaatsen`} ${where} in de gids${c.free ? `, waarvan ${nl(c.free)} gratis` : ""}.`];
  const dep: string[] = [];
  if (c.vrij) dep.push(`bij ${plekken(c.vrij)} vertrek je wanneer je wilt of betaal je per 24 uur`);
  if (c.uitslapers) dep.push(`bij ${plekken(c.uitslapers)} hoef je pas om 12:00 of later weg`);
  if (dep.length) lines.push(`${cap(dep.join(", en "))}.`);
  if (c.unknownDeparture) lines.push(`Van ${plekken(c.unknownDeparture)} weten we de vertrektijd nog niet.`);
  return lines;
}

/**
 * De cijfers van een plaats-, eiland- of provinciepagina als korte regels (getal vooraan), zodat de lijst op de
 * telefoon eerder in beeld staat dan bij een alinea per cijfer (verbeterplan D8). Een groep zonder plekken valt weg.
 */
export function areaFacts(c: Counts, avgPrice?: number | null): { value: string; label: string }[] {
  const facts = [
    // Het totaal en het aantal gratis plekken staan al in de inleidende zin
    { n: c.vrij, value: nl(c.vrij), label: "zonder vaste vertrektijd" },
    { n: c.uitslapers, value: nl(c.uitslapers), label: "voor uitslapers" },
    { n: c.unknownDeparture, value: nl(c.unknownDeparture), label: "vertrektijd nog onbekend" },
    { n: avgPrice ?? 0, value: avgPrice ? eur(avgPrice) : "", label: "gemiddeld per nacht, zonder toeslagen" },
  ];
  return facts.filter((f) => f.n > 0).map(({ value, label }) => ({ value, label }));
}

export function departureIntro(g: SeoDeparture, province: string, count: number, free: number): string {
  if (!count) return `We kennen in ${province} nog geen camperplaatsen waar ${DEPARTURE_SEO[g].rule}.`;
  return `${count === 1 ? "Er is 1 camperplaats" : `Er zijn ${nl(count)} camperplaatsen`} in ${province} waar ${DEPARTURE_SEO[g].rule}${free ? `. ${nl(free)} daarvan ${free === 1 ? "is" : "zijn"} gratis` : ""}.`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Camperplaatsen op Texel", "Camperplaatsen in Den Burg" */
export const areaTitle = (a: Pick<Area, "prep" | "name">) => `Camperplaatsen ${a.prep} ${a.name}`;

export const areaPath = (province: string, slug: string) => `/camperplaatsen/${provinceSlug(province)}/${slug}`;

// ── Structured data ─────────────────────────────────────────────────────────

export function breadcrumbLd(siteUrl: string, crumbs: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${siteUrl}${c.path}` })),
  };
}

export function itemListLd(siteUrl: string, name: string, places: Pick<PlaceSummary, "slug" | "name">[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: places.length,
    itemListElement: places.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl}/plek/${p.slug}`, name: p.name })),
  };
}

/** JSON-LD veilig in een <script>: geen "</script>" in namen */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
