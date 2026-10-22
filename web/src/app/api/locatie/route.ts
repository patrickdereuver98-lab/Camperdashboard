import { getTowns } from "@/lib/places";
import { answerSuggest, cleanQuery, isLocationId } from "@/lib/pdok";
import { lookupLocation, suggestLocations } from "@/lib/locatie";
import { rateLimited } from "@/lib/rate-limit";

/**
 * GET /api/locatie?q=<zoekterm>  suggesties (adres, postcode, woonplaats, gemeente) van de PDOK Locatieserver
 * GET /api/locatie?id=<pdok-id>  coördinaat van één suggestie
 * Alleen onze server praat met PDOK; de browser niet. Bij een storing: de eigen lijst woonplaatsen.
 */
export async function GET(request: Request) {
  const limited = rateLimited(request, 120);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;

  const id = params.get("id");
  if (id !== null) {
    if (!isLocationId(id)) return Response.json({ error: "Onbekende locatie" }, { status: 400 });
    try {
      const loc = await lookupLocation(id);
      if (!loc) return Response.json({ error: "Locatie niet gevonden" }, { status: 404 });
      return Response.json(loc, { headers: { "Cache-Control": "public, max-age=86400" } });
    } catch {
      return Response.json({ error: "Zoeken op adres lukt nu niet. Typ een plaatsnaam." }, { status: 502 });
    }
  }

  const q = cleanQuery(params.get("q"));
  if (!q) return Response.json({ error: "Typ 2 tot 80 letters of cijfers" }, { status: 400 });
  const answer = await answerSuggest(q, { suggest: suggestLocations, towns: getTowns });
  // De terugval kort bewaren: zodra PDOK weer werkt, willen we die antwoorden
  return Response.json(answer, {
    headers: { "Cache-Control": answer.bron === "pdok" ? "public, max-age=3600" : "public, max-age=60" },
  });
}
