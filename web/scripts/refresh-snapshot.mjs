// Ververst src/data/snapshot.json uit de openbare REST-API van Supabase: precies wat de site zelf mag lezen.
// De snapshot is de terugval van de site en de bron voor `VRIJSTAAN_OFFLINE=1 npm run build`.
//
// Gebruik: node scripts/refresh-snapshot.mjs   (draait wekelijks in .github/workflows/snapshot.yml)
import { writeFile } from "node:fs/promises";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkrmthrhwmmmwswmfgwc.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_EGEUx5L3Df4w18_DgmtbHw_6RUoglht";

// Gelijk houden met PLACE_COLUMNS in src/lib/places.ts
const PLACE_COLUMNS =
  "id,slug,name,kind,lat,lng,street,postcode,town,province,description,description_source,price_eur,price_note," +
  "tourist_tax_included,power,water,dump_station,toilet,shower,wifi,dogs,capacity,max_length_m,surface,open_all_year," +
  "season,reservation,max_stay_nights,website,phone,email,image_url,image_credit,photos,rating_avg,rating_count," +
  "completeness,verified_at,updated_at,departure,checkout_until,checkin_from,access_hours,access_24h,times_note,price_extras," +
  "departure_check,departure_checked_at,departure_checked_by";
const REVIEW_COLUMNS =
  "id,place_id,author_name,rating,score_location,score_quiet,score_facilities,score_value,title,body,vehicle,visited_month,created_at";

async function rest(path) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL}/rest/v1/${path}&limit=1000&offset=${offset}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status} op ${path.split("?")[0]}: ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

// Zelfde omzetting als toCamel() in src/lib/places.ts: camelCase, null weg, numeric-tekst als getal
const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
function toCamel(row) {
  const out = {};
  for (const [k, v] of Object.entries(row))
    if (v !== null) out[camel(k)] = typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v) && /(eur|avg|_m)$/.test(k) ? Number(v) : v;
  return out;
}

const [places, towns, faq, reviews] = await Promise.all([
  rest(`places?select=${PLACE_COLUMNS}&status=eq.published&order=slug`),
  rest("nl_towns?select=name,province,lat,lng&order=name"),
  rest("faq?select=id,category,question,answer,position&published=eq.true&order=category,position"),
  rest(`reviews?select=${REVIEW_COLUMNS}&status=eq.approved&order=created_at`),
]);

// Een lege of halve export mag de bestaande snapshot nooit overschrijven
if (places.length < 500 || towns.length < 100) throw new Error(`Te weinig data: ${places.length} plekken, ${towns.length} plaatsen`);

const snapshot = { places: places.map(toCamel), towns, faq, reviews: reviews.map(toCamel) };
const file = new globalThis.URL("../src/data/snapshot.json", import.meta.url);
await writeFile(file, JSON.stringify(snapshot));
console.log(`${places.length} plekken, ${towns.length} plaatsen, ${faq.length} vragen, ${reviews.length} reviews → src/data/snapshot.json`);
