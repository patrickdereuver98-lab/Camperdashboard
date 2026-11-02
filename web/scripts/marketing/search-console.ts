// Dagelijks: Search Console (zoekvragen, totalen, sitemaps, indexering), PageSpeed en Instagram naar Supabase.
// Draait in .github/workflows/marketing.yml:
//   cd web && node --import ./tests/register.mjs scripts/marketing/search-console.ts
// Geheimen: SUPABASE_DB_URL (verplicht), GSC_SERVICE_ACCOUNT_JSON, PAGESPEED_API_KEY, IG_ACCESS_TOKEN + IG_USER_ID
// (alle drie optioneel: zonder wordt dat onderdeel overgeslagen).
// Variabele: GSC_SITE (standaard sc-domain:vrijstaan.nl), SITE_URL (standaard https://vrijstaan.nl).
import { chunks, dailyRows, fetchRange, pageRow, totalRows, type GscRow } from "@/lib/marketing/gsc";
import { getJson, googleToken } from "./google";
import { json, logRun, sql, sqlJson } from "./db";
import { instagram } from "./instagram";

const SITE = process.env.GSC_SITE || "sc-domain:vrijstaan.nl";
const SITE_URL = (process.env.SITE_URL || "https://vrijstaan.nl").replace(/\/$/, "");
const API = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;
/** URL Inspection: 2.000 per dag per property; wij doen er hoogstens zoveel per run */
const INSPECT_PER_RUN = 60;
/** Vaste pagina's die we altijd willen kennen */
const KEY_PATHS = ["/", "/zoeken", "/zonder-vertrektijd", "/uitslapers", "/dichtbij"];

