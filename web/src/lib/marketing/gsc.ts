/**
 * Search Console ophalen: welke dagen, en de antwoorden omzetten naar rijen voor seo_daily en seo_totals.
 * Pure functies (geen netwerk), gebruikt door scripts/marketing/search-console.ts en getest in tests/marketing-gsc.test.ts.
 */

/** Search Console bewaart 16 maanden; bij de eerste run halen we alles op */
export const HISTORY_DAYS = 480;
/** De laatste 3 dagen zijn nog niet definitief */
export const LAG_DAYS = 3;
/** Gegevens van de laatste dagen veranderen nog: elke run haalt deze opnieuw op */
export const REFETCH_DAYS = 5;

const DAY = 864e5;
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Welke periode ophalen: vanaf de dag na de laatste opgeslagen dag (min REFETCH_DAYS), of de hele historie bij een
 * lege tabel, tot vandaag min LAG_DAYS. null als er niets te halen is.
 */
export function fetchRange(lastStored: string | null, now = Date.now()): { start: string; end: string } | null {
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const end = today - LAG_DAYS * DAY;
  const earliest = today - HISTORY_DAYS * DAY;
  const start = lastStored ? Math.max(earliest, new Date(`${lastStored}T00:00:00Z`).getTime() - (REFETCH_DAYS - 1) * DAY) : earliest;
  return start > end ? null : { start: isoDay(start), end: isoDay(end) };
}

/** Periode opdelen in blokken van `size` dagen (Search Console geeft hoogstens 25.000 rijen per aanvraag) */
export function chunks(range: { start: string; end: string }, size = 7): { start: string; end: string }[] {
  const out: { start: string; end: string }[] = [];
  const end = new Date(`${range.end}T00:00:00Z`).getTime();
  for (let t = new Date(`${range.start}T00:00:00Z`).getTime(); t <= end; t += size * DAY) {
    out.push({ start: isoDay(t), end: isoDay(Math.min(end, t + (size - 1) * DAY)) });
  }
  return out;
}

export type GscRow = { keys: string[]; clicks: number; impressions: number; ctr?: number; position?: number };

const round2 = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n * 100) / 100 : null);

/** Antwoord met dimensies [date, query, page] → seo_daily; lege of te lange sleutels vallen weg */
export function dailyRows(rows: GscRow[]) {
  return rows
    .filter((r) => r.keys.length === 3 && r.keys.every((k) => k && k.length <= 500))
    .map((r) => ({ date: r.keys[0], query: r.keys[1], page: r.keys[2], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: round2(r.position) }));
}

/** Antwoord met dimensies [date] of [date, device] → seo_totals */
export function totalRows(rows: GscRow[]) {
  const devices: Record<string, string> = { MOBILE: "mobile", DESKTOP: "desktop", TABLET: "tablet" };
  return rows
    .filter((r) => r.keys.length === 1 || devices[r.keys[1]])
    .map((r) => ({ date: r.keys[0], device: r.keys.length === 1 ? "alle" : devices[r.keys[1]], clicks: Math.round(r.clicks), impressions: Math.round(r.impressions), position: round2(r.position) }));
}

/** URL Inspection-antwoord → seo_pages */
export function pageRow(url: string, result: unknown) {
  const r = (result as { inspectionResult?: { indexStatusResult?: Record<string, unknown> } })?.inspectionResult?.indexStatusResult ?? {};
  const verdict = typeof r.verdict === "string" ? r.verdict : null;
  return {
    url,
    indexed: verdict === null ? null : verdict === "PASS",
    verdict,
    coverage: typeof r.coverageState === "string" ? r.coverageState : null,
    last_crawl: typeof r.lastCrawlTime === "string" ? r.lastCrawlTime : null,
  };
}
