import { getSummaries } from "@/lib/places";

/** Lichte dataset voor zoeken, kaart en reisplanner in de browser */
export async function GET() {
  return Response.json(await getSummaries(), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
  });
}
