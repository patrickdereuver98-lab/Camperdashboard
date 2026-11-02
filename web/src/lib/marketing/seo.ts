/**
 * Search Console-cijfers samenvatten en kansen vinden (plan §3.2). Vaste regels, geen AI-gok: elke kans zegt welke
 * regel hem vond en wat je eraan doet. Pure functies, getest in tests/marketing-seo.test.ts.
 */

export type TotalsRow = { date: string; clicks: number; impressions: number; position: number | null };
export type QueryRow = { query: string; page: string; clicks: number; impressions: number; position: number | null };

export type Period = { days: number; clicks: number; impressions: number; ctr: number; position: number | null };

/** Laatste `days` dagen met gegevens tegenover de `days` dagen daarvoor; positie gewogen naar vertoningen */
export function sumPeriods(rows: TotalsRow[], days: number): { current: Period; previous: Period } {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.at(-1)?.date;
  if (!last) return { current: emptyPeriod(), previous: emptyPeriod() };
  const end = new Date(`${last}T00:00:00Z`).getTime();
  const day = 864e5;
  const inRange = (from: number, to: number) => sorted.filter((r) => { const t = new Date(`${r.date}T00:00:00Z`).getTime(); return t > from && t <= to; });
  return { current: period(inRange(end - days * day, end)), previous: period(inRange(end - 2 * days * day, end - days * day)) };
}

function emptyPeriod(): Period {
  return { days: 0, clicks: 0, impressions: 0, ctr: 0, position: null };
}

function period(rows: TotalsRow[]): Period {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const weighted = rows.filter((r) => r.position !== null && r.impressions > 0);
  const w = weighted.reduce((s, r) => s + r.impressions, 0);
  return {
    days: rows.length,
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: w ? weighted.reduce((s, r) => s + Number(r.position) * r.impressions, 0) / w : null,
  };
}

/** Zoekvraag + pagina over een periode samenvoegen (seo_daily heeft een rij per dag) */
export function aggregate(rows: QueryRow[], key: "query" | "page"): QueryRow[] {
  const map = new Map<string, QueryRow & { posW: number }>();
  for (const r of rows) {
    const k = r[key];
    const cur = map.get(k) ?? { query: key === "query" ? k : "", page: key === "page" ? k : r.page, clicks: 0, impressions: 0, position: null, posW: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    if (r.position !== null && r.impressions > 0) cur.posW += Number(r.position) * r.impressions;
    if (key === "query" && r.impressions > 0 && (!cur.page || r.impressions > 0)) cur.page = cur.page || r.page;
    map.set(k, cur);
  }
  return [...map.values()]
    .map(({ posW, ...r }) => ({ ...r, position: r.impressions ? posW / r.impressions : null }))
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Verwachte CTR per positie (afgerond, openbare onderzoeken naar Google-resultaten 2024-2025). Alleen een maatstaf om
 * "opvallend laag" te herkennen, geen belofte.
 */
export function expectedCtr(position: number): number {
  const table = [0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  const i = Math.max(1, Math.round(position)) - 1;
  return i < table.length ? table[i] : 0.01;
}

export const BRAND = /vrij\s?staan/i;

export type Opportunity = {
  kind: "ctr" | "bijna" | "nieuwe-pagina";
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  position: number;
  advice: string;
};

/** Minimaal aantal vertoningen voordat we iets een kans noemen: met minder is het toeval */
export const MIN_IMPRESSIONS = 30;

/**
 * Kansen (plan §3.2.4):
 * - ctr: positie 1-10, genoeg vertoningen, CTR minder dan de helft van wat bij die positie past → titel en omschrijving.
 * - bijna: positie 8-20 → pagina aanvullen en intern linken, dicht bij pagina 1.
 * - nieuwe-pagina: de beste pagina voor de zoekvraag is de start- of zoekpagina terwijl de vraag een plaats of
 *   provincie noemt → een eigen landingspagina kan beter scoren (alleen als er genoeg plekken zijn, MIN_PLACES).
 * Zoekvragen met de merknaam tellen niet: die mensen vinden ons al.
 */
export function opportunities(rows: QueryRow[], areaNames: string[] = []): Opportunity[] {
  const out: Opportunity[] = [];
  const areas = areaNames.map((a) => a.toLowerCase());
  for (const r of aggregate(rows, "query")) {
    if (BRAND.test(r.query) || r.impressions < MIN_IMPRESSIONS || r.position === null) continue;
    const ctr = r.clicks / r.impressions;
    const base = { query: r.query, page: r.page, impressions: r.impressions, clicks: r.clicks, position: r.position };
    let path = "/";
    try {
      path = new URL(r.page).pathname;
    } catch {
      path = r.page;
    }
    const generic = path === "/" || path.startsWith("/zoeken");
    const area = areas.find((a) => r.query.toLowerCase().includes(a));
    if (generic && area) {
      out.push({ ...base, kind: "nieuwe-pagina", advice: `Google toont de ${path === "/" ? "startpagina" : "zoekpagina"} voor "${r.query}". Een eigen pagina over ${area} kan hoger komen, als daar genoeg plekken zijn.` });
    } else if (r.position <= 10.5 && ctr < expectedCtr(r.position) / 2) {
      out.push({ ...base, kind: "ctr", advice: `Staat op positie ${r.position.toFixed(1).replace(".", ",")} maar wordt weinig aangeklikt. Maak titel en omschrijving concreter: prijs, vertrektijd, aantal plekken.` });
    } else if (r.position > 7.5 && r.position <= 20) {
      out.push({ ...base, kind: "bijna", advice: `Net buiten de top. Vul de pagina aan met feiten en link ernaar vanaf verwante pagina's.` });
    }
  }
  const weight = { "nieuwe-pagina": 0, ctr: 1, bijna: 2 } as const;
  return out.sort((a, b) => weight[a.kind] - weight[b.kind] || b.impressions - a.impressions);
}
