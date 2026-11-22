// SQL voor het bewaren van één Google-resultaat (README 141); gedeeld door de job en het inladen van een resultaatbestand.
// Alle waarden zijn gecontroleerd of via base64 in de SQL gezet, zodat er niets kan ontsnappen.
import { PLACE_ID } from "../src/lib/google-rating.ts";

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
  let sql = `insert into public.place_google (place_id, google_place_id, rating, rating_count, business_status, checked_at)
    values ('${placeId}', ${id}, ${rating}, ${count}, ${st}, ${when})
    on conflict (place_id) do update set google_place_id = excluded.google_place_id, rating = excluded.rating,
      rating_count = excluded.rating_count, business_status = excluded.business_status, checked_at = excluded.checked_at;\n`;
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
