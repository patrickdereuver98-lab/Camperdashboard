import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanPoint, forShared, isPoint, MAX_NOTES, mergeTrips, newPointSlug, sameTrip, sharedNotes, withShared } from "../src/lib/trip-merge.ts";

test("mergeTrips: toestel eerst, daarna alleen-in-account", () => {
  const merged = mergeTrips(
    [{ slug: "b", nights: 2 }, { slug: "a", nights: 1 }],
    [{ slug: "a", nights: 5 }, { slug: "c", nights: 3 }],
  );
  assert.deepEqual(merged, [{ slug: "b", nights: 2 }, { slug: "a", nights: 1 }, { slug: "c", nights: 3 }]);
});

test("mergeTrips: rommel uit het account wordt genegeerd en nachten begrensd", () => {
  const merged = mergeTrips([], [null, 3, { slug: "../x" }, { slug: "ok", nights: 99 }, { slug: "nul", nights: 0 }, "x"]);
  // 0 nachten is een tussenstop (sinds november 2026)
  assert.deepEqual(merged, [{ slug: "ok", nights: 21 }, { slug: "nul", nights: 0 }]);
  assert.deepEqual(mergeTrips([{ slug: "a", nights: 1 }], { not: "an array" }), [{ slug: "a", nights: 1 }]);
});

test("mergeTrips: oude notitie (versie 3) wordt een privénotitie, ingekort tot 500 tekens; lege valt weg", () => {
  const merged = mergeTrips([], [{ slug: "a", nights: 1, note: "x".repeat(600) }, { slug: "b", nights: 2, note: "  " }, { slug: "c", note: 5 }]);
  assert.equal(merged[0].notes?.[0].text.length, 500);
  assert.equal(merged[0].notes?.[0].shared, undefined);
  assert.deepEqual(merged.slice(1), [{ slug: "b", nights: 2 }, { slug: "c", nights: 1 }]);
});

test("mergeTrips: oude notitie uit een gedeelde reis was al gedeeld", () => {
  assert.deepEqual(mergeTrips([], [{ slug: "a", nights: 1, note: "Sleutel bij de buren" }], { legacyShared: true }), [
    { slug: "a", nights: 1, notes: [{ id: "g0", text: "Sleutel bij de buren", shared: true }] },
  ]);
});

test("notities: hoogstens 10 privé en 10 gedeelde, geldige sleutel, geen dubbele, shared alleen als true", () => {
  const notes = Array.from({ length: 24 }, (_, i) => ({ id: `n${i + 1}`, text: `t${i}`, shared: i % 2 === 0 ? true : "ja" }));
  const [s] = mergeTrips([{ slug: "a", nights: 1, notes: [...notes, { id: "n1", text: "dubbel" }, { id: "../x", text: "fout" }] }], []);
  assert.equal(s.notes?.filter((n) => n.shared).length, MAX_NOTES);
  assert.equal(s.notes?.filter((n) => !n.shared).length, MAX_NOTES);
  assert.deepEqual(s.notes?.[0], { id: "n1", text: "t0", shared: true });
  assert.deepEqual(s.notes?.[1], { id: "n2", text: "t1" });
});

test("eigen punt: naam en ligging, anders valt de stop weg", () => {
  assert.deepEqual(cleanPoint({ name: "  Oma  ", lat: "52.1", lng: 5, kind: "kaart" }), { name: "Oma", lat: 52.1, lng: 5, kind: "kaart" });
  assert.deepEqual(cleanPoint({ name: "Winkel", lat: 52, lng: 5, kind: "iets" }), { name: "Winkel", lat: 52, lng: 5, kind: "adres" });
  assert.equal(cleanPoint({ name: "", lat: 52, lng: 5 }), undefined);
  assert.equal(cleanPoint({ name: "X", lat: null, lng: 5 }), undefined);
  assert.equal(cleanPoint({ name: "X", lat: 52, lng: 999 }), undefined);
  assert.equal(cleanPoint({ name: "x".repeat(80), lat: 1, lng: 1 })?.name.length, 60);
  const merged = mergeTrips([{ slug: "eigen-a", nights: 0, point: { name: "A", lat: 52, lng: 5 } }, { slug: "eigen-b", nights: 0, point: "x" }], []);
  assert.equal(merged.length, 1);
  assert.equal(isPoint(merged[0]), true);
  assert.match(newPointSlug(), /^eigen-[a-z0-9]{10}$/);
});

test("delen met reisgenoten: alleen gedeelde notities gaan mee", () => {
  const stops = [
    { slug: "a", nights: 1, notes: [{ id: "p1", text: "Pincode 1234" }, { id: "s1", text: "Bakker om de hoek", shared: true as const }] },
    { slug: "b", nights: 0, notes: [{ id: "p2", text: "privé" }] },
    { slug: "eigen-x", nights: 1, point: { name: "Oma", lat: 52, lng: 5, kind: "adres" as const } },
  ];
  assert.deepEqual(forShared(stops), [
    { slug: "a", nights: 1, notes: [{ id: "s1", text: "Bakker om de hoek", shared: true }] },
    { slug: "b", nights: 0 },
    { slug: "eigen-x", nights: 1, point: { name: "Oma", lat: 52, lng: 5, kind: "adres" } },
  ]);
  assert.deepEqual(sharedNotes(stops[0]).map((n) => n.id), ["s1"]);
  // Niets privé in wat er naar de gedeelde reis gaat
  assert.equal(JSON.stringify(forShared(stops)).includes("Pincode"), false);
});

