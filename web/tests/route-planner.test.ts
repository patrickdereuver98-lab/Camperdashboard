import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkPoints, optionsKey, parseOptionsKey, parseRouteOptions, routeOptionsQuery } from "../src/lib/route-options.ts";
import { cleanRouteEnds, cleanRoutePrefs, DEFAULT_ROUTE_PREFS, endPoint } from "../src/lib/route-prefs.ts";
import { arrivalStatus, clock, driveTime, planTrip, type PlanPlace } from "../src/lib/trip-plan.ts";
import { optimizeOrder, routeCost } from "../src/lib/trip-optimize.ts";
import { legBreaks, placesAlongRoute } from "../src/lib/route-corridor.ts";
import { buildGpx, buildIcs, googleMapsParts, GMAPS_MAX_WAYPOINTS } from "../src/lib/trip-export.ts";
import { tripDates } from "../src/lib/trip-dates.ts";
import { tripCosts } from "../src/lib/trip-extras.ts";
import type { PlaceSummary } from "../src/lib/types.ts";

// ── Punten en opties ────────────────────────────────────────────────────────

test("checkPoints: Europa mag, daarbuiten met reden", () => {
  assert.equal(checkPoints("52.1,5.1;48.85,2.35", 2, 27).ok, true); // Utrecht naar Parijs
  assert.equal(checkPoints("52.1,5.1;43.3,-1.98", 2, 27).ok, true); // San Sebastián
  assert.deepEqual(checkPoints("52.1,5.1;33.5,-7.6", 2, 27), { ok: false, reason: "buiten" }); // Casablanca
  assert.deepEqual(checkPoints("52.1,5.1", 2, 27), { ok: false, reason: "aantal" });
  assert.deepEqual(checkPoints("52.1,x;52,5", 2, 27), { ok: false, reason: "formaat" });
  assert.deepEqual(checkPoints(null, 2, 27), { ok: false, reason: "aantal" });
});

test("routeopties: querystring heen en terug, waarden buiten de grenzen vallen weg", () => {
  const q = routeOptionsQuery({ heightM: 3.1, weightKg: 3500, avoid: ["ferries", "tolls"] });
  assert.equal(q, "&h=3.1&w=3500&x=tolls%2Cferries");
  const back = parseRouteOptions(new URLSearchParams(q.slice(1)));
  assert.deepEqual(back, { heightM: 3.1, weightKg: 3500, avoid: ["tolls", "ferries"] });
  assert.deepEqual(parseRouteOptions(new URLSearchParams("h=9&w=abc&x=snelweg")), { avoid: [] });
  assert.equal(routeOptionsQuery({ avoid: [] }), "");
});

test("routeopties: cachesleutel heen en terug", () => {
  const o = { heightM: 3.2, lengthM: 7.4, avoid: ["highways" as const, "tolls" as const] };
  assert.equal(optionsKey(o), "h3.2|l7.4|xtolls+highways");
  assert.deepEqual(parseOptionsKey(optionsKey(o)), { heightM: 3.2, lengthM: 7.4, avoid: ["tolls", "highways"] });
  assert.deepEqual(parseOptionsKey(""), { avoid: [] });
});

// ── Voorkeuren ──────────────────────────────────────────────────────────────

test("routevoorkeuren: rommel wordt de standaard, grenzen gelden", () => {
  assert.deepEqual(cleanRoutePrefs(null), DEFAULT_ROUTE_PREFS);
  const p = cleanRoutePrefs({ departTime: "9.30", maxDriveMin: 10000, pauseMin: -5, slowerPct: 20, avoid: ["tolls", "x"], useVehicle: false });
  assert.equal(p.departTime, "09:30");
  assert.equal(p.maxDriveMin, 960);
  assert.equal(p.pauseMin, 0);
  assert.equal(p.slowerPct, 20);
  assert.deepEqual(p.avoid, ["tolls"]);
  assert.equal(p.useVehicle, false);
  assert.equal(cleanRoutePrefs({ departTime: "25:00" }).departTime, "10:00");
});

test("begin- en eindpunt: terug naar start kan alleen met een beginpunt", () => {
  assert.deepEqual(cleanRouteEnds({ end: "start" }), { start: null, end: "laatste" });
  const home = { label: "Thuis", lat: 52, lng: 5, kind: "adres" };
  const e = cleanRouteEnds({ start: home, end: "start" });
  assert.equal(e.end, "start");
  assert.deepEqual(endPoint(e), home);
  assert.equal(endPoint(cleanRouteEnds({ start: home })), null);
  assert.equal(cleanRouteEnds({ start: { lat: 200, lng: 5 } }).start, null);
});

