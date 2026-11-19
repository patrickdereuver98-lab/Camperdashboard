import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  activeTrip,
  clampNights,
  cleanTripName,
  decodeTrip,
  decodeTripPlaces,
  decodeTrips,
  encodeTrips,
  encodeTripPlaces,
  FIRST_TRIP_ID,
  MAX_TRIPS,
  TRIP_PLACES_VERSION,
  TRIP_VERSION,
} from "../src/lib/trip-storage.ts";
import type { PlaceSummary } from "../src/lib/types.ts";

test("clampNights: heel getal van 0 (tussenstop) t/m 21, anders 1", () => {
  assert.equal(clampNights(3), 3);
  assert.equal(clampNights(2.6), 3);
  assert.equal(clampNights(0), 0);
  assert.equal(clampNights(-4), 0);
  assert.equal(clampNights(""), 1);
  assert.equal(clampNights(null), 1);
  assert.equal(clampNights(99), 21);
  assert.equal(clampNights("5"), 5);
  assert.equal(clampNights("abc"), 1);
  assert.equal(clampNights(undefined), 1);
  assert.equal(clampNights(Infinity), 1);
});

test("decodeTrip: versie 1 (losse lijst) wordt omgezet", () => {
  assert.deepEqual(decodeTrip([{ slug: "a", nights: 2 }, { slug: "b" }, { slug: "c", nights: "x" }]), [
    { slug: "a", nights: 2 },
    { slug: "b", nights: 1 },
    { slug: "c", nights: 1 },
  ]);
});

test("decodeTrip: versie 2 met begrensde nachten, rommel valt weg", () => {
  assert.deepEqual(decodeTrip({ v: 2, stops: [{ slug: "a", nights: 50 }, null, { slug: "../x" }, { slug: "a", nights: 1 }] }), [{ slug: "a", nights: 21 }]);
  assert.equal(decodeTrip({ v: 2 }), undefined);
  assert.equal(decodeTrip("reis"), undefined);
  assert.equal(decodeTrip(null), undefined);
});

test("decodeTrip: 0 nachten uit versie 1 of 2 wordt 1, in versie 3 een tussenstop", () => {
  assert.deepEqual(decodeTrip([{ slug: "a", nights: 0 }]), [{ slug: "a", nights: 1 }]);
  assert.deepEqual(decodeTrip({ v: 2, stops: [{ slug: "a", nights: 0 }] }), [{ slug: "a", nights: 1 }]);
  // De losse notitie van versie 3 wordt een privénotitie
  assert.deepEqual(decodeTrip({ v: 3, stops: [{ slug: "a", nights: 0, note: "lozen" }] }), [{ slug: "a", nights: 0, notes: [{ id: "n0", text: "lozen" }] }]);
});

test("versie 4: oude opslag (1, 2 en 3) wordt de eerste reis, notitie privé", () => {
  assert.equal(TRIP_VERSION, 4);
  const v3 = { v: 3, stops: [{ slug: "a", nights: 0, note: "lozen" }, { slug: "b", nights: 2 }] };
  assert.deepEqual(decodeTrips(v3), {
    active: FIRST_TRIP_ID,
    trips: [{ id: FIRST_TRIP_ID, name: "Mijn reis", stops: [{ slug: "a", nights: 0, notes: [{ id: "n0", text: "lozen" }] }, { slug: "b", nights: 2 }] }],
  });
  assert.deepEqual(decodeTrips([{ slug: "a", nights: 0 }])?.trips[0].stops, [{ slug: "a", nights: 1 }]);
  assert.deepEqual(decodeTrips({ v: 2, stops: [{ slug: "a", nights: 3 }] })?.trips[0].stops, [{ slug: "a", nights: 3 }]);
  assert.equal(decodeTrips("reis"), undefined);
  assert.equal(decodeTrips(null), undefined);
  // Heen en terug: omzetten en opnieuw lezen geeft hetzelfde
  const once = decodeTrips(v3)!;
  assert.deepEqual(decodeTrips(JSON.parse(JSON.stringify(encodeTrips(once)))), once);
  assert.equal(encodeTrips(once).v, 4);
});

