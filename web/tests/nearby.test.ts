// Dichtbij: lijst, "Binnen 30 min", voorstellen als er niets past en de regel met actieve filters (review R51).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { activeFilterLabels, clearedChoices, closerSuggestions, NEARBY_DEFAULTS, nearbySuggestions, nearestIsFar, nearestPlaces, withinDrive } from "../src/lib/nearby";
import type { PlaceSummary } from "../src/lib/types";

const utrecht = { lat: 52.09, lng: 5.12 };
// 19:30 op een gewone avond
const now = new Date(2026, 6, 15, 19, 30);

const place = (slug: string, dLat: number, extra: Partial<PlaceSummary> = {}) =>
  ({ id: slug, slug, name: slug, lat: utrecht.lat + dLat, lng: utrecht.lng, town: "X", province: "Utrecht", ratingCount: 0, ...extra }) as PlaceSummary;

const vrij = place("vrij-ver", 0.5, { departure: "vrij", departureCheck: "bevestigd" }); // ±55 km
const uitslaper = place("uitslaper", 0.2, { departure: "vast", checkoutUntil: "12:00" }); // ±22 km
const vroeg = place("vroeg", 0.1, { departure: "vast", checkoutUntil: "10:00", checkinUntil: "18:00" }); // aankomst voorbij
const verweg = place("verweg", 2); // ±220 km, buiten 80 km
const places = [vrij, uitslaper, vroeg, verweg];

test("alleen binnen 80 km, dichtstbij eerst; aankomst voorbij valt weg", () => {
  assert.deepEqual(nearestPlaces(places, utrecht, NEARBY_DEFAULTS, {}, now).map((r) => r.place.slug), ["uitslaper", "vrij-ver"]);
  assert.deepEqual(
    nearestPlaces(places, utrecht, { ...NEARBY_DEFAULTS, arriveNow: false }, {}, now).map((r) => r.place.slug),
    ["vroeg", "uitslaper", "vrij-ver"],
  );
});

test("Binnen 30 min: alleen een bekende rijtijd tot 30 minuten; zonder rijtijden blijft alles staan", () => {
  const list = nearestPlaces(places, utrecht, NEARBY_DEFAULTS, {}, now);
  const drives = { uitslaper: { km: 25, seconds: 29 * 60 }, "vrij-ver": { km: 70, seconds: 60 * 60 } };
  assert.deepEqual(withinDrive(list, drives, true).map((r) => r.place.slug), ["uitslaper"]);
  assert.deepEqual(withinDrive(list, { uitslaper: drives.uitslaper }, true).map((r) => r.place.slug), ["uitslaper"]);
  assert.equal(withinDrive(list, null, true).length, 2);
  assert.equal(withinDrive(list, drives, false).length, 2);
});

test("niets binnen 30 min zonder vertrektijd: eerst verder dan 30 minuten, dan uitslapers", () => {
  const c = { ...NEARBY_DEFAULTS, departure: "vrij" as const, within30: true };
  const s = nearbySuggestions(places, utrecht, c, {}, { now, farther: 1 });
  assert.equal(s[0].label, "Ook verder dan 30 minuten");
  assert.equal(s[0].next.within30, false);
  assert.equal(s[0].count, 1);
  const uit = s.find((x) => x.label === "Bekijk uitslapers")!;
  assert.equal(uit.next.departure, "uitslapers");
  assert.equal(uit.next.within30, true);
  // Met "Binnen 30 min" aan zegt een telling over 80 km te weinig
  assert.equal(uit.count, undefined);
});

test("voorstellen hergebruiken relaxations() en tellen over 80 km", () => {
  const c = { ...NEARBY_DEFAULTS, facilities: ["power" as const] };
  const s = nearbySuggestions(places, utrecht, c, {}, { now });
  assert.deepEqual(s.map((x) => [x.label, x.count]), [["Zonder \"Stroom\"", 2]]);
  assert.deepEqual(s[0].next.facilities, []);
  // Alleen de aankomst houdt de vroege plek tegen
  const late = nearbySuggestions([vroeg], utrecht, NEARBY_DEFAULTS, {}, { now });
  assert.deepEqual(late.map((x) => x.label), ["Ook waar je nu niet meer binnenkomt"]);
  assert.equal(late[0].next.arriveNow, false);
  // Niets binnen 80 km: geen voorstellen
  assert.deepEqual(nearbySuggestions([verweg], utrecht, NEARBY_DEFAULTS, {}, { now }), []);
});