// ── Dagplanning ─────────────────────────────────────────────────────────────

const prefs = { ...DEFAULT_ROUTE_PREFS, departTime: "10:00", maxDriveMin: 240, pauseMin: 15, slowerPct: 0, stopoverMin: 45 };
const leg = (min: number) => ({ distanceM: min * 1000, durationS: min * 60 });

test("rijtijd: één pauze per volle 2 uur, niet precies bij aankomst; marge telt mee", () => {
  assert.deepEqual(driveTime(90 * 60, prefs), { driveMin: 90, pauseMin: 0 });
  assert.deepEqual(driveTime(120 * 60, prefs), { driveMin: 120, pauseMin: 0 });
  assert.deepEqual(driveTime(150 * 60, prefs), { driveMin: 150, pauseMin: 15 });
  assert.deepEqual(driveTime(300 * 60, prefs), { driveMin: 300, pauseMin: 30 });
  assert.deepEqual(driveTime(100 * 60, { slowerPct: 20, pauseMin: 15 }), { driveMin: 120, pauseMin: 0 });
});

test("aankomst tegenover de aankomsttijden; onbekend blijft onbekend", () => {
  assert.deepEqual(arrivalStatus(12 * 60, {}), { status: "onbekend" });
  assert.deepEqual(arrivalStatus(12 * 60, { checkinFrom: "14:00" }), { status: "vroeg", waitMin: 120 });
  assert.deepEqual(arrivalStatus(23 * 60, { checkinUntil: "22:00" }), { status: "laat" });
  assert.deepEqual(arrivalStatus(23 * 60, { checkinUntil: "22:00", access24h: true }), { status: "ok" });
  assert.deepEqual(arrivalStatus(15 * 60, { checkinFrom: "14:00", checkinUntil: "22:00" }), { status: "ok" });
});

test("dagplanning: vertrektijd van de plek gaat voor als die eerder is", () => {
  const a: PlanPlace = { departure: "vast", checkoutUntil: "09:00" };
  const b: PlanPlace = { checkinFrom: "14:00" };
  const plan = planTrip({ stops: [{ nights: 2, place: a }, { nights: 1, place: b }], legs: [undefined, leg(90)], prefs });
  const l = plan.legs[1]!;
  assert.equal(l.departSource, "plek");
  assert.equal(l.departMin, 9 * 60);
  assert.equal(l.arriveMin, 10 * 60 + 30);
  assert.equal(l.day, 2);
  assert.equal(l.status, "vroeg");
  assert.equal(l.waitMin, 210);
  assert.equal(plan.arrivalIssues, 1);
});

test("dagplanning: een afgewezen vertrekregel telt niet", () => {
  const a: PlanPlace = { departure: "vast", checkoutUntil: "09:00", departureCheck: "afgewezen" };
  const plan = planTrip({ stops: [{ nights: 1, place: a }, { nights: 1, place: {} }], legs: [undefined, leg(60)], prefs });
  assert.equal(plan.legs[1]!.departSource, "jij");
  assert.equal(plan.legs[1]!.departMin, 600);
});

test("dagplanning: tussenstop rijdt dezelfde dag door en telt mee voor de dagrijtijd", () => {
  const plan = planTrip({
    stops: [{ nights: 0, place: {} }, { nights: 1, place: { checkinUntil: "15:00" } }],
    legs: [leg(150), leg(120)],
    prefs,
  });
  const [first, second] = plan.legs;
  assert.equal(first!.day, 0);
  assert.equal(first!.arriveMin, 600 + 150 + 15);
  assert.equal(second!.departSource, "tussenstop");
  assert.equal(second!.departMin, first!.arriveMin + 45);
  assert.equal(second!.day, 0);
  assert.equal(second!.dayDriveMin, 165 + 120);
  assert.equal(second!.overLimit, true);
  assert.equal(second!.status, "laat");
  assert.equal(plan.driveDays, 1);
  assert.equal(plan.longestDayMin, 285);
});

