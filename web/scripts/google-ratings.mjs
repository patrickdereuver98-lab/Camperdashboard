// Haalt cijfer en aantal reviews van Google Maps op en bewaart ze in public.place_google (README 141).
//   node scripts/google-ratings.mjs [--limit 250] [--dry]
// Pakt de plekken zonder check of met een check ouder dan 30 dagen; nieuwste achteraan. Eerste ronde: --limit 3000.
// Nodig: GOOGLE_PLACES_API_KEY en SUPABASE_DB_URL (psql). Alleen cijfer, aantal, place_id en status; nooit teksten.
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
let found = 0, none = 0, failed = 0, streak = 0;

for (const p of rows) {
  if (!UUID.test(p.id)) continue;
  try {
    let id = null, rating = null, count = null, status = null;
    if (p.google_place_id && PLACE_ID.test(p.google_place_id)) {
      // Bekende place_id: één goedkope aanroep voor cijfer, aantal en status
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(p.google_place_id)}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "id,rating,userRatingCount,businessStatus" },
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
    } else {
      const c = matchGooglePlace(p, await fetchGoogleCandidates(p, key));
      if (c) {
        id = c.id;
        const r = ratingOf(c);
        rating = r?.rating ?? null;
        count = r?.count ?? null;
      }
    }
    streak = 0;
    id ? found++ : none++;
    if (dry) continue;
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
