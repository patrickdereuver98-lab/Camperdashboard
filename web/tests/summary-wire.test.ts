import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brotliCompressSync } from "node:zlib";
import { decodeSummaries, encodeSummaries } from "../src/lib/summary-wire";
import type { PlaceSummary } from "../src/lib/types";

test("compact formaat geeft dezelfde plekken terug (zonder id), zonder iets bij te vullen", () => {
  const places: PlaceSummary[] = [
    {
      id: "c6060e6e-1ad0-491d-a5f8-62c731eb0d37",
      slug: "a",
      name: "A",
      kind: "camperplaats",
      lat: 52.0017918,
      lng: 4.789055,
      town: "Haastrecht",
      province: "Zuid-Holland",
      priceEur: 27,
      power: true,
      water: false,
      imageUrl: "https://www.a.nl/foto.jpg",
      imageCredit: "a.nl",
      ratingCount: 0,
      completeness: 0.933,
      departure: "vast",
      checkoutUntil: "11:00",
      priceExtras: [{ label: "Per persoon", amount: 5, unit: "per nacht" }],
    },
    // Fotobron die niet de domeinnaam is, en een plek zonder foto en zonder bron
    { id: "3a18c8f0-f180-4e56-bf6c-8a08eca84054", slug: "b", name: "B", lat: 52.1, lng: 5.2, town: "Haastrecht", province: "Zuid-Holland", imageUrl: "https://cdn.x.com/b.jpg", imageCredit: "b.nl", ratingCount: 2, completeness: 0.5 },
    { id: "3a18c8f0-f180-4e56-bf6c-8a08eca84055", slug: "c", name: "C", lat: 53, lng: 6, town: "Leek", province: "Groningen", ratingCount: 0, completeness: 0.4, dogs: false },
  ] as PlaceSummary[];
  const back = decodeSummaries(JSON.parse(JSON.stringify(encodeSummaries(places))));
  const noId = places.map((p) => {
    const rest = { ...p };
    delete rest.id;
    return rest;
  });
  assert.deepEqual(back, [{ ...noId[0], lat: 52.00179, lng: 4.78906 }, noId[1], noId[2]]);
  // Geen bron bij een plek zonder foto: niets verzonnen
  assert.equal("imageCredit" in back[2], false);
});

test("compact formaat is kleiner dan gewone JSON, ook verpakt (snapshot)", () => {
  const snap = JSON.parse(readFileSync(new URL("../src/data/snapshot.json", import.meta.url), "utf8")) as { places: PlaceSummary[] };
  // Alleen de velden van een samenvatting, zoals /api/places ze stuurt
  const keys = "id slug name kind lat lng town province priceEur priceFrom touristTaxIncluded power water dumpStation toilet shower wifi dogs capacity maxLengthM openAllYear season departure checkoutUntil departureCheck priceExtras imageUrl ratingAvg ratingCount completeness imageCredit checkinFrom checkinUntil access24h accessHours".split(" ");
  const places = snap.places.slice(0, 500).map((p) => Object.fromEntries(keys.filter((k) => k in p).map((k) => [k, p[k as keyof PlaceSummary]]))) as PlaceSummary[];
  const plain = brotliCompressSync(JSON.stringify(places)).length;
  const compact = brotliCompressSync(JSON.stringify(encodeSummaries(places))).length;
  assert.ok(compact < plain * 0.8, `compact ${compact} tegen ${plain}`);
});
