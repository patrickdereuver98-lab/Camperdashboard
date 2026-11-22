// SQL voor het bewaren van één Google-resultaat (README 141); gedeeld door de job en het inladen van een resultaatbestand.
// Alle waarden zijn gecontroleerd of via base64 in de SQL gezet, zodat er niets kan ontsnappen.
import { PLACE_ID } from "../src/lib/google-rating.ts";
import { reviewStats } from "../src/lib/google-quality.ts";

const UUID = /^[0-9a-f-]{36}$/;
const STATUSES = ["OPERATIONAL", "CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY"];
const num = (n) => (Number.isFinite(n) ? n : "null");
const b64 = (t) => `convert_from(decode('${Buffer.from(String(t ?? ""), "utf8").toString("base64")}', 'base64'), 'UTF8')`;

/** result: { google_place_id, rating, rating_count, business_status, reviews: [{ name, rating, text, language, publishTime }] } of null bij geen match */
export function saveSql(placeId, r, checkedAt = new Date().toISOString()) {
  if (!UUID.test(placeId)) return "";
  const id = r?.google_place_id && PLACE_ID.test(r.google_place_id) ? `'${r.google_place_id}'` : "null";
  const rating = Number.isFinite(r?.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : "null";
  const count = Number.isInteger(r?.rating_count) && r.rating_count >= 0 ? r.rating_count : "null";
  const st = STATUSES.includes(r?.business_status) ? `'${r.business_status}'` : "null";
  const when = Number.isFinite(Date.parse(checkedAt)) ? `'${new Date(checkedAt).toISOString()}'` : "now()";
  const stats = reviewStats(r?.reviews ?? [], Date.parse(checkedAt) || Date.now());
  const primary = /^[a-z_]{2,60}$/.test(r?.primary_type ?? "") ? `'${r.primary_type}'` : "null";
  const types = Array.isArray(r?.types) ? r.types.filter((t) => /^[a-z_]{2,60}$/.test(t)) : [];
  const typesSql = types.length ? `array[${types.map((t) => `'${t}'`).join(",")}]::text[]` : "null";
  const newest = stats.newest ? `'${stats.newest}'` : "null";
  let sql = `insert into public.place_google (place_id, google_place_id, rating, rating_count, business_status, checked_at,
      primary_type, types, reviews_sampled, reviews_recent, newest_review_at)
    values ('${placeId}', ${id}, ${rating}, ${count}, ${st}, ${when}, ${primary}, ${typesSql}, ${stats.sampled}, ${stats.recent}, ${newest})
    on conflict (place_id) do update set google_place_id = excluded.google_place_id, rating = excluded.rating,
      rating_count = excluded.rating_count, business_status = excluded.business_status, checked_at = excluded.checked_at,
      primary_type = excluded.primary_type, types = excluded.types, reviews_sampled = excluded.reviews_sampled,
      reviews_recent = excluded.reviews_recent, newest_review_at = excluded.newest_review_at;\n`;
  if (r?.details && typeof r.details === "object") {
    sql += `insert into private.place_google_details (place_id, details, fetched_at)
      values ('${placeId}', convert_from(decode('${Buffer.from(JSON.stringify(r.details), "utf8").toString("base64")}', 'base64'), 'UTF8')::jsonb, ${when})
      on conflict (place_id) do update set details = excluded.details, fetched_at = excluded.fetched_at;\n`;
  }
  for (const v of r?.reviews ?? []) {
    if (!v?.name || !/^places\/[A-Za-z0-9_-]+\/reviews\/[A-Za-z0-9_-]+$/.test(v.name)) continue;
    const rt = Number.isInteger(v.rating) && v.rating >= 1 && v.rating <= 5 ? v.rating : "null";
    const lang = /^[A-Za-z-]{2,12}$/.test(v.language ?? "") ? `'${v.language}'` : "null";
    const pub = Number.isFinite(Date.parse(v.publishTime)) ? `'${new Date(v.publishTime).toISOString()}'` : "null";
    sql += `insert into private.place_google_reviews (place_id, review_ref, rating, body, language, published_at)
      values ('${placeId}', '${v.name}', ${rt}, ${b64(v.text)}, ${lang}, ${pub})
      on conflict (place_id, review_ref) do update set rating = excluded.rating, body = excluded.body, fetched_at = now();\n`;
  }
  return sql;
}

/** Een verlopen of onbekende place_id: de rij weg, de volgende ronde zoekt opnieuw */
export const forgetSql = (placeId) => (UUID.test(placeId) ? `delete from public.place_google where place_id = '${placeId}';\n` : "");

/** Een plek die Google kent (ontdekken); matched_place_id staat al klaar als wij haar kennen */
export function foundSql(f) {
  if (!f?.google_place_id || !PLACE_ID.test(f.google_place_id)) return "";
  const text = (v) => (v == null ? "null" : b64(v));
  const types = Array.isArray(f.types) ? f.types.filter((t) => /^[a-z_]{2,60}$/.test(t)) : [];
  const primary = /^[a-z_]{2,60}$/.test(f.primary_type ?? "") ? `'${f.primary_type}'` : "null";
  const st = STATUSES.includes(f.business_status) ? `'${f.business_status}'` : "null";
  const rating = Number.isFinite(f.rating) && f.rating >= 1 && f.rating <= 5 ? f.rating : "null";
  const count = Number.isInteger(f.rating_count) && f.rating_count >= 0 ? f.rating_count : "null";
  const lat = Number.isFinite(f.lat) ? f.lat : "null";
  const lng = Number.isFinite(f.lng) ? f.lng : "null";
  const match = UUID.test(f.matched_place_id ?? "") ? `'${f.matched_place_id}'` : "null";
  const m = Number.isInteger(f.matched_m) ? f.matched_m : "null";
  const q = String(f.query ?? "").slice(0, 60).replace(/[^\p{L}\p{N} _-]/gu, "");
  return `insert into private.google_found (google_place_id, name, lat, lng, primary_type, types, business_status, rating, rating_count, address, website, query, matched_place_id, matched_m)
    values ('${f.google_place_id}', ${text(f.name)}, ${lat}, ${lng}, ${primary}, ${types.length ? `array[${types.map((t) => `'${t}'`).join(",")}]::text[]` : "null"}, ${st}, ${rating}, ${count}, ${text(f.address)}, ${text(f.website)}, '${q}', ${match}, ${m})
    on conflict (google_place_id) do update set name = excluded.name, lat = excluded.lat, lng = excluded.lng, primary_type = excluded.primary_type,
      types = excluded.types, business_status = excluded.business_status, rating = excluded.rating, rating_count = excluded.rating_count,
      address = excluded.address, website = excluded.website, matched_place_id = excluded.matched_place_id, matched_m = excluded.matched_m, found_at = now();\n`;
}
