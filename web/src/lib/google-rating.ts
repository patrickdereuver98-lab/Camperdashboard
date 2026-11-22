// Google-cijfer bij een plek (open punt 141, besluit Patrick 21 november 2026).
// Alleen live opgehaald en nooit in onze database bewaard: de voorwaarden van Google Maps Platform laten alleen de
// place_id blijvend bewaren. We tonen alleen cijfer en aantal, met link en vermelding; geen reviewteksten of namen.
// Een twijfelachtige match tonen we niet: liever geen cijfer dan het cijfer van een andere plek.
import { distanceKm } from "./geo";

export interface GoogleRating {
  /** Schaal 1 tot 5, zoals Google het geeft; nooit omrekenen of mengen met ons eigen cijfer (schaal 1 tot 10) */
  rating: number;
  count: number;
  /** Google place_id: de enige waarde die Google onbeperkt te bewaren toestaat */
  placeId: string;
}

/** Link naar de plek op Google Maps via de place_id (het gedocumenteerde formaat voor Maps-URL's) */
export function googleMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}

/** Google-cijfers tonen we alleen als de check jonger is dan 30 dagen (bewaartermijn van Google) */
export const MAX_AGE_DAYS = 30;
export function isFresh(checkedAt: string | undefined, now = Date.now()): boolean {
  const t = checkedAt ? Date.parse(checkedAt) : NaN;
  return Number.isFinite(t) && now - t < MAX_AGE_DAYS * 86400_000;
}

export interface GoogleCandidate {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReview[];
}

/** Een review zoals de job hem opvraagt: bewust zonder naam of profiel van de schrijver */
export interface GoogleReview {
  name?: string;
  rating?: number;
  text?: { text?: string; languageCode?: string };
  publishTime?: string;
}

/** Hoe ver Google en wij mogen verschillen voor dezelfde plek */
export const MAX_MATCH_METERS = 250;

export const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;

const GENERIC = new Set(["de", "het", "een", "en", "van", "aan", "bij", "camper", "campers", "camperplaats", "camperplaatsen", "camping", "parking", "parkeerplaats", "stellplatz", "plaats", "plek", "jachthaven", "haven"]);

/** Zonder accenten en leestekens, zonder algemene woorden: wat overblijft is de eigennaam */
export function nameTokens(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !GENERIC.has(t));
}

function sameName(ours: string, theirs: string): boolean {
  const a = nameTokens(ours);
  const b = nameTokens(theirs);
  // Zonder eigennaam (bijvoorbeeld alleen "Camperplaats") is een naamvergelijking zinloos: dan geen match
  if (!a.length || !b.length) return false;
  return a.some((x) => b.some((y) => x === y || (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y))));
}

/** De beste kandidaat die dichtbij ligt én dezelfde eigennaam heeft, ook zonder cijfer; anders niets */
export function matchGooglePlace(place: { name: string; lat: number; lng: number }, candidates: GoogleCandidate[]): (GoogleCandidate & { id: string }) | undefined {
  let best: { meters: number; c: GoogleCandidate & { id: string } } | undefined;
  for (const c of candidates) {
    const { latitude, longitude } = c.location ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (!c.id || !PLACE_ID.test(c.id)) continue;
    if (!c.displayName?.text || !sameName(place.name, c.displayName.text)) continue;
    const meters = distanceKm({ lat: place.lat, lng: place.lng }, { lat: latitude, lng: longitude }) * 1000;
    if (meters > MAX_MATCH_METERS) continue;
    if (!best || meters < best.meters) best = { meters, c: c as GoogleCandidate & { id: string } };
  }
  return best?.c;
}

/** Cijfer en aantal van een kandidaat, alleen als Google ze echt geeft */
export function ratingOf(c: GoogleCandidate & { id: string }): GoogleRating | undefined {
  if (typeof c.rating !== "number" || !c.userRatingCount || c.userRatingCount < 1) return undefined;
  if (c.rating < 1 || c.rating > 5) return undefined;
  return { rating: c.rating, count: c.userRatingCount, placeId: c.id };
}

export function pickGoogleRating(place: { name: string; lat: number; lng: number }, candidates: GoogleCandidate[]): GoogleRating | undefined {
  const c = matchGooglePlace(place, candidates);
  return c ? ratingOf(c) : undefined;
}

/** Eén zoekopdracht die place_id, cijfer en aantal meegeeft (Text Search, Enterprise-laag); geen tweede aanroep nodig */
export async function fetchGoogleCandidates(
  place: { name: string; town: string; lat: number; lng: number },
  apiKey: string,
  doFetch: typeof fetch = fetch,
  withReviews = false,
): Promise<GoogleCandidate[]> {
  const res = await doFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.userRatingCount" +
        (withReviews ? ",places.reviews.name,places.reviews.rating,places.reviews.text,places.reviews.publishTime" : ""),
    },
    body: JSON.stringify({
      textQuery: `${place.name} ${place.town}`,
      languageCode: "nl",
      regionCode: "NL",
      pageSize: 5,
      locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 500 } },
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const json = (await res.json()) as { places?: GoogleCandidate[] };
  return json.places ?? [];
}
