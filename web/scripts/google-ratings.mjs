// Haalt cijfer, aantal en de reviews (zonder naam van de schrijver) van Google Maps op (README 141).
//   node --no-warnings --import ./tests/register.mjs scripts/google-ratings.mjs [--limit 250] [--dry] [--again] [--out resultaat.json]
// Plekken zonder check of met een check ouder dan 30 dagen, oudste eerst. Eerste ronde: --limit 3000.
// Twee manieren om te bewaren:
//   - SUPABASE_DB_URL gezet: rechtstreeks naar de database (psql): place_google en private.place_google_reviews.
//   - zonder: alleen lezen met de openbare sleutel en het resultaat in --out (bestand); laad het daarna in met
//     scripts/google-ingest.mjs. Zo hoeft er geen databasetoegang in GitHub te staan.
// Nodig: GOOGLE_PLACES_API_KEY. Reviews komen nooit op de site (bronnenbeleid §3c).
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { DETAILS_MASK, fetchGoogleCandidates, matchGooglePlace, ratingOf, splitCandidate, PLACE_ID } from "../src/lib/google-rating.ts";
import { forgetSql, saveSql } from "./google-sql.mjs";

const args = process.argv.slice(2);
const flag = (n) => args[args.indexOf(n) + 1];
const dry = args.includes("--dry");
// --again: ook plekken die korter dan 30 dagen geleden gecheckt zijn (bijvoorbeeld om nieuwe velden op te halen)
const again = args.includes("--again");
const limit = Math.min(Math.max(Number(flag("--limit")) || 250, 1), 5000);
const outFile = args.includes("--out") ? flag("--out") : null;
const key = process.env.GOOGLE_PLACES_API_KEY;
const db = process.env.SUPABASE_DB_URL;
// Dezelfde openbare gegevens als in de website (lib/env.ts)
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkrmthrhwmmmwswmfgwc.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_EGEUx5L3Df4w18_DgmtbHw_6RUoglht";
if (!key || (!db && !outFile)) {
  console.error("GOOGLE_PLACES_API_KEY en SUPABASE_DB_URL (of --out bestand) zijn nodig.");
  process.exit(2);
}

const psql = (sql) => execFileSync("psql", [db, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

async function rest(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

async function due() {
  if (db) {
    return JSON.parse(
      psql(`select coalesce(json_agg(r), '[]') from (
        select p.id, p.name, p.town, p.lat, p.lng, g.google_place_id
          from public.places p left join public.place_google g on g.place_id = p.id
         where p.status = 'published' and p.merged_into is null
           and (g.checked_at is null or ${again ? "true" : "g.checked_at < now() - interval '30 days'"})
         order by g.checked_at nulls first, p.id limit ${limit}) r`),
    );
  }
  const places = await rest("places?select=id,name,town,lat,lng&status=eq.published&merged_into=is.null&order=id");
  const seen = new Map((await rest("place_google?select=place_id,google_place_id,checked_at&order=place_id")).map((g) => [g.place_id, g]));
  const cutoff = again ? Infinity : Date.now() - 30 * 86400_000;
  return places
    .map((p) => ({ ...p, google_place_id: seen.get(p.id)?.google_place_id ?? null, checked: seen.has(p.id) ? Date.parse(seen.get(p.id).checked_at) : 0 }))
    .filter((p) => p.checked < cutoff)
    .sort((a, b) => a.checked - b.checked)
    .slice(0, limit);
}

const rows = await due();
console.log(`${rows.length} plekken te checken${dry ? " (proefrun, niets wordt bewaard)" : ""}`);

const results = [];
let found = 0, none = 0, failed = 0, streak = 0;
const reviewsOf = (list) =>
  (list ?? []).map((v) => ({ name: v.name, rating: v.rating, text: v.text?.text ?? "", language: v.text?.languageCode, publishTime: v.publishTime }));

for (const p of rows) {
  try {
    let result = null;
    if (p.google_place_id && PLACE_ID.test(p.google_place_id)) {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.google_place_id)}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAILS_MASK },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) {
        results.push({ place_id: p.id, forget: true });
        if (db && !dry) psql(forgetSql(p.id));
        none++;
        continue;
      }
      if (!res.ok) throw new Error(`Google ${res.status}`);
      const j = await res.json();
      const r = ratingOf({ id: p.google_place_id, rating: j.rating, userRatingCount: j.userRatingCount });
      const { details, reviews } = splitCandidate(j);
      result = { google_place_id: p.google_place_id, rating: r?.rating ?? null, rating_count: r?.count ?? null, business_status: j.businessStatus ?? null, primary_type: j.primaryType ?? null, types: j.types ?? [], details, reviews: reviewsOf(reviews) };
    } else {
      const cands = await fetchGoogleCandidates(p, key, fetch, true);
      const c = matchGooglePlace(p, cands);
      if (c) {
        const r = ratingOf(c);
        const { details, reviews } = splitCandidate(c);
        result = { google_place_id: c.id, rating: r?.rating ?? null, rating_count: r?.count ?? null, business_status: c.businessStatus ?? null, primary_type: c.primaryType ?? null, types: c.types ?? [], details, reviews: reviewsOf(reviews) };
      }
    }
    streak = 0;
    result ? found++ : none++;
    if (dry) continue;
    const at = new Date().toISOString();
    results.push({ place_id: p.id, name: p.name, checked_at: at, result });
    if (db) psql(saveSql(p.id, result, at));
  } catch (err) {
    failed++;
    streak++;
    console.error(`${p.name}: ${err.message}`);
    // Drie fouten achter elkaar (quotum op, sleutel geweigerd): stoppen in plaats van door te bellen
    if (streak >= 3) {
      console.error("Drie fouten achter elkaar, gestopt.");
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 120));
}
if (outFile && !dry) writeFileSync(outFile, JSON.stringify(results));
console.log(`klaar: ${found} gevonden, ${none} zonder match of cijfer, ${failed} mislukt${outFile && !dry ? `; ${results.length} resultaten in ${outFile}` : ""}`);
process.exit(failed && streak >= 3 ? 1 : 0);
