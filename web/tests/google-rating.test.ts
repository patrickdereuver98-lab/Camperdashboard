// Google-cijfer (open punt 141): alleen een dichtbijgelegen plek met dezelfde eigennaam telt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { googleMapsUrl, isFresh, matchGooglePlace, nameTokens, pickGoogleRating, type GoogleCandidate } from "../src/lib/google-rating.ts";
import { checkVoorVertrek } from "../src/lib/check-voor-vertrek.ts";

const place = { name: "Camperplaats De Zwaluw", lat: 52.0, lng: 5.0 };
const cand = (over: Partial<GoogleCandidate> & { dLat?: number }): GoogleCandidate => ({
  id: "ChIJ-test_place_id_1",
  displayName: { text: "De Zwaluw" },
  location: { latitude: 52.0 + (over.dLat ?? 0), longitude: 5.0 },
  rating: 4.5,
  userRatingCount: 12,
  ...over,
});

test("eigennaam zonder algemene woorden", () => {
  assert.deepEqual(nameTokens("Camperplaats De Zwaluw"), ["zwaluw"]);
  assert.deepEqual(nameTokens("Camping 't Ross"), ["ross"]);
});

test("goede match geeft cijfer, aantal en link", () => {
  assert.deepEqual(pickGoogleRating(place, [cand({})]), { rating: 4.5, count: 12, placeId: "ChIJ-test_place_id_1" });
});

test("te ver weg, andere naam of geen reviews: geen cijfer", () => {
  assert.equal(pickGoogleRating(place, [cand({ dLat: 0.01 })]), undefined);
  assert.equal(pickGoogleRating(place, [cand({ displayName: { text: "Jachthaven Noord" } })]), undefined);
  assert.equal(pickGoogleRating(place, [cand({ userRatingCount: 0 })]), undefined);
  assert.equal(pickGoogleRating(place, [cand({ rating: undefined })]), undefined);
});

test("alleen algemene naam: nooit een match", () => {
  assert.equal(pickGoogleRating({ ...place, name: "Camperplaats" }, [cand({ displayName: { text: "Camperplaats" } })]), undefined);
});

test("check voor vertrek: onbekend blijft onbekend, hoogstens drie regels", () => {
  assert.equal(checkVoorVertrek({})[0].text, "De vertrektijd kennen we nog niet. Vraag het bij aankomst na.");
  const full = checkVoorVertrek({ departure: "vast", checkoutUntil: "12:00", priceEur: 15, priceExtras: [{ label: "Stroom", amount: 2 }], reservationRule: "verplicht" });
  assert.equal(full.length, 3);
  assert.equal(full[0].text, "Uiterlijk 12:00");
  assert.match(full[1].text, /plus toeslagen/);
  assert.equal(full[2].text, "Reserveren is verplicht");
});

test("zonder cijfer wel een match (place_id bewaren), maar geen cijfer", () => {
  assert.equal(matchGooglePlace(place, [cand({ rating: undefined, userRatingCount: undefined })])?.id, "ChIJ-test_place_id_1");
  assert.equal(pickGoogleRating(place, [cand({ rating: undefined, userRatingCount: undefined })]), undefined);
});

test("ongeldige place_id wordt genegeerd", () => {
  assert.equal(matchGooglePlace(place, [cand({ id: "x'; drop table places;--" })]), undefined);
});

test("cijfers ouder dan 30 dagen tonen we niet", () => {
  const now = Date.parse("2026-12-31T12:00:00Z");
  assert.equal(isFresh("2026-12-10T12:00:00Z", now), true);
  assert.equal(isFresh("2026-11-20T12:00:00Z", now), false);
  assert.equal(isFresh(undefined, now), false);
  assert.equal(isFresh("onzin", now), false);
});

test("Maps-link via place_id", () => {
  assert.equal(googleMapsUrl("ChIJ-abc_123"), "https://www.google.com/maps/place/?q=place_id:ChIJ-abc_123");
});
