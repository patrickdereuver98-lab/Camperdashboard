// Zoekt met de Google Places API naar camperplaatsen en campings (README 141, opdracht Patrick 22 november 2026) en
// vergelijkt ze met onze plekken: wat Google kent en wij niet, is een aanwijzing voor Beheer, geen plek.
//   node --no-warnings --import ./tests/register.mjs scripts/google-discover.mjs --out ontdekt.json
//        [--bbox zuid,west,noord,oost] [--max-calls 600] [--dry]
// Standaard heel Nederland. Per cel van ongeveer 13 bij 14 km twee zoekopdrachten ("camperplaats" en "camping"), met
// paginering (hoogstens 60 per opdracht). Haalt Google de limiet van 60, dan staat de cel in `vol` en is hij te groot.
// Nodig: GOOGLE_PLACES_API_KEY. Gelezen wordt met de openbare sleutel; opslaan doet scripts/google-ingest.mjs.
import { writeFileSync } from "node:fs";
import { gridCells, matchKnown, searchRect } from "../src/lib/google-rating.ts";

const args = process.argv.slice(2);
const flag = (n) => args[args.indexOf(n) + 1];
const key = process.env.GOOGLE_PLACES_API_KEY;
const outFile = args.includes("--out") ? flag("--out") : null;
const dry = args.includes("--dry");
const maxCalls = Math.min(Math.max(Number(flag("--max-calls")) || 600, 1), 5000);
const NL = { south: 50.75, west: 3.35, north: 53.55, east: 7.25 };
const bbox = args.includes("--bbox")
  ? Object.fromEntries(flag("--bbox").split(",").map(Number).map((v, i) => [["south", "west", "north", "east"][i], v]))
  : NL;
if (!key || !outFile || ![bbox.south, bbox.west, bbox.north, bbox.east].every(Number.isFinite)) {
  console.error("GOOGLE_PLACES_API_KEY, --out en een geldige --bbox zuid,west,noord,oost zijn nodig.");
  process.exit(2);
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkrmthrhwmmmwswmfgwc.supabase.co";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_EGEUx5L3Df4w18_DgmtbHw_6RUoglht";
async function ours() {
  const out = [];
  for (let o = 0; ; o += 1000) {
    const res = await fetch(`${URL_}/rest/v1/places?select=id,name,lat,lng&order=id&limit=1000&offset=${o}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const known = await ours();
const cells = gridCells(bbox);
const QUERIES = ["camperplaats", "camping"];
console.log(`${cells.length} cellen × ${QUERIES.length} zoekopdrachten, ${known.length} eigen plekken om mee te vergelijken${dry ? " (proefrun)" : ""}`);

const found = new Map();
const vol = [];
let calls = 0, failed = 0, streak = 0;
outer: for (const [i, cell] of cells.entries()) {
  for (const q of QUERIES) {
    if (calls >= maxCalls) {
      console.error(`Limiet van ${maxCalls} aanroepen bereikt bij cel ${i + 1} van ${cells.length}`);
      break outer;
    }
    try {
      const r = await searchRect(cell, q, key);
      calls += r.calls;
      streak = 0;
      if (r.full) vol.push({ ...cell, query: q });
      for (const p of r.places) {
        const lat = p.location?.latitude, lng = p.location?.longitude;
        if (!p.id || typeof lat !== "number" || typeof lng !== "number") continue;
        if (!found.has(p.id)) found.set(p.id, { google_place_id: p.id, name: p.displayName?.text ?? "", lat, lng, primary_type: p.primaryType ?? null, types: p.types ?? [], business_status: p.businessStatus ?? null, rating: p.rating ?? null, rating_count: p.userRatingCount ?? null, address: p.formattedAddress ?? null, website: p.websiteUri ?? null, query: q });
      }
    } catch (err) {
      failed++;
      streak++;
      console.error(`cel ${i + 1} (${q}): ${err.message}`);
      if (streak >= 3) {
        console.error("Drie fouten achter elkaar, gestopt.");
        break outer;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

let matched = 0;
for (const f of found.values()) {
  const m = matchKnown(f, known);
  if (m) {
    f.matched_place_id = m.id;
    f.matched_m = m.meters;
    matched++;
  }
}
const list = [...found.values()];
const CAMP = /campground|rv_park|camping_cabin|campsite/;
const campLike = list.filter((f) => f.types.some((t) => CAMP.test(t)));
console.log(`${list.length} plekken gevonden (${campLike.length} met een kampeertype), ${matched} kennen we al, ${list.length - matched} niet; ${vol.length} cellen vol (te groot); ${calls} aanroepen, ${failed} fouten`);
if (!dry) writeFileSync(outFile, JSON.stringify({ kind: "discover", bbox, calls, vol, found: list }));
process.exit(failed && streak >= 3 ? 1 : 0);
