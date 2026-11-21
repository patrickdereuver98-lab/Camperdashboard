// Google-cijfer bij een plek (open punt 141, besluit Patrick 21 november 2026).
// Alleen live opgehaald en nooit in onze database bewaard: de voorwaarden van Google Maps Platform laten alleen de
// place_id blijvend bewaren. We tonen alleen cijfer en aantal, met link en vermelding; geen reviewteksten of namen.
// Een twijfelachtige match tonen we niet: liever geen cijfer dan het cijfer van een andere plek.
import { distanceKm } from "./geo";

export interface GoogleRating {
  /** Schaal 1 tot 5, zoals Google het geeft; nooit omrekenen of mengen met ons eigen cijfer (schaal 1 tot 10) */
  rating: number;
  count: number;
  /** Link naar de plek op Google Maps, zoals Google die meegeeft */
  url?: string;
}

export interface GoogleCandidate {
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
}

/** Hoe ver Google en wij mogen verschillen voor dezelfde plek */
export const MAX_MATCH_METERS = 250;

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

/** De beste kandidaat die dichtbij ligt én dezelfde eigennaam heeft; anders niets */
export function pickGoogleRating(place: { name: string; lat: number; lng: number }, candidates: GoogleCandidate[]): GoogleRating | undefined {
  let best: { meters: number; c: GoogleCandidate } | undefined;
  for (const c of candidates) {
    const { latitude, longitude } = c.location ?? {};
    if (typeof latitude !== "number" || typeof longitude !== "number") continue;
    if (typeof c.rating !== "number" || !c.userRatingCount || c.userRatingCount < 1) continue;
    if (c.rating < 1 || c.rating > 5) continue;
    if (!c.displayName?.text || !sameName(place.name, c.displayName.text)) continue;
    const meters = distanceKm({ lat: place.lat, lng: place.lng }, { lat: latitude, lng: longitude }) * 1000;
    if (meters > MAX_MATCH_METERS) continue;
    if (!best || meters < best.meters) best = { meters, c };
  }
  if (!best) return undefined;
  const url = best.c.googleMapsUri;
  return {
    rating: best.c.rating as number,
    count: best.c.userRatingCount as number,
    // Alleen een https-link naar Google zelf
    url: url && /^https:\/\/([a-z0-9-]+\.)*google\.[a-z.]+\//.test(url) ? url : undefined,
  };
}

/** Eén zoekopdracht die cijfer, aantal en link meegeeft (Text Search, Enterprise-laag); geen tweede aanroep nodig */
export async function fetchGoogleCandidates(
  place: { name: string; town: string; lat: number; lng: number },
  apiKey: string,
  doFetch: typeof fetch = fetch,
): Promise<GoogleCandidate[]> {
  const res = await doFetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.userRatingCount,places.googleMapsUri",
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