test("dagplanning: per 24 uur waarschuwt als je later vertrekt dan je aankwam", () => {
  // Aankomst bij de per-24-plek om 11:00, de dag erna vertrek om 10:00: op tijd
  const ok = planTrip({ stops: [{ nights: 1, place: { departure: "per24" } }, { nights: 1, place: {} }], legs: [leg(60), leg(60)], prefs });
  assert.equal(ok.legs[1]!.per24Until, undefined);
  // Vorige plek liet je om 08:00 vertrekken: aankomst 09:00, de dag erna om 10:00 weg = mogelijk een dag extra
  const early = planTrip({
    stops: [{ nights: 1, place: { departure: "vast", checkoutUntil: "08:00" } }, { nights: 1, place: { departure: "per24" } }, { nights: 1, place: {} }],
    legs: [undefined, leg(60), leg(60)],
    prefs,
  });
  assert.equal(early.legs[2]!.per24Until, 9 * 60);
});

test("dagplanning: eindpunt en dagen", () => {
  const plan = planTrip({ stops: [{ nights: 3, place: {} }], legs: [leg(60)], endLeg: leg(60), prefs });
  assert.equal(plan.endLeg!.day, 3);
  assert.equal(plan.driveDays, 2);
});

test("klok: na middernacht met +1 dag", () => {
  assert.equal(clock(615), "10:15");
  assert.equal(clock(25 * 60 + 5), "01:05 (+1 dag)");
});

// ── Tussenstop in datums en kosten ──────────────────────────────────────────

test("tussenstop: dezelfde dag verder, geen nachtprijs, dicht op die dag", () => {
  const start = new Date(2026, 9, 31, 12);
  const summer = { openAllYear: false, season: "1 april – 31 oktober" };
  const d = tripDates(start, [{ nights: 0, place: {} }, { nights: 1, place: summer }]);
  assert.equal(d[0].arrive.getDate(), 31);
  assert.equal(d[0].leave.getDate(), 31);
  assert.equal(d[1].arrive.getDate(), 31);
  const d2 = tripDates(new Date(2026, 10, 2, 12), [{ nights: 0, place: summer }]);
  assert.equal(d2[0].closedNights.length, 1);
  const costs = tripCosts([{ nights: 0, place: { priceEur: 20 } as PlaceSummary }, { nights: 0, place: {} as PlaceSummary }], 2, 1.5);
  assert.equal(costs.stay, 0);
  assert.equal(costs.unknownPriceStops, 0);
  assert.equal(costs.tax, 0);
});

// ── Slimste volgorde ────────────────────────────────────────────────────────

// Punten op een lijn: 0, 10, 20, 30, 40 (kosten = afstand)
const line = [0, 10, 20, 30, 40, 50];
const lineCost = line.map((a) => line.map((b) => Math.abs(a - b)));

test("slimste volgorde: exact, met vast begin", () => {
  const order = optimizeOrder({ cost: lineCost, start: 0, end: null, stops: [4, 2, 5, 1, 3] });
  assert.deepEqual(order, [1, 2, 3, 4, 5]);
});

test("slimste volgorde: rondreis en vast eind", () => {
  const round = optimizeOrder({ cost: lineCost, start: 0, end: 0, stops: [3, 1, 5] });
  assert.equal(routeCost({ cost: lineCost, start: 0, end: 0 }, round), 100);
  const toEnd = optimizeOrder({ cost: lineCost, start: 2, end: 5, stops: [0, 4, 1] });
  assert.deepEqual(toEnd, [1, 0, 4]);
});

test("slimste volgorde: veel stops (heuristiek) vindt de lijn", () => {
  const pts = Array.from({ length: 16 }, (_, i) => i * 5);
  const cost = pts.map((a) => pts.map((b) => Math.abs(a - b)));
  const shuffled = [7, 3, 15, 1, 12, 9, 4, 14, 2, 11, 6, 13, 8, 10, 5];
  const order = optimizeOrder({ cost, start: 0, end: null, stops: shuffled });
  assert.equal(routeCost({ cost, start: 0, end: null }, order), 75);
});

test("slimste volgorde: onbekende rijtijden worden vermeden", () => {
  const cost = [
    [0, 1, null],
    [1, 0, 1],
    [5, 1, 0],
  ];
  assert.deepEqual(optimizeOrder({ cost, start: 0, end: null, stops: [2, 1] }), [1, 2]);
});

// ── Plekken langs de route ──────────────────────────────────────────────────

// Route van west naar oost langs breedte 52, via een tussenstop op lengte 5
const geometry: [number, number][] = [
  [4, 52],
  [4.5, 52],
  [5, 52],
  [5.5, 52],
  [6, 52],
];
const wps = [
  { lat: 52, lng: 4 },
  { lat: 52, lng: 5 },
  { lat: 52, lng: 6 },
];

