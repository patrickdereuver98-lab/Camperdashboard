import { strict as assert } from "node:assert";
import { test } from "node:test";
import { facilitiesFromSubmission, facilityAnswers, facilityChanges, facilityLabel, pickFacilities } from "../src/lib/facility-update";

test("beginwaarden: ja, nee of leeg (onbekend)", () => {
  const a = facilityAnswers({ power: true, water: false });
  assert.equal(a.power, "ja");
  assert.equal(a.water, "nee");
  assert.equal(a.dumpStation, "");
});

test("alleen wat anders is gaat mee; 'weet ik niet' verandert nooit iets", () => {
  const changes = facilityChanges(
    { power: true, water: false, toilet: undefined },
    { power: "ja", water: "ja", dumpStation: "nee", toilet: "", shower: "" },
  );
  assert.deepEqual(changes, {
    water: { was: false, nieuw: true },
    dump_station: { was: null, nieuw: false },
  });
  assert.deepEqual(facilityChanges({ power: true }, { power: "" }), {});
});

test("overnemen: alleen bekende kolommen met een echte ja of nee", () => {
  assert.deepEqual(
    facilitiesFromSubmission({
      voorzieningen: {
        water: { was: false, nieuw: true },
        dump_station: { was: null, nieuw: false },
        status: { nieuw: "published" }, // geen voorziening: genegeerd
        wifi: { nieuw: "ja" }, // geen boolean: genegeerd
      },
    }),
    { water: true, dump_station: false },
  );
  assert.equal(facilitiesFromSubmission({ onderwerp: "prijs" }), undefined);
  assert.equal(facilitiesFromSubmission({ voorzieningen: { status: { nieuw: true } } }), undefined);
  assert.equal(facilitiesFromSubmission({ voorzieningen: ["water"] }), undefined);
});

test("namen zoals op de site", () => {
  assert.equal(facilityLabel("dump_station"), "Lozen");
  assert.equal(facilityLabel("dogs"), "Honden welkom");
});

test("alleen de voorzieningen gaan naar de client", () => {
  assert.deepEqual(pickFacilities({ power: true, water: false, wifi: undefined, name: "X", description: "lang" } as never), { power: true, water: false });
});