test("versie 4: meerdere reizen, eigen punten en gedeelde notities blijven staan", () => {
  const stored = {
    v: 4,
    active: "reis-b",
    trips: [
      { id: "reis-1", name: "Zomer", stops: [{ slug: "a", nights: 1 }] },
      {
        id: "reis-b",
        name: "  Herfst   in de Ardennen ",
        stops: [
          { slug: "eigen-oma", nights: 1, point: { name: "Oma", lat: 52.1, lng: 5.1, kind: "adres" } },
          { slug: "c", nights: 2, notes: [{ id: "x1", text: "Bellen", shared: true }, { id: "x2", text: "Pin" }] },
        ],
      },
    ],
  };
  const list = decodeTrips(stored)!;
  assert.equal(list.trips.length, 2);
  assert.equal(activeTrip(list).name, "Herfst in de Ardennen");
  assert.deepEqual(activeTrip(list).stops[0].point, { name: "Oma", lat: 52.1, lng: 5.1, kind: "adres" });
  assert.deepEqual(activeTrip(list).stops[1].notes, [{ id: "x1", text: "Bellen", shared: true }, { id: "x2", text: "Pin" }]);
});

test("versie 4: rommel wordt opgeschoond, er is altijd een reis", () => {
  // Geen reizen: één lege reis
  assert.deepEqual(decodeTrips({ v: 4, trips: [] }), { active: FIRST_TRIP_ID, trips: [{ id: FIRST_TRIP_ID, name: "Mijn reis", stops: [] }] });
  // Onbekende actieve reis: de eerste; dubbele of ongeldige sleutels krijgen een nieuwe; lege naam wordt "Mijn reis"
  const list = decodeTrips({ v: 4, active: "weg", trips: [{ id: "reis-1", name: "", stops: [] }, { id: "reis-1", name: "B", stops: "x" }, null, { id: "../x", stops: [] }] })!;
  assert.equal(list.active, "reis-1");
  assert.equal(list.trips.length, 3);
  assert.equal(list.trips[0].name, "Mijn reis");
  assert.equal(new Set(list.trips.map((t) => t.id)).size, 3);
  assert.deepEqual(list.trips[1].stops, []);
  // Hoogstens MAX_TRIPS
  const many = decodeTrips({ v: 4, trips: Array.from({ length: 30 }, (_, i) => ({ id: `reis-${i}`, name: `R${i}`, stops: [] })) })!;
  assert.equal(many.trips.length, MAX_TRIPS);
  // Eigen punt zonder geldige ligging valt weg
  const bad = decodeTrips({ v: 4, trips: [{ id: "reis-1", name: "A", stops: [{ slug: "eigen-x", nights: 0, point: { name: "X", lat: 200, lng: 5 } }] }] })!;
  assert.deepEqual(bad.trips[0].stops, []);
});

test("naam van een reis: ingekort, spaties netjes, leeg wordt Mijn reis", () => {
  assert.equal(cleanTripName("  Noord  Frankrijk "), "Noord Frankrijk");
  assert.equal(cleanTripName(""), "Mijn reis");
  assert.equal(cleanTripName(5), "Mijn reis");
  assert.equal(cleanTripName("x".repeat(80)).length, 60);
});

test("reisplekken: met savedAt, oude kopie zonder datum blijft bruikbaar", () => {
  const places = [{ slug: "a" }, { slug: "b" }] as PlaceSummary[];
  const copy = encodeTripPlaces(places, ["b"], "2026-11-01T10:00:00.000Z");
  assert.deepEqual(copy, { v: TRIP_PLACES_VERSION, savedAt: "2026-11-01T10:00:00.000Z", places: [{ slug: "b" }] });
  assert.deepEqual(decodeTripPlaces(JSON.parse(JSON.stringify(copy))), { places: [{ slug: "b" }], savedAt: "2026-11-01T10:00:00.000Z" });
  assert.deepEqual(decodeTripPlaces([{ slug: "a" }]), { places: [{ slug: "a" }], savedAt: null });
  assert.deepEqual(decodeTripPlaces({ places: [], savedAt: "gisteren" }), { places: [], savedAt: null });
  assert.deepEqual(decodeTripPlaces("x"), { places: [], savedAt: null });
});