test("gedeelde reis binnen: volgorde en gedeelde notities van daar, privénotities blijven staan", () => {
  const local = [
    { slug: "a", nights: 1, notes: [{ id: "p1", text: "Pincode 1234" }, { id: "s1", text: "oud", shared: true as const }] },
    { slug: "weg", nights: 1, notes: [{ id: "p3", text: "valt weg" }] },
  ];
  const remote = [
    { slug: "c", nights: 2 },
    { slug: "a", nights: 3, notes: [{ id: "s1", text: "nieuw", shared: true as const }] },
  ];
  assert.deepEqual(withShared(local, remote), [
    { slug: "c", nights: 2 },
    { slug: "a", nights: 3, notes: [{ id: "s1", text: "nieuw", shared: true }, { id: "p1", text: "Pincode 1234" }] },
  ]);
  // Omzetting van versie 3: dezelfde tekst privé en gedeeld wordt één gedeelde notitie
  const v3 = mergeTrips([{ slug: "a", nights: 1, note: "Sleutel" }], []);
  const shared = mergeTrips([], [{ slug: "a", nights: 1, note: "Sleutel" }], { legacyShared: true });
  assert.deepEqual(withShared(v3, shared), [{ slug: "a", nights: 1, notes: [{ id: "g0", text: "Sleutel", shared: true }] }]);
  // Wat we terugsturen is gelijk aan wat binnenkwam: geen eindeloze heen-en-weer
  assert.equal(sameTrip(forShared(withShared(local, remote)), remote), true);
});

test("sameTrip", () => {
  assert.equal(sameTrip([{ slug: "a", nights: 1, notes: [{ id: "n1", text: "x" }] }], [{ slug: "a", nights: 1 }]), false);
  assert.equal(sameTrip([{ slug: "a", nights: 1, notes: [{ id: "n1", text: "x" }] }], [{ slug: "a", nights: 1, notes: [{ id: "n1", text: "x", shared: true }] }]), false);
  assert.equal(sameTrip([{ slug: "a", nights: 1 }], [{ slug: "a", nights: 1 }]), true);
  assert.equal(sameTrip([{ slug: "a", nights: 1 }], [{ slug: "a", nights: 2 }]), false);
});

test("notitie bewaren: nieuw achteraan, aanpassen op zijn plaats, leeg haalt weg", async () => {
  const { removeNote, saveNote } = await import("../src/lib/trip-merge.ts");
  let stops: import("../src/lib/trip-merge.ts").Stop[] = [{ slug: "a", nights: 1 }, { slug: "b", nights: 1 }];
  stops = saveNote(stops, "a", { id: "n1", text: "Eerste" });
  stops = saveNote(stops, "a", { id: "n2", text: "Tweede", shared: true });
  stops = saveNote(stops, "a", { id: "n1", text: "Eerste, aangepast", shared: true });
  assert.deepEqual(stops[0].notes, [
    { id: "n1", text: "Eerste, aangepast", shared: true },
    { id: "n2", text: "Tweede", shared: true },
  ]);
  assert.deepEqual(stops[1], { slug: "b", nights: 1 });
  assert.deepEqual(saveNote(stops, "a", { id: "n2", text: "  " })[0].notes, [{ id: "n1", text: "Eerste, aangepast", shared: true }]);
  assert.deepEqual(removeNote(stops, "a", "n1")[0].notes, [{ id: "n2", text: "Tweede", shared: true }]);
});

test("eigen punt toevoegen: achteraan als tussenstop, of op een plaats", async () => {
  const { addPoint } = await import("../src/lib/trip-merge.ts");
  const p = { name: "Oma", lat: 52, lng: 5, kind: "adres" as const };
  const stops = [{ slug: "a", nights: 1 }, { slug: "b", nights: 1 }];
  assert.deepEqual(addPoint(stops, p, "eigen-x").at(-1), { slug: "eigen-x", nights: 0, point: p });
  assert.equal(addPoint(stops, p, "eigen-x", 1, 2)[1].nights, 2);
  assert.equal(addPoint(stops, p, "eigen-x", 1)[1].slug, "eigen-x");
  assert.equal(addPoint(stops, p, "eigen-x", 99).length, 3);
});

test("notities: privé en gedeeld tellen apart, en de hele reis blijft onder de grens", async () => {
  const { withShared, MAX_NOTE_CHARS } = await import("../src/lib/trip-merge.ts");
  const mine = Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, text: `privé ${i}` }));
  const theirs = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, text: `gedeeld ${i}`, shared: true as const }));
  const [s] = mergeTrips(withShared([{ slug: "a", nights: 1, notes: mine }], [{ slug: "a", nights: 1, notes: theirs }]), []);
  assert.equal(s.notes?.filter((n) => !n.shared).length, 3);
  assert.equal(s.notes?.filter((n) => n.shared).length, 10);
  const big = Array.from({ length: 200 }, (_, i) => ({ slug: `p${i}`, nights: 1, notes: [{ id: "n1", text: "x".repeat(500) }] }));
  const total = mergeTrips(big, []).reduce((t, x) => t + (x.notes?.[0]?.text.length ?? 0), 0);
  assert.ok(total <= MAX_NOTE_CHARS);
});
