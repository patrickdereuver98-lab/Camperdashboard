// Haalt cijfer, aantal en de reviews (zonder naam van de schrijver) van Google Maps op (README 141). Cijfer en aantal gaan
// naar public.place_google, de reviews naar private.place_google_reviews (alleen intern, bronnenbeleid §3c).
//   node scripts/google-ratings.mjs [--limit 250] [--dry]
// Pakt de plekken zonder check of met een check ouder dan 30 dagen; nieuwste achteraan. Eerste ronde: --limit 3000.
// Nodig: GOOGLE_PLACES_API_KEY en SUPABASE_DB_URL (psql). Reviews nooit op de site.
import { execFileSync } from "node:child_process";
import { fetchGoogleCandidates, matchGooglePlace, ratingOf, PLACE_ID } from "../src/lib/google-rating.ts";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Math.min(Math.max(Number(args[args.indexOf("--limit") + 1]) || 250, 1), 5000);
const key = process.env.GOOGLE_PLACES_API_KEY;
const db = process.env.SUPABASE_DB_URL;
if (!key || !db) {
  console.error("GOOGLE_PLACES_API_KEY en SUPABASE_DB_URL zijn nodig.");
  process.exit(2);
}

const psql = (sql) => execFileSync("psql", [db, "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

const rows = JSON.parse(
  psql(`select coalesce(json_agg(r), '[]') from (
    select p.id, p.name, p.town, p.lat, p.lng, g.google_place_id
      from public.places p left join public.place_google g on g.place_id = p.id
     where p.status = 'published' and p.merged_into is null
       and (g.checked_at is null or g.checked_at < now() - interval '30 days')
     order by g.checked_at nulls first, p.id
     limit ${limit}) r`),
);
console.log(`${rows.length} plekken te checken${dry ? " (proefrun, niets wordt geschreven)" : ""}`);

const UUID = /^[0-9a-f-]{36}$/;
const num = (n) => (Number.isFinite(n) ? n : "null");
// Tekst via base64, zodat er niets in de SQL kan ontsnappen
const b64 = (t) => `convert_from(decode('${Buffer.from(String(t ?? ""), "utf8").toString("base64")}', 'base64'), 'UTF8')`;
function saveReview(placeId, r) {
  if (!r?.name || !/^places\/[A-Za-z0-9_-]+\/reviews\/[A-Za-z0-9_-]+$/.test(r.name)) return;
  const rating = Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : "null";
  const lang = /^[A-Za-z-]{2,12}$/.test(r.text?.languageCode ?? "") ? `'${r.text.languageCode}'` : "null";
  const when = Number.isFinite(Date.parse(r.publishTime)) ? `'${new Date(r.publishTime).toISOString()}'` : "null";
  psql(`insert into private.place_google_reviews (place_id, review_ref, rating, body, language, published_at)
        values ('${placeId}', '${r.name}', ${rating}, ${b64(r.text?.text)}, ${lang}, ${when})
        on conflict (place_id, review_ref) do update set rating = excluded.rating, body = excluded.body, fetched_at = now()`);
}

let found = 0, none = 0, failed = 0, streak = 0;

for (const p of rows) {
  if (!UUID.test(p.id)) continue;
  try {
    let id = null, rating = null, count = null, status = null, reviews = [];
    if (p.google_place_id && PLACE_ID.test(p.google_place_id)) {
      // Bekende place_id: één goedkope aanroep voor cijfer, aantal en status
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.google_place_id)}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,rating,userRatingCount,businessStatus,reviews.name,reviews.rating,reviews.text,reviews.publishTime" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) {
        // Verlopen place_id: wissen, de volgende ronde zoekt opnieuw
        if (!dry) psql(`delete from public.place_google where place_id = '${p.id}'`);
        none++;
        continue;
      }
      if (!res.ok) throw new Error(`Google ${res.status}`);
      const j = await res.json();
      id = p.google_place_id;
      const r = ratingOf({ id, rating: j.rating, userRatingCount: j.userRatingCount });
      rating = r?.rating ?? null;
      count = r?.count ?? null;
      status = j.businessStatus ?? null;
      reviews = j.reviews ?? [];
    } else {
      const c = matchGooglePlace(p, await fetchGoogleCandidates(p, key, fetch, true));
      if (c) {
        id = c.id;
        const r = ratingOf(c);
        rating = r?.rating ?? null;
        count = r?.count ?? null;
        reviews = c.reviews ?? [];
      }
    }
    streak = 0;
    id ? found++ : none++;
    if (dry) continue;
    for (const r of reviews) saveReview(p.id, r);
    const st = ["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"].includes(status) ? `'${status}'` : "null";
    psql(`insert into public.place_google (place_id, google_place_id, rating, rating_count, business_status, checked_at)
          values ('${p.id}', ${id ? `'${id}'` : "null"}, ${num(rating)}, ${num(count)}, ${st}, now())
          on conflict (place_id) do update set google_place_id = excluded.google_place_id, rating = excluded.rating,
            rating_count = excluded.rating_count, business_status = excluded.business_status, checked_at = excluded.checked_at`);
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
console.log(`klaar: ${found} gevonden, ${none} zonder match of cijfer, ${failed} mislukt`);
process.exit(failed && streak >= 3 ? 1 : 0);
