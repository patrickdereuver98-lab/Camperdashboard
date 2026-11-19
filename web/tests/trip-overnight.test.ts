// Overnachten voorstellen als een reisdag te lang wordt (besluit 19 november 2026)
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { legStartKm, placesAlongRoute } from "../src/lib/route-corridor.ts";
import { dayFullFraction, departureRank, fullDayLegs, nearRoute, overnightSuggestions, pickOvernight } from "../src/lib/trip-overnight.ts";
import type { LegPlan } from "../src/lib/trip-plan.ts";
import { planTrip } from "../src/lib/trip-plan.ts";
import { DEFAULT_ROUTE_PREFS } from "../src/lib/route-prefs.ts";

const lp = (p: Partial<LegPlan>): LegPlan => ({
  day: 0,
  departMin: 600,
  departSource: "jij",
  driveMin: 300,
  pauseMin: 0,
  arriveMin: 900,
  status: "onbekend",
  dayDriveMin: 300,
  overLimit: true,
  ...p,
});

test("dag vol: deel van de etappe waar je rijtijd op is", () => {
  // 5 uur rijden, je wilt er 4: de dag is vol na 80% van de etappe
  assert.equal(dayFullFraction(lp({}), 240), 0.8);
  // Na een tussenstop met al 2 uur rijden: nog 2 uur over van een etappe van 4 uur
  assert.equal(dayFullFraction(lp({ driveMin: 240, dayDriveMin: 360 }), 240), 0.5);
  // Al vol voor deze etappe begon: meteen bij het begin
  assert.equal(dayFullFraction(lp({ driveMin: 60, dayDriveMin: 300 }), 120), 0);
  // Niet te lang of geen grens: niets
  assert.equal(dayFullFraction(lp({ overLimit: false }), 240), undefined);
  assert.equal(dayFullFraction(lp({}), 0), undefined);
});

test("per dag alleen de eerste te lange etappe", () => {
  const legs = [lp({ day: 0, overLimit: false }), lp({ day: 0 }), lp({ day: 0 }), undefined, lp({ day: 2 })];
  assert.deepEqual(fullDayLegs(legs), [1, 4]);
});

test("vertrektijd: zonder vaste tijd eerst, onbekend daarna, vaste tijd laatst", () => {
  assert.equal(departureRank({ departure: "vrij" }), 0);
  assert.equal(departureRank({ departure: "per24" }), 0);
  assert.equal(departureRank({}), 1);
  assert.equal(departureRank({ departure: "vrij", departureCheck: "afgewezen" }), 1);
  assert.equal(departureRank({ departure: "vast", checkoutUntil: "11:00" }), 2);
});

// Rechte lijn van west naar oost langs 52° N, ±205 km lang
const geometry: [number, number][] = Array.from({ length: 31 }, (_, i) => [4 + i * 0.1, 52]);
const waypoints = [{ lat: 52, lng: 4 }, { lat: 52, lng: 7 }];
const place = (slug: string, lng: number, extra = {}) => ({ slug, lat: 52.01, lng, ...extra });

test("voorstellen rond het punt waar de dag vol is: hoogstens 3, vrije vertrektijd eerst", () => {
  const places = [
    place("vast-dichtbij", 5.4, { departure: "vast", checkoutUntil: "10:00" }),
    place("vrij-iets-eerder", 5.1, { departure: "vrij" }),
    place("onbekend", 5.38),
    place("vrij-precies", 5.4, { departure: "vrij" }),
    place("te-vroeg", 4.2, { departure: "vrij" }),
    place("te-ver-van-de-route", 5.4, { lat: 52.5, departure: "vrij" }),
  ];
  const hits = [5, 10].map((w) => placesAlongRoute(geometry, waypoints, places, w));
  const starts = legStartKm(geometry, waypoints);
  // Dag vol op ±96 km (lengtegraad 5.4)
  const fullKm = (5.4 - 4) * 111.195 * Math.cos((52 * Math.PI) / 180);
  const picked = pickOvernight(hits, 0, fullKm).map((h) => h.item.slug);
  assert.deepEqual(picked, ["vrij-precies", "vrij-iets-eerder", "onbekend"]);
  assert.ok(starts.length === 2);
});

test("breder zoeken als de smalle strook te weinig plekken geeft", () => {
  const places = [place("op-7-km", 5.4, { lat: 52.065, departure: "vrij" })];
  const hits = [5, 10].map((w) => placesAlongRoute(geometry, waypoints, places, w));
  const fullKm = (5.4 - 4) * 111.195 * Math.cos((52 * Math.PI) / 180);
  assert.deepEqual(pickOvernight(hits, 0, fullKm).map((h) => h.item.slug), ["op-7-km"]);
});

test("alleen plekken in de buurt van de route rekenen we door", () => {
  const items = [place("bij", 5), place("ver", 5, { lat: 55 }), place("oost", 9)];
  assert.deepEqual(nearRoute(geometry, items).map((p) => p.slug), ["bij"]);
});

test("van dagplanning tot voorstel: te lange dag geeft voorstellen, korte dag niet", () => {
  const stops = [{ nights: 1, place: {} }, { nights: 1, place: {} }];
  const legs = [undefined, { distanceM: 205000, durationS: 5 * 3600 }];
  const prefs = { ...DEFAULT_ROUTE_PREFS, pauseMin: 0, maxDriveMin: 240 };
  const plan = planTrip({ stops, legs, prefs });
  const target = { routeLeg: 0, plan: plan.legs[1]! };
  const places = [place("halverwege", 5.5, { departure: "vrij" }), place("bij-vol", 6.4, { departure: "vrij" }), place("aan-het-eind", 6.95)];
  const out = overnightSuggestions({ geometry, waypoints, legStarts: legStartKm(geometry, waypoints), places, legs: [target], maxDriveMin: 240 });
  const got = out.get(0)!;
  assert.equal(got.fraction, 0.8);
  // Vol na 80% (±164 km): halverwege (±103 km) ligt te vroeg, aan het eind (±202 km) te ver erna
  assert.deepEqual(got.hits.map((h) => h.item.slug), ["bij-vol"]);
  // Korte dag: geen te lange etappe, dan ook geen voorstel
  const short = planTrip({ stops, legs: [undefined, { distanceM: 100000, durationS: 2 * 3600 }], prefs });
  assert.deepEqual(fullDayLegs(short.legs), []);
});
