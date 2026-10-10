import { getPlaces } from "@/lib/places";

export async function GET() {
  const places = await getPlaces();
  return Response.json(places, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
