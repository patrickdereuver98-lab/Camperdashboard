// Beoordeelt de uitkomst van public.health() voor de bewaking (.github/workflows/monitor.yml).
//
// Gebruik: node scripts/check-health.mjs <health.json> [vorige-health.json]
//   Faalt (exit 1) als er te weinig plekken online staan, als het aantal plekken, met vertrekregel of met prijs meer
//   dan 2% daalde ten opzichte van de vorige run, als meer dan 20% van de pg_net-aanroepen mislukte, of als de
//   laatste scrape te oud is. Fouten in app_logs geven een waarschuwing.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DEFAULTS = {
  minPublished: 1000,
  maxDrop: 0.02,
  maxNetFailRate: 0.2,
  minNetCalls: 20,
  maxScrapeAgeHours: 48,
  // R64: per kanaal. De stealth-lezer draait elk uur zolang er werk is; 24 uur stil met open werk is een storing
  maxStealthAgeHours: 24,
  // R62: zoveel gewiste kernvelden in 24 uur wijst op een parser of site die leegtrekt
  maxWipedCore: 50,
};

const LABELS = { published: "gepubliceerde plekken", with_departure: "plekken met vertrekregel", with_price: "plekken met prijs" };

/**
 * @param {Record<string, unknown> | null} prev vorige uitkomst van health() (of null bij de eerste run)
 * @param {Record<string, unknown>} cur huidige uitkomst van health()
 * @returns {{ errors: string[], warnings: string[], lines: string[] }}
 */
export function evaluate(prev, cur, opts = {}, now = new Date()) {
  const o = { ...DEFAULTS, ...opts };
  const errors = [];
  const warnings = [];
  const lines = [];
  const num = (v) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);

  const published = num(cur?.published);
  if (!Number.isFinite(published)) {
    errors.push("health() gaf geen aantal plekken terug");
    return { errors, warnings, lines };
  }
  if (published < o.minPublished) errors.push(`Maar ${published} gepubliceerde plekken (minimaal ${o.minPublished} verwacht)`);

  for (const key of Object.keys(LABELS)) {
    const now_ = num(cur[key]);
    const was = num(prev?.[key]);
    lines.push(`${LABELS[key]}: ${Number.isFinite(now_) ? now_ : "?"}${Number.isFinite(was) ? ` (vorige run ${was})` : ""}`);
    if (Number.isFinite(now_) && Number.isFinite(was) && was > 0 && (was - now_) / was > o.maxDrop)
      errors.push(`${LABELS[key]} daalde van ${was} naar ${now_} (meer dan ${Math.round(o.maxDrop * 100)}%)`);
  }

  const calls = num(cur.net_calls_24h);
  const failed = num(cur.net_failed_24h);
  if (Number.isFinite(calls) && Number.isFinite(failed)) {
    lines.push(`aanroepen via pg_net: ${failed} van ${calls} mislukt`);
    if (calls >= o.minNetCalls && failed / calls > o.maxNetFailRate)
      errors.push(`${failed} van ${calls} aanroepen via pg_net mislukten (meer dan ${Math.round(o.maxNetFailRate * 100)}%)`);
  }

  if (typeof cur.last_scrape === "string") {
    const ageH = (now.getTime() - Date.parse(cur.last_scrape)) / 3_600_000;
    lines.push(`laatste scrape: ${cur.last_scrape}`);
    if (Number.isFinite(ageH) && ageH > o.maxScrapeAgeHours)
      errors.push(`Laatste scrape is ${Math.round(ageH)} uur oud (meer dan ${o.maxScrapeAgeHours} uur)`);
  } else {
    warnings.push("Geen laatste scrape bekend");
  }

  // Per kanaal (R64): alleen als health() de velden al levert
  const stealthOpen = num(cur.stealth_open);
  if (Number.isFinite(stealthOpen)) {
    lines.push(`stealth-lezer: ${stealthOpen} open, laatste lezing ${cur.stealth_last ?? "onbekend"}`);
    if (stealthOpen > 0 && typeof cur.stealth_last === "string") {
      const ageH = (now.getTime() - Date.parse(cur.stealth_last)) / 3_600_000;
      if (Number.isFinite(ageH) && ageH > o.maxStealthAgeHours)
        errors.push(`Stealth-lezer las ${Math.round(ageH)} uur niets terwijl ${stealthOpen} plekken wachten (workflow Stealth-lezer)`);
    }
  }
  if (Number.isFinite(num(cur.scrape_open))) lines.push(`gewone lezer: ${num(cur.scrape_open)} open, laatste lezing ${cur.web_last ?? "onbekend"}`);
  const wiped = num(cur.core_wiped_24h);
  if (Number.isFinite(wiped)) {
    lines.push(`kernvelden gewijzigd (24 uur): ${num(cur.core_changed_24h)}, gewist: ${wiped}`);
    if (wiped > o.maxWipedCore)
      errors.push(`${wiped} kernvelden gewist in 24 uur (meer dan ${o.maxWipedCore}); zie private.field_log`);
  }

  const appErrors = num(cur.app_errors_24h);
  if (Number.isFinite(appErrors)) {
    lines.push(`fouten in app_logs (24 uur): ${appErrors}`);
    if (appErrors > 0) warnings.push(`${appErrors} fouten in app_logs in de afgelopen 24 uur (Mission Control → Logboeken)`);
  }
  const bytes = num(cur.db_bytes);
  if (Number.isFinite(bytes)) lines.push(`database: ${(bytes / 1024 / 1024).toFixed(0)} MB`);

  return { errors, warnings, lines };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [curPath, prevPath] = process.argv.slice(2);
  const cur = readJson(curPath);
  const prev = prevPath ? readJson(prevPath) : null;
  const min = Number(process.env.MIN_PLEKKEN);
  const { errors, warnings, lines } = evaluate(prev, cur ?? {}, Number.isFinite(min) && min > 0 ? { minPublished: min } : {});
  for (const l of lines) console.log(l);
  for (const w of warnings) console.log(`::warning::${w}`);
  for (const e of errors) console.log(`::error::${e}`);
  process.exit(errors.length ? 1 : 0);
}
