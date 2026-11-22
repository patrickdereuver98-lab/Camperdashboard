// Google-cijfer (open punt 141): alleen een dichtbijgelegen plek met dezelfde eigennaam telt.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { googleMapsUrl, gridCells, isPlaceLike, isFresh, matchGooglePlace, matchKnown, nameTokens, pickGoogleRating, splitCandidate, type GoogleCandidate } from "../src/lib/google-rating.ts";
import { assessGoogle, reviewStats } from "../src/lib/google-quality.ts";
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

const NOW = Date.parse("2026-11-22T12:00:00Z");
const ago = (months: number) => new Date(NOW - months * 30.44 * 86400_000).toISOString();

test("kwaliteit: camping met veel recente reviews is hoog", () => {
  const a = assessGoogle({ rating: 4.6, count: 120, primaryType: "campground", reviewsSampled: 5, reviewsRecent: 4, newestReviewAt: ago(1) }, NOW);
  assert.equal(a.confidence, "hoog");
  assert.equal(a.show, true);
});

test("kwaliteit: een hotel of manege met kampeerreviews wordt niet getoond", () => {
  const a = assessGoogle({ rating: 4.0, count: 455, primaryType: "equestrian_facility", newestReviewAt: ago(1) }, NOW);
  assert.equal(a.show, false);
  assert.match(a.reasons.join(" "), /equestrian_facility/);
});

test("kwaliteit: weinig of oude reviews geeft een voorbehoud of verbergt het", () => {
  assert.equal(assessGoogle({ rating: 4.8, count: 2, primaryType: "campground", newestReviewAt: ago(1) }, NOW).show, false);
  assert.equal(assessGoogle({ rating: 4.2, count: 16, primaryType: "campground", reviewsSampled: 5, reviewsRecent: 1, newestReviewAt: ago(14) }, NOW).note, "Vooral oudere reviews");
  assert.equal(assessGoogle({ rating: 4.2, count: 16, primaryType: "campground", newestReviewAt: ago(30) }, NOW).show, false);
  assert.equal(assessGoogle({ rating: 4.3, count: 6, primaryType: "campground", newestReviewAt: ago(2) }, NOW).note, "Weinig reviews");
});

test("kwaliteit: reviewstatistiek telt de laatste 12 maanden", () => {
  const s = reviewStats([{ publishTime: ago(2) }, { publishTime: ago(11) }, { publishTime: ago(30) }, {}], NOW);
  assert.deepEqual({ sampled: s.sampled, recent: s.recent }, { sampled: 4, recent: 2 });
  assert.equal(s.newest, ago(2));
});

test("alle velden: reviews apart van de rest", () => {
  const { details, reviews } = splitCandidate({ id: "ChIJ-test_place_id_1", websiteUri: "https://x.nl", reviews: [{ name: "places/a/reviews/b" }] });
  assert.equal(reviews.length, 1);
  assert.equal("reviews" in details, false);
  assert.equal(details.websiteUri, "https://x.nl");
});

test("ontdekken: rooster en vergelijken met onze plekken", () => {
  const cells = gridCells({ south: 51.0, west: 4.0, north: 51.24, east: 4.4 });
  assert.equal(cells.length, 4);
  const ours = [{ id: "a", name: "Camping De Zwaluw", lat: 52.0, lng: 5.0 }, { id: "b", name: "Andere plek", lat: 52.2, lng: 5.2 }];
  assert.equal(matchKnown({ name: "Camping De Zwaluw", lat: 52.0005, lng: 5.0 }, ours)?.id, "a");
  assert.equal(matchKnown({ name: "Iets nieuws", lat: 52.05, lng: 5.0 }, ours), undefined);
  // dichtbij maar een andere naam: tot 250 m dezelfde plek, daarboven niet
  assert.equal(matchKnown({ name: "Heel andere naam", lat: 52.0015, lng: 5.0 }, ours)?.id, "a");
  assert.equal(matchKnown({ name: "Heel andere naam", lat: 52.006, lng: 5.0 }, ours), undefined);
});

test("een straat of gebied bij Google is nooit een plek (route, locality)", () => {
  assert.equal(isPlaceLike(["route"]), false);
  assert.equal(isPlaceLike(["locality", "political"]), false);
  assert.equal(isPlaceLike(["campground", "lodging", "point_of_interest", "establishment"]), true);
  assert.equal(isPlaceLike(undefined), true);
  assert.equal(matchGooglePlace(place, [{ ...cand({}), types: ["route"] }]), undefined);
});

test("kwaliteit: veel reviews met een oude steekproef is een voorbehoud, geen reden om te verbergen", () => {
  const a = assessGoogle({ rating: 4.6, count: 1168, primaryType: "campground", reviewsSampled: 10, reviewsRecent: 4, newestReviewAt: ago(30) }, NOW);
  assert.equal(a.show, true);
  assert.equal(a.note, "Vooral oudere reviews");
});
