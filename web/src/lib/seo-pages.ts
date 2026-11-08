// Landingspagina's voor zoekmachines: provincie, plaats of eiland, en provincie per vertrekgroep.
// Alles hier is puur (geen Next.js), zodat de slug- en drempelregels in `tests/seo-pages.test.ts` te testen zijn.
import { inBbox, type Bbox } from "./bbox";
import { departureKind, inDepartureGroup, type DepartureGroup, type DeparturePage } from "./search";
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

/** Aantallen op z'n Nederlands: 1.234 */
export const nl = (n: number) => new Intl.NumberFormat("nl-NL").format(n);
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

/** WebSite en Organization voor de hele site (staat in de layout van de publieke pagina's) */
export function siteLd(siteUrl: string, email?: string) {
  return [
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${siteUrl}/#website`, name: "VrijStaan", url: siteUrl, inLanguage: "nl-NL", publisher: { "@id": `${siteUrl}/#organization` } },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "VrijStaan",
      url: siteUrl,
      logo: `${siteUrl}/icon-512.png`,
      ...(email ? { email } : {}),
    },
  ];
}

// ── Indexeren en datums ─────────────────────────────────────────────────────

type SearchParamsRecord = Record<string, string | string[] | undefined>;

/**
 * Zoek- en vertrekpagina's met zoekparameters (filters, kaart, plaats): wel volgen, niet indexeren. Elke combinatie
 * levert een eigen lijst op, en dat zijn duizenden bijna gelijke pagina's. Zonder parameters gewoon indexeerbaar.
 */
export function filterRobots(sp: SearchParamsRecord): { index: false; follow: true } | undefined {
  const used = Object.values(sp).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined));
  return used ? { index: false, follow: true } : undefined;
}

/** Jongste datum van een plek: wijziging, controle van de website of controle van de vertrektijd. Geen datum: undefined. */
export function lastModifiedOf(p: { updatedAt?: string | null; verifiedAt?: string | null; departureCheckedAt?: string | null }): string | undefined {
  let best: string | undefined;
  let bestMs = -Infinity;
  for (const d of [p.updatedAt, p.verifiedAt, p.departureCheckedAt]) {
    const ms = d ? Date.parse(d) : NaN;
    if (d && Number.isFinite(ms) && ms > bestMs) {
      best = d;
      bestMs = ms;
    }
  }
  return best;
}

// ── Titels ──────────────────────────────────────────────────────────────────

/** Zoekmachines tonen ongeveer 60 tekens; de layout zet er " | VrijStaan" achter */
export const TITLE_MAX = 60;
export const TITLE_SUFFIX = " | VrijStaan";

/** De langste kandidaat (in volgorde van voorkeur) die met de merknaam erachter binnen TITLE_MAX past; anders de kortste */
export function fitTitle(candidates: (string | undefined)[], max = TITLE_MAX - TITLE_SUFFIX.length): string {
  const list = [...new Set(candidates.filter((c): c is string => !!c))];
  return list.find((c) => c.length <= max) ?? list.reduce((a, b) => (b.length < a.length ? b : a));
}

/** Vertrekfeit voor in een titel, alleen bij "zonder vertrektijd" (vrij of per 24 uur, niet betwijfeld of afgewezen) */
export function titleDepartureFact(p: Pick<PlaceSummary, "departure" | "checkoutUntil" | "departureCheck">): string | undefined {
  if (departureKind(p) !== "vrij") return undefined;
  return p.departure === "per24" ? "betalen per 24 uur" : "geen vaste vertrektijd";
}

/**
 * Paginatitel van een plek, binnen ±60 tekens. Bij "zonder vertrektijd" staat dat erin (het kernfeit) en de prijs
 * alleen als die nog past. `base` is de titel uit place-seo (naam, plaats en prijs), `label` de naam met soort
 * ("Camperplaats De Proef") en `price` het bedrag ("€ 24,70", "Gratis").
 */
export function placeTitle(
  p: Pick<PlaceSummary, "name" | "town" | "departure" | "checkoutUntil" | "departureCheck">,
  label: string,
  base: string,
  price?: string,
): string {
  const dep = titleDepartureFact(p);
  const where = `${label} in ${p.town}`;
  const short = `${p.name} in ${p.town}`;
  // Midden in de titel klein: "geen vaste vertrektijd, gratis"
  const after = price === "Gratis" ? "gratis" : price;
  if (dep)
    return fitTitle([
      after ? `${where}: ${dep}, ${after}` : undefined,
      `${where}: ${dep}`,
      after ? `${short}: ${dep}, ${after}` : undefined,
      `${short}: ${dep}`,
      `${p.name}: ${dep}`,
      where,
      short,
      p.name,
    ]);
  return fitTitle([base, price ? `${where}: ${price}` : undefined, price ? `${short}: ${price}` : undefined, where, short, p.name]);
}

// ── Foto's in structured data ───────────────────────────────────────────────

/**
 * Foto's die we in JSON-LD mogen noemen: eigen uploads (bezoekers en eigenaren, licentie via de voorwaarden) en foto's
 * waarvoor de rechthebbende toestemming gaf. Foto's van de website van een plek of van Wikimedia zijn van derden: die
 * tonen we met bronvermelding op de pagina, maar geven we niet door aan zoekmachines. Niets over: de deelafbeelding.
 */
export function ldImages(photos: { url: string; permission?: boolean }[], ownStorage: string, fallback: string): string[] {
  const own = photos.filter((ph) => ph.permission === true || ph.url.startsWith(ownStorage)).map((ph) => ph.url);
  return own.length ? own : [fallback];
}

