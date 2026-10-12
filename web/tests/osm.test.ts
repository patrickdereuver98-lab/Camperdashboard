import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isMotorhomePlace, mapOsm, osmBool, placeName, placesQuery } from "../supabase/functions/pipeline/osm.ts";

const el = (tags: Record<string, string>, extra: Record<string, unknown> = {}) => ({ type: "node", id: 1, lat: 52.1, lon: 5.1, tags, ...extra });

// ── Toelating ────────────────────────────────────────────────────────────────

test("toegelaten: tourism=caravan_site of motorhome=yes/designated", () => {
  assert.equal(isMotorhomePlace({ tourism: "caravan_site" }), true);
  assert.equal(isMotorhomePlace({ amenity: "parking", motorhome: "yes" }), true);
  assert.equal(isMotorhomePlace({ tourism: "camp_site", motorhome: "designated" }), true);
  assert.equal(isMotorhomePlace({ tourism: "camp_site", motorhome: "Yes;fee" }), true);
});

test("geweigerd: camping zonder motorhome-tag, motorhome=no, gewone parkeerplaats", () => {
  assert.equal(isMotorhomePlace({ tourism: "camp_site" }), false);
  assert.equal(isMotorhomePlace({ tourism: "camp_site", motorhome: "no" }), false);
  assert.equal(isMotorhomePlace({ amenity: "parking" }), false);
  assert.equal(isMotorhomePlace({ amenity: "parking", motorhome: "unknown" }), false);
  assert.equal(mapOsm(el({ tourism: "camp_site", name: "De Wei" })), null);
});

test("Overpass-query vraagt alleen caravan_site en motorhome=yes|designated op", () => {
  const q = placesQuery("NL-UT");
  assert.match(q, /\["tourism"="caravan_site"\]/);
  assert.match(q, /\["motorhome"~"\^\(yes\|designated\)\$",i\]/);
  assert.doesNotMatch(q, /camp_site/);
  assert.doesNotMatch(q, /!=/);
});

test("geweigerd: privé, buiten gebruik, buiten Nederland, zonder coördinaten", () => {
  assert.equal(mapOsm(el({ tourism: "caravan_site", access: "private" })), null);
  assert.equal(mapOsm(el({ tourism: "caravan_site", access: "no" })), null);
  assert.equal(mapOsm(el({ tourism: "caravan_site", disused: "yes" })), null);
  assert.equal(mapOsm(el({ "disused:tourism": "caravan_site" })), null);
  assert.equal(mapOsm(el({ tourism: "caravan_site" }, { lat: 48.8, lon: 2.3 })), null);
  assert.equal(mapOsm({ type: "way", id: 2, tags: { tourism: "caravan_site" } }), null);
});

test("way/relation gebruikt het middelpunt", () => {
  const row = mapOsm({ type: "way", id: 9, center: { lat: 52.3, lon: 4.9 }, tags: { tourism: "caravan_site", name: "Haven" } });
  assert.equal(row?.lat, 52.3);
  assert.equal(row?.lng, 4.9);
  assert.equal(row?.osm_type, "way");
});

// ── Naam ─────────────────────────────────────────────────────────────────────

test("naam: name:nl gaat voor name, daarna official_name, alt_name, short_name, brand", () => {
  assert.equal(placeName({ name: "Stellplatz am See", "name:nl": "Camperplaats aan het meer" }), "Camperplaats aan het meer");
  assert.equal(placeName({ official_name: "Jachthaven De Kreupel" }), "Jachthaven De Kreupel");
  assert.equal(placeName({ alt_name: "Boerderij Ons Genoegen" }), "Boerderij Ons Genoegen");
  assert.equal(placeName({ brand: "Camperpark Nederland" }), "Camperpark Nederland");
});