test("reizen: aanmaken opent de nieuwe, hoogstens 20", async () => {
  const { addTrip, emptyTripList } = await import("../src/lib/trip-storage.ts");
  const list = addTrip(emptyTripList(), "  Ardennen ", [{ slug: "a", nights: 2 }], "reis-b")!;
  assert.deepEqual(list, {
    active: "reis-b",
    trips: [
      { id: FIRST_TRIP_ID, name: "Mijn reis", stops: [] },
      { id: "reis-b", name: "Ardennen", stops: [{ slug: "a", nights: 2 }] },
    ],
  });
  let full = emptyTripList();
  for (let i = 1; i < MAX_TRIPS; i++) full = addTrip(full, `R${i}`)!;
  assert.equal(full.trips.length, MAX_TRIPS);
  assert.equal(addTrip(full, "te veel"), undefined);
});

test("reizen: hernoemen, wisselen, en een onbekende reis verandert niets", async () => {
  const { addTrip, emptyTripList, renameTrip, selectTrip } = await import("../src/lib/trip-storage.ts");
  const list = addTrip(emptyTripList(), "B", [], "reis-b")!;
  assert.equal(renameTrip(list, "reis-b", "Bretagne").trips[1].name, "Bretagne");
  assert.equal(renameTrip(list, "reis-b", "   ").trips[1].name, "Mijn reis");
  assert.equal(selectTrip(list, FIRST_TRIP_ID).active, FIRST_TRIP_ID);
  assert.equal(selectTrip(list, "weg"), list);
});

test("reizen: verwijderen en ongedaan maken zet hem terug op dezelfde plaats", async () => {
  const { addTrip, deleteTrip, emptyTripList, restoreTrip } = await import("../src/lib/trip-storage.ts");
  let list = addTrip(emptyTripList(), "B", [{ slug: "b", nights: 1 }], "reis-b")!;
  list = addTrip(list, "C", [], "reis-c")!;
  // Open reis C verwijderen: B gaat open
  const r = deleteTrip(list, "reis-c")!;
  assert.equal(r.list.active, "reis-b");
  assert.deepEqual(r.list.trips.map((t) => t.id), [FIRST_TRIP_ID, "reis-b"]);
  assert.deepEqual(restoreTrip(r.list, r.removed), list);
  // Eerste reis verwijderen terwijl hij open is: de nieuwe eerste gaat open
  const first = deleteTrip({ ...list, active: FIRST_TRIP_ID }, FIRST_TRIP_ID)!;
  assert.equal(first.list.active, "reis-b");
  assert.deepEqual(restoreTrip(first.list, first.removed).trips.map((t) => t.id), [FIRST_TRIP_ID, "reis-b", "reis-c"]);
  assert.equal(restoreTrip(first.list, first.removed).active, FIRST_TRIP_ID);
  // Een reis die niet open is: de open reis blijft open
  assert.equal(deleteTrip(list, "reis-b")!.list.active, "reis-c");
  // De laatste reis blijft bestaan, leeg
  const only = deleteTrip({ active: FIRST_TRIP_ID, trips: [{ id: FIRST_TRIP_ID, name: "Mijn reis", stops: [{ slug: "a", nights: 1 }] }] }, FIRST_TRIP_ID)!;
  assert.deepEqual(only.list.trips, [{ id: FIRST_TRIP_ID, name: "Mijn reis", stops: [] }]);
  assert.deepEqual(restoreTrip(only.list, only.removed).trips[0].stops, [{ slug: "a", nights: 1 }]);
  assert.equal(deleteTrip(list, "weg"), undefined);
});

test("reizen: stops van één reis vervangen raakt de andere niet", async () => {
  const { addTrip, emptyTripList, setTripStops } = await import("../src/lib/trip-storage.ts");
  const list = addTrip(emptyTripList(), "B", [{ slug: "b", nights: 1 }], "reis-b")!;
  const next = setTripStops(list, FIRST_TRIP_ID, [{ slug: "a", nights: 50 }]);
  assert.deepEqual(next.trips[0].stops, [{ slug: "a", nights: 21 }]);
  assert.deepEqual(next.trips[1].stops, [{ slug: "b", nights: 1 }]);
  assert.deepEqual(setTripStops(list, "weg", []), list);
});