async function main() {
  const started = Date.now();
  const key = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!key) {
    console.log("::notice::GSC_SERVICE_ACCOUNT_JSON ontbreekt: Search Console overgeslagen. Zie docs/marketing/plan.md §6 (P1, P2).");
    pagespeed();
    return;
  }
  const token = await googleToken(key, "https://www.googleapis.com/auth/webmasters.readonly");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const query = (body: object) => getJson<{ rows?: GscRow[] }>(`${API}/searchAnalytics/query`, { method: "POST", headers: auth, body: JSON.stringify(body) });

  // 1. Zoekvragen per dag en pagina, en totalen
  const last = sql("select max(date)::text from public.seo_daily") || null;
  const range = fetchRange(last);
  let daily = 0;
  if (range) {
    for (const c of chunks(range)) {
      for (let startRow = 0; ; startRow += 25000) {
        const res = await query({ startDate: c.start, endDate: c.end, dimensions: ["date", "query", "page"], rowLimit: 25000, startRow, dataState: "all" });
        const rows = dailyRows(res.rows ?? []);
        if (rows.length) {
          sql(`insert into public.seo_daily (date, query, page, clicks, impressions, position)
               select date, query, page, clicks, impressions, position from jsonb_to_recordset(${json(rows)})
                 as r(date date, query text, page text, clicks int, impressions int, position numeric)
               on conflict (date, query, page) do update set clicks = excluded.clicks, impressions = excluded.impressions, position = excluded.position`);
          daily += rows.length;
        }
        if ((res.rows ?? []).length < 25000) break;
      }
    }
    const totals = [
      ...totalRows((await query({ startDate: range.start, endDate: range.end, dimensions: ["date"], rowLimit: 25000, dataState: "all" })).rows ?? []),
      ...totalRows((await query({ startDate: range.start, endDate: range.end, dimensions: ["date", "device"], rowLimit: 25000, dataState: "all" })).rows ?? []),
    ];
    if (totals.length)
      sql(`insert into public.seo_totals (date, device, clicks, impressions, position)
           select date, device, clicks, impressions, position from jsonb_to_recordset(${json(totals)})
             as r(date date, device text, clicks int, impressions int, position numeric)
           on conflict (date, device) do update set clicks = excluded.clicks, impressions = excluded.impressions, position = excluded.position`);
  }

  // 2. Sitemaps
  const sitemaps = await getJson<{ sitemap?: unknown[] }>(`${API}/sitemaps`, { headers: auth }).catch((e) => ({ error: String(e) }));
  sql(`insert into public.seo_status (key, value) values ('sitemaps', ${json(sitemaps)})
       on conflict (key) do update set value = excluded.value, checked_at = now()`);

  // 3. Indexering: vaste pagina's, de pagina's met de meeste vertoningen, en de oudst gecontroleerde
  const urls =
    sqlJson<string[]>(`select coalesce(json_agg(url), '[]') from (
      select url from (
        select unnest(array[${KEY_PATHS.map((p) => `'${SITE_URL}${p}'`).join(",")}]) as url, 0 as prio
        union all
        select page, 1 from (select page from public.seo_daily where date > current_date - 28 group by page order by sum(impressions) desc limit 40) t
        union all
        select url, 2 from public.seo_pages order by 2
      ) u
      left join public.seo_pages s using (url)
      group by url order by min(prio), max(s.checked_at) nulls first limit ${INSPECT_PER_RUN}) x`) ?? [];
  let inspected = 0;
  for (const url of urls) {
    try {
      const res = await getJson<unknown>("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE, languageCode: "nl" }),
      });
      const row = pageRow(url, res);
      sql(`insert into public.seo_pages (url, indexed, verdict, coverage, last_crawl)
           select url, indexed, verdict, coverage, last_crawl from jsonb_to_record(${json(row)})
             as r(url text, indexed boolean, verdict text, coverage text, last_crawl timestamptz)
           on conflict (url) do update set indexed = excluded.indexed, verdict = excluded.verdict, coverage = excluded.coverage,
             last_crawl = excluded.last_crawl, checked_at = now()`);
      inspected++;
    } catch (e) {
      console.warn(`Inspectie ${url} mislukt:`, e instanceof Error ? e.message : e);
    }
  }

  await pagespeed();
  await instagram();
  const msg = `${daily} zoekregels${range ? ` (${range.start} t/m ${range.end})` : ", niets nieuws"}, ${inspected} pagina's gecontroleerd`;
  sql(`insert into public.seo_status (key, value) values ('laatste-run', ${json({ ok: true, message: msg })})
       on conflict (key) do update set value = excluded.value, checked_at = now()`);
  logRun("search-console", "ok", msg, Date.now() - started);
  console.log(msg);
}

/** Core Web Vitals (veldgegevens van Chrome-gebruikers) en de Lighthouse-score, mobiel */
async function pagespeed() {
  const keyParam = process.env.PAGESPEED_API_KEY ? `&key=${encodeURIComponent(process.env.PAGESPEED_API_KEY)}` : "";
  const plek = sql("select slug from public.places where status = 'published' order by rating_count desc nulls last, slug limit 1");
  for (const path of ["/", "/zoeken", ...(plek ? [`/plek/${plek}`] : [])]) {
    try {
      const r = await getJson<{
        loadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }>; overall_category?: string };
        lighthouseResult?: { categories?: { performance?: { score?: number } } };
      }>(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(SITE_URL + path)}&strategy=mobile&category=performance${keyParam}`);
      const m = r.loadingExperience?.metrics ?? {};
      const value = {
        path,
        overall: r.loadingExperience?.overall_category ?? null,
        lcp_ms: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
        inp_ms: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
        cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile !== undefined ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
        score: r.lighthouseResult?.categories?.performance?.score ?? null,
      };
      sql(`insert into public.seo_status (key, value) values (${`'pagespeed:${path.replace(/'/g, "")}'`}, ${json(value)})
           on conflict (key) do update set value = excluded.value, checked_at = now()`);
    } catch (e) {
      console.warn(`PageSpeed ${path} mislukt:`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  try {
    logRun("search-console", "failed", msg, 0);
  } catch {
    // database onbereikbaar: de workflow faalt hieronder en GitHub mailt
  }
  process.exit(1);
});
