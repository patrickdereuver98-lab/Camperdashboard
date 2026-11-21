// Google-cijfer (open punt 141): alleen een dichtbijgelegen plek met dezelfde eigennaam telt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nameTokens, pickGoogleRating, type GoogleCandidate } from "../src/lib/google-rating.ts";
import { checkVoorVertrek } from "../src/lib/check-voor-vertrek.ts";

const place = { name: "Camperplaats De Zwaluw", lat: 52.0, lng: 5.0 };
const cand = (over: Partial<GoogleCandidate> & { dLat?: number }): GoogleCandidate => ({
  displayName: { text: "De Zwaluw" },
  location: { latitude: 52.0 + (over.dLat ?? 0), longitude: 5.0 },
  rating: 4.5,
  userRatingCount: 12,
  googleMapsUri: "https://maps.google.com/?cid=1",
  ...over,
});

test("eigennaam zonder algemene woorden", () => {
  assert.deepEqual(nameTokens("Camperplaats De Zwaluw"), ["zwaluw"]);
  assert.deepEqual(nameTokens("Camping 't Ross"), ["ross"]);
});

test("goede match geeft cijfer, aantal en link", () => {
  assert.deepEqual(pickGoogleRating(place, [cand({})]), { rating: 4.5, count: 12, url: "https://maps.google.com/?cid=1" });
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

test("een link buiten Google nemen we niet over", () => {
  assert.equal(pickGoogleRating(place, [cand({ googleMapsUri: "https://evil.example/x" })])?.url, undefined);
});

test("check voor vertrek: onbekend blijft onbekend, hoogstens drie regels", () => {
  assert.equal(checkVoorVertrek({})[0].text, "De vertrektijd kennen we nog niet. Vraag het bij aankomst na.");
  const full = checkVoorVertrek({ departure: "vast", checkoutUntil: "12:00", priceEur: 15, priceExtras: [{ label: "Stroom", amount: 2 }], reservationRule: "verplicht" });
  assert.equal(full.length, 3);
  assert.equal(full[0].text, "Uiterlijk 12:00");
  assert.match(full[1].text, /plus toeslagen/);
  assert.equal(full[2].text, "Reserveren is verplicht");
});

test("een domein dat alleen op Google lijkt, is geen Google", () => {
  assert.equal(pickGoogleRating(place, [cand({ googleMapsUri: "https://evilgoogle.com/x" })])?.url, undefined);
});
