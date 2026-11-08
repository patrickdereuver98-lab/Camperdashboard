import { getSummaries } from "@/lib/places";
import { encodePlaceIndex } from "@/lib/place-index";

/**
 * Suggestie-index voor het zoekvak: naam, plaats, provincie en ligging per plek (lib/place-index.ts). Zelfde cache
 * als /api/places; de service worker bewaart hem ook, zodat het zoekvak zonder bereik blijft werken.
 */
export async function GET() {
  return Response.json(encodePlaceIndex(await getSummaries()), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
  });
}