test("lengte uit Mijn camper: voorstel zet het lengtefilter uit", () => {
  const kort = place("kort", 0.1, { maxLengthM: 6 });
  const s = nearbySuggestions([kort], utrecht, NEARBY_DEFAULTS, { lengthM: 7.5 }, { now });
  assert.equal(s[0].label, "Zonder lengtefilter");
  assert.equal(s[0].next.lengthOff, true);
});

test("regel met actieve filters en Wis filters", () => {
  const c = { ...NEARBY_DEFAULTS, within30: true, departure: "vrij" as const, facilities: ["dogs" as const, "power" as const] };
  assert.deepEqual(activeFilterLabels(c, { lengthM: 7 }), ["Nu open", "Nu nog aankomen", "Binnen 30 min", "Mijn camper", "Zonder vertrektijd", "Stroom", "Honden welkom"]);
  const cleared = clearedChoices({ lengthM: 7 });
  assert.deepEqual(activeFilterLabels(cleared, { lengthM: 7 }), []);
  assert.equal(clearedChoices({}).lengthOff, false);
});

test("dichtste plek ver weg: met rijtijd verder dan 30 min, zonder rijtijd verder dan 25 km hemelsbreed", () => {
  const c = { ...NEARBY_DEFAULTS, departure: "vrij" as const };
  const list = nearestPlaces(places, utrecht, c, {}, now);
  assert.deepEqual(list.map((r) => r.place.slug), ["vrij-ver"]);
  assert.equal(nearestIsFar(list, { "vrij-ver": { km: 70, seconds: 60 * 60 } }), "rijtijd");
  assert.equal(nearestIsFar(list, { "vrij-ver": { km: 20, seconds: 25 * 60 } }), false);
  // Geen rijtijd voor deze plek: hemelsbreed (±55 km)
  assert.equal(nearestIsFar(list, {}), "hemelsbreed");
  assert.equal(nearestIsFar(list, null), "hemelsbreed");
  assert.equal(nearestIsFar([], null), false);
  const dichtbij = nearestPlaces(places, utrecht, NEARBY_DEFAULTS, {}, now);
  assert.equal(nearestIsFar(dichtbij, null), false); // uitslaper op ±22 km
});

test("voorstel dichterbij: alleen plekken die hemelsbreed dichterbij liggen, zonder minuten te schatten", () => {
  const c = { ...NEARBY_DEFAULTS, departure: "vrij" as const };
  const s = closerSuggestions(places, utrecht, c, {}, 55, { now });
  // De uitslaper op ±22 km komt binnen met "Bekijk uitslapers" en met "Alle vertrektijden"
  assert.deepEqual(
    s.map((x) => x.label),
    ["Bekijk uitslapers: 1 plek dichterbij", "Alle vertrektijden: 1 plek dichterbij"],
  );
  assert.equal(s[0].next.departure, "uitslapers");
  assert.ok(s.every((x) => !/min/.test(x.label)));
  // Alleen wat dichter ligt dan de dichtste plek nu telt mee: die ligt al op 20 km, dus de uitslaper (22 km) niet
  assert.deepEqual(closerSuggestions(places, utrecht, c, {}, 20, { now }), []);
  // De vroege plek (±11 km) komt pas binnen als ook "Nu nog aankomen" uit mag
  const late = closerSuggestions([vrij, vroeg], utrecht, c, {}, 55, { now });
  assert.deepEqual(late, []);
  const onlyArrive = closerSuggestions([vrij, place("laat", 0.1, { departure: "vrij", checkinUntil: "18:00" })], utrecht, c, {}, 55, { now });
  assert.deepEqual(onlyArrive.map((x) => x.label), ["Ook waar je nu niet meer binnenkomt: 1 plek dichterbij"]);
});