test("naam: nietszeggende of lege namen tellen als ontbrekend (fallback in de database)", () => {
  for (const name of ["Camperplaats", "camperplaatsen", "P", "P3", "Parking", "Stellplatz", "Wohnmobilstellplatz", "yes", "  ", "-", "x"]) {
    assert.equal(placeName({ name }), undefined, name);
  }
  assert.equal(placeName({ name: "Camperplaats", alt_name: "De Groene Weide" }), "De Groene Weide");
  const row = mapOsm(el({ tourism: "caravan_site", name: "Camperplaats" }));
  assert.ok(row);
  assert.equal("name" in row, false);
});

test("naam: witruimte wordt opgeschoond", () => {
  assert.equal(placeName({ name: "  De   Kleine  Wielen " }), "De Kleine Wielen");
});

// ── Booleans ─────────────────────────────────────────────────────────────────

test("osmBool: alleen bekende waarden, de rest is onbekend", () => {
  for (const v of ["yes", "YES", " yes ", "designated", "customers", "permissive", "limited", "seasonal", "yes;fee"]) assert.equal(osmBool(v), true, v);
  for (const v of ["no", "No", "false", "0", "none", "private", "no;yes"]) assert.equal(osmBool(v), false, v);
  for (const v of [undefined, "", "unknown", "?", "maybe", "hot", "wlan", "leashed", "free"]) assert.equal(osmBool(v), undefined, String(v));
});

test("osmBool per tag: douche, internet, honden, stroom, reserveren, kosten", () => {
  assert.equal(osmBool("hot", "shower"), true);
  assert.equal(osmBool("no", "shower"), false);
  assert.equal(osmBool("wlan", "internet"), true);
  assert.equal(osmBool("unknown", "internet"), undefined);
  assert.equal(osmBool("leashed", "dog"), true);
  assert.equal(osmBool("CEE 16A", "power"), true);
  assert.equal(osmBool("ja hoor", "power"), undefined);
  assert.equal(osmBool("cee_blue", "power"), true);
  assert.equal(osmBool("required", "reservation"), true);
  assert.equal(osmBool("members_only", "reservation"), undefined);
  assert.equal(osmBool("free", "fee"), false);
  assert.equal(osmBool("donation", "fee"), undefined);
});

test("mapOsm: booleans zijn altijd echte true/false of afwezig", () => {
  const row = mapOsm(
    el({
      tourism: "caravan_site",
      name: "De Haven",
      power_supply: "yes",
      drinking_water: "no",
      sanitary_dump_station: "customers",
      toilets: "unknown",
      shower: "hot",
      internet_access: "unknown",
      dog: "leashed",
      reservation: "members_only",
    }),
  )!;
  assert.equal(row.power, true);
  assert.equal(row.water, false);
  assert.equal(row.dump_station, true);
  assert.equal("toilet" in row, false);
  assert.equal(row.shower, true);
  assert.equal("wifi" in row, false, "internet_access=unknown is geen wifi");
  assert.equal(row.dogs, true);
  assert.equal("reservation" in row, false, "onbekende reservering is niet 'nee'");
  for (const k of ["power", "water", "dump_station", "toilet", "shower", "wifi", "dogs", "reservation", "open_all_year"]) {
    if (k in row) assert.equal(typeof row[k], "boolean", k);
  }
});

test("mapOsm: tweede tag als de eerste onbekend is (electricity na power_supply)", () => {
  const row = mapOsm(el({ tourism: "caravan_site", power_supply: "unknown", electricity: "yes" }))!;
  assert.equal(row.power, true);
});

test("mapOsm: fee=no zonder charge betekent gratis", () => {
  assert.equal(mapOsm(el({ tourism: "caravan_site", fee: "no" }))!.price_eur, 0);
  assert.equal("price_eur" in mapOsm(el({ tourism: "caravan_site", fee: "yes" }))!, false);
  assert.equal(mapOsm(el({ tourism: "caravan_site", fee: "yes", charge: "12.50 EUR" }))!.price_eur, 12.5);
});