// ── Hubpagina's: uitleg en provincies ───────────────────────────────────────

export interface ProvinceLink {
  province: (typeof PROVINCES)[number];
  href: string;
  count: number;
}

/**
 * Twaalf provincielinks voor een hub: bij Zonder vertrektijd en Uitslapers naar de vertrekpagina van die provincie,
 * bij Overige plekken naar de provinciepagina (daar staan alle plekken met hun vertrektijd). Het aantal hoort bij de hub.
 */
export function provinceLinks(places: PlaceSummary[], page: DeparturePage): ProvinceLink[] {
  return PROVINCES.map((province) => {
    const inProv = places.filter((p) => p.province === province);
    if (page === "overig") return { province, href: `/camperplaatsen/${provinceSlug(province)}`, count: inProv.filter((p) => inDepartureGroup(p, "overig")).length };
    return { province, href: departurePath(page, province), count: inGroup(inProv, page).length };
  });
}

const plaatsen = (n: number) => `${nl(n)} ${n === 1 ? "camperplaats" : "camperplaatsen"}`;
const isAre = (n: number) => (n === 1 ? "is" : "zijn");

/**
 * Korte uitleg bovenaan een hub (100 tot 150 woorden), alleen uit de cijfers. `lead` staat altijd in beeld, `more`
 * achter "Meer over deze lijst", zodat het zoekscherm op een telefoon niet ver naar beneden schuift.
 */
export function hubIntro(page: DeparturePage, places: PlaceSummary[]): { lead: string; more: string[] } {
  const withAny = provinceLinks(places, page).filter((l) => l.count > 0);
  const top = [...withAny].sort((a, b) => b.count - a.count || a.province.localeCompare(b.province, "nl"))[0];
  const spread = withAny.length === 1 ? `, allemaal in ${top.province}` : `, verspreid over ${nl(withAny.length)} provincies. De meeste liggen in ${top?.province} (${nl(top?.count ?? 0)})`;
  const kinds = places.map((p) => departureKind(p));
  const count = (k: string) => kinds.filter((x) => x === k).length;
  const pick = "Kies hieronder een provincie voor een lijst met prijs en vertrektijd per plek, of zoek op een plaats.";

  if (page === "vrij" || page === "uitslapers") {
    const list = places.filter((p) => departureKind(p) === page);
    const free = list.filter((p) => p.priceEur === 0).length;
    const freeLine = free ? `${cap(plekken(free))} daarvan ${isAre(free)} gratis.` : "";
    if (page === "vrij") {
      if (!list.length) return { lead: "We kennen nog geen camperplaatsen zonder vaste vertrektijd.", more: [pick] };
      const per24 = list.filter((p) => p.departure === "per24").length;
      return {
        lead: `In de gids staan ${plaatsen(list.length)} zonder vaste vertrektijd${spread}.`,
        more: [
          "Zonder vertrektijd betekent: je vertrekt wanneer je wilt, of je betaalt per 24 uur vanaf je aankomst. Bij betalen per 24 uur kom je bijvoorbeeld om 15:00 aan en sta je tot de volgende dag 15:00. Je hoeft 's ochtends dus niet op de klok te letten.",
          per24 && per24 < list.length ? `Bij ${plekken(per24)} betaal je per 24 uur, bij de andere ${plekken(list.length - per24)} is er helemaal geen vaste tijd.` : "",
          freeLine,
          "Soms geldt er toch een vertrektijd, bijvoorbeeld als het druk is. Twijfel je, vraag het dan even na.",
          pick,
        ].filter(Boolean),
      };
    }
    if (!list.length) return { lead: "We kennen nog geen camperplaatsen waar je pas om 12:00 of later weg hoeft.", more: [pick] };
    const fixed = list.length + count("ruim") + count("vroeg");
    return {
      lead: `In de gids staan ${plaatsen(list.length)} waar je pas om 12:00 of later weg hoeft${spread}.`,
      more: [
        `We kennen de vaste vertrektijd van ${plaatsen(fixed)}. Bij ${nl(list.length)} daarvan hoef je pas om 12:00 of later weg, bij de andere ${nl(fixed - list.length)} moet je eerder vertrekken.`,
        "Je ontbijt dus rustig en ruimt in je eigen tempo op. Na een lange rit of een late aankomst is dat prettig. De precieze tijd staat bij elke plek.",
        freeLine,
        "Liever helemaal geen vaste tijd: kijk dan bij Zonder vertrektijd.",
        pick,
      ].filter(Boolean),
    };
  }

  const ruim = count("ruim");
  const vroeg = count("vroeg");
  const unknown = count("onbekend");
  const total = ruim + vroeg + unknown;
  if (!total) return { lead: "Er staan nog geen plekken in deze lijst.", more: [pick] };
  return {
    lead: `Hier staan ${plaatsen(total)}: ${nl(ruim)} waar je tussen 11:00 en 12:00 weg moet, ${nl(vroeg)} met een vertrektijd vóór 11:00 en ${nl(unknown)} waarvan we de vertrektijd nog niet weten.`,
    more: [
      "Een vaste vertrektijd is op camperplaatsen heel gewoon. Let er wel op als je ver wilt rijden of laat aankomt: bij een vroege tijd heb je 's ochtends minder tijd.",
      "Bij een onbekende vertrektijd weten we het echt nog niet. Kijk dan op de website van de plek of bel even voordat je gaat. Weet je hoe het zit, geef het dan door. Dan staat het er voor iedereen bij.",
      "Kies hieronder een provincie voor alle plekken daar, met prijs en vertrektijd per plek.",
    ],
  };
}