test("corridor: etappegrenzen in de lijn", () => {
  assert.deepEqual(legBreaks(geometry, wps), [0, 2, 4]);
});

test("corridor: plekken dicht bij de route met etappe en afstand", () => {
  const items = [
    { slug: "dichtbij", lat: 52.02, lng: 4.6 }, // ±2,2 km, etappe 0
    { slug: "ver", lat: 52.3, lng: 4.6 }, // ±33 km
    { slug: "tweede", lat: 51.99, lng: 5.8 }, // etappe 1
  ];
  const hits = placesAlongRoute(geometry, wps, items, 5);
  assert.deepEqual(
    hits.map((h) => [h.item.slug, h.leg]),
    [
      ["dichtbij", 0],
      ["tweede", 1],
    ],
  );
  assert.ok(hits[0].offKm > 2 && hits[0].offKm < 2.5);
  assert.ok(hits[0].alongKm > 35 && hits[0].alongKm < 45);
});

// ── Export ──────────────────────────────────────────────────────────────────

test("Google Maps: in delen van maximaal 10 punten, zonder stops te verliezen", () => {
  const stops = Array.from({ length: 23 }, (_, i) => ({ lat: 52 + i / 100, lng: 5 }));
  const parts = googleMapsParts(stops, null, null);
  assert.equal(parts.length, 3);
  assert.deepEqual(
    parts.map((p) => [p.from, p.to]),
    [
      [1, 10],
      [11, 20],
      [21, 23],
    ],
  );
  const all = parts.flatMap((p) => {
    const q = new URL(p.url).searchParams;
    return [...(q.get("waypoints")?.split("|") ?? []), q.get("destination")!];
  });
  assert.equal(all.length, 23);
  for (const p of parts) assert.ok((new URL(p.url).searchParams.get("waypoints")?.split("|").length ?? 0) <= GMAPS_MAX_WAYPOINTS);
  // Elk volgend deel begint waar het vorige eindigde
  assert.equal(new URL(parts[1].url).searchParams.get("origin"), new URL(parts[0].url).searchParams.get("destination"));
  assert.equal(new URL(parts[0].url).searchParams.get("origin"), null);
});

test("Google Maps: met begin- en eindpunt", () => {
  const parts = googleMapsParts([{ lat: 52, lng: 5 }], { lat: 51, lng: 4 }, { lat: 51, lng: 4 });
  assert.equal(parts.length, 1);
  const q = new URL(parts[0].url).searchParams;
  assert.equal(q.get("origin"), "51,4");
  assert.equal(q.get("waypoints"), "52,5");
  assert.equal(q.get("destination"), "51,4");
});

test("GPX: waypoints, route en track, tekst veilig", () => {
  const gpx = buildGpx("Reis & co", [{ name: "A <1>", lat: 52, lng: 5, desc: "x" }, { name: "B", lat: 52.5, lng: 5.5 }], [
    [5, 52],
    [5.5, 52.5],
  ]);
  assert.match(gpx, /<gpx version="1.1"/);
  assert.equal((gpx.match(/<wpt /g) ?? []).length, 2);
  assert.equal((gpx.match(/<rtept /g) ?? []).length, 2);
  assert.equal((gpx.match(/<trkpt /g) ?? []).length, 2);
  assert.match(gpx, /A &lt;1&gt;/);
  assert.match(gpx, /Reis &amp; co/);
});

test("agenda: hele dagen voor overnachtingen, tijden voor het rijden", () => {
  const ics = buildIcs(
    [{ uid: "a", name: "Plek, met komma", arrive: new Date(2026, 10, 6, 12), leave: new Date(2026, 10, 8, 12), nights: 2, lat: 52, lng: 5 }],
    [{ uid: "r", title: "Rijden naar Plek", day: new Date(2026, 10, 6, 12), departMin: 600, arriveMin: 23 * 60 + 90 }],
    new Date(Date.UTC(2026, 10, 1, 9, 0)),
  );
  assert.match(ics, /DTSTART;VALUE=DATE:20261106/);
  assert.match(ics, /DTEND;VALUE=DATE:20261108/);
  assert.match(ics, /SUMMARY:Camperplek: Plek\\, met komma/);
  assert.match(ics, /DTSTART:20261106T100000/);
  assert.match(ics, /DTEND:20261107T003000/);
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75));
});
