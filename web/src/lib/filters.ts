import { PROVINCES, type Place } from "./types";

export type SortKey = "info" | "naam";

export interface Filters {
  q: string;
  province?: string;
  free: boolean;
  power: boolean;
  dogs: boolean;
  water: boolean;
  sort: SortKey;
}

export const FACETS = [
  { key: "free", param: "gratis", label: "Gratis" },
  { key: "power", param: "stroom", label: "Stroom" },
  { key: "dogs", param: "honden", label: "Honden welkom" },
  { key: "water", param: "water", label: "Aan het water" },
] as const;

export type FacetKey = (typeof FACETS)[number]["key"];

export const EMPTY_FILTERS: Filters = {
  q: "",
  free: false,
  power: false,
  dogs: false,
  water: false,
  sort: "info",
};

type ParamSource = { get(name: string): string | null };

export function filtersFromParams(params: ParamSource): Filters {
  const province = params.get("provincie") ?? undefined;
  return {
    q: params.get("q") ?? "",
    province: PROVINCES.includes(province as never) ? province : undefined,
    free: params.get("gratis") === "1",
    power: params.get("stroom") === "1",
    dogs: params.get("honden") === "1",
    water: params.get("water") === "1",
    sort: params.get("sort") === "naam" ? "naam" : "info",
  };
}

export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.province) p.set("provincie", f.province);
  for (const facet of FACETS) if (f[facet.key]) p.set(facet.param, "1");
  if (f.sort !== "info") p.set("sort", f.sort);
  return p;
}

export function searchHref(f: Partial<Filters>): string {
  const qs = filtersToParams({ ...EMPTY_FILTERS, ...f }).toString();
  return qs ? `/zoeken?${qs}` : "/zoeken";
}

// ── Vrije tekst → filters ─────────────────────────────────────────────────────

const PROVINCE_ALIASES: Record<string, string> = {
  brabant: "Noord-Brabant",
  "noord brabant": "Noord-Brabant",
  "noord-brabant": "Noord-Brabant",
  "noord holland": "Noord-Holland",
  "noord-holland": "Noord-Holland",
  "zuid holland": "Zuid-Holland",
  "zuid-holland": "Zuid-Holland",
  fryslan: "Friesland",
  friesland: "Friesland",
  drenthe: "Drenthe",
  flevoland: "Flevoland",
  gelderland: "Gelderland",
  veluwe: "Gelderland",
  achterhoek: "Gelderland",
  groningen: "Groningen",
  limburg: "Limburg",
  overijssel: "Overijssel",
  twente: "Overijssel",
  utrecht: "Utrecht",
  zeeland: "Zeeland",
};

const KEYWORDS: Record<FacetKey, string[]> = {
  free: ["gratis", "free", "kosteloos", "goedkoop"],
  power: ["stroom", "elektra", "elektriciteit", "stroomaansluiting"],
  dogs: ["hond", "honden", "huisdier", "huisdieren"],
  water: ["water", "waterkant", "meer", "strand", "zee", "rivier", "kust"],
};

const STOPWORDS = new Set(
  "camperplaats camperplaatsen camperplek camperplekken plek plekken plaats staan vrijstaan overnachten met en in bij aan het de een op voor toegestaan welkom mag mogen zonder dicht buurt van".split(
    " ",
  ),
);

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Herkent provincies en voorzieningen in een vrije zoekopdracht zoals
 * "gratis plek aan het water in Zeeland met hond". Wat overblijft wordt
 * als tekst gezocht in naam en woonplaats.
 */
export function parseQuery(text: string): Partial<Filters> & { q: string } {
  let rest = ` ${normalize(text)} `;
  const out: Partial<Filters> & { q: string } = { q: "" };

  const aliases = Object.keys(PROVINCE_ALIASES).sort(
    (a, b) => b.length - a.length,
  );
  for (const alias of aliases) {
    if (rest.includes(` ${alias} `)) {
      out.province = PROVINCE_ALIASES[alias];
      rest = rest.replace(` ${alias} `, " ");
      break;
    }
  }

  const words = rest.split(/[^a-z0-9'-]+/).filter(Boolean);
  const left: string[] = [];
  for (const w of words) {
    const facet = (Object.keys(KEYWORDS) as FacetKey[]).find((k) =>
      KEYWORDS[k].includes(w),
    );
    if (facet) out[facet] = true;
    else if (!STOPWORDS.has(w)) left.push(w);
  }
  out.q = left.join(" ");
  return out;
}

// ── Toepassen ─────────────────────────────────────────────────────────────────

export function completeness(p: Place): number {
  return [
    p.price,
    p.dogs,
    p.spots,
    p.hours,
    p.website,
    p.phone,
    p.power,
  ].filter((v) => v !== undefined).length;
}

export function applyFilters(places: Place[], f: Filters): Place[] {
  const terms = normalize(f.q).split(/\s+/).filter(Boolean);
  const result = places.filter((p) => {
    if (f.province && p.province !== f.province) return false;
    if (f.free && p.price !== "gratis") return false;
    if (f.power && !p.power) return false;
    if (f.dogs && p.dogs !== true) return false;
    if (f.water && !p.water) return false;
    if (terms.length) {
      const hay = normalize(`${p.name} ${p.town} ${p.province}`);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  if (f.sort === "naam") {
    result.sort(
      (a, b) =>
        Number(!!a.unnamed) - Number(!!b.unnamed) ||
        a.name.localeCompare(b.name, "nl"),
    );
  } else {
    result.sort(
      (a, b) =>
        completeness(b) - completeness(a) ||
        Number(!!a.unnamed) - Number(!!b.unnamed) ||
        a.name.localeCompare(b.name, "nl"),
    );
  }
  return result;
}

export function activeFilterCount(f: Filters): number {
  return FACETS.filter((x) => f[x.key]).length + (f.province ? 1 : 0);
}
