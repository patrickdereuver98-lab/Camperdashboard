import { cacheLife } from "next/cache";
import { OFFLINE_BUILD } from "./env";
import { fetchGoogleCandidates, pickGoogleRating, type GoogleRating } from "./google-rating";

/**
 * Google-cijfer van een plek, live en een dag in de servercache (niet in de database). Zonder sleutel
 * (`GOOGLE_PLACES_API_KEY` in Vercel), in de offline build of bij een storing: geen cijfer en geen foutmelding op de pagina.
 * De aanroep gaat van onze server naar Google; de bezoeker praat nooit met Google (geen tracking van derden).
 */
export async function getGoogleRating(place: { name: string; town: string; lat: number; lng: number }): Promise<GoogleRating | undefined> {
  "use cache";
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || OFFLINE_BUILD) {
    cacheLife("minutes");
    return undefined;
  }
  try {
    const found = pickGoogleRating(place, await fetchGoogleCandidates(place, key));
    if (found) cacheLife("days");
    else cacheLife("hours");
    return found;
  } catch (err) {
    console.error("[vrijstaan] Google-cijfer niet opgehaald:", (err as Error).message);
    cacheLife("minutes");
    return undefined;
  }
}
