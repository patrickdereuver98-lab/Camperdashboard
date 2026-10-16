import { getRoute, parsePoints, pointsKey } from "@/lib/routing";
import { rateLimited } from "@/lib/rate-limit";

/** GET /api/route?p=lat,lng;lat,lng;… (2–25 punten) */
export async function GET(request: Request) {
  const limited = rateLimited(request, 30);
  if (limited) return limited;
  const points = parsePoints(new URL(request.url).searchParams.get("p"), 25);
  if (!points) return Response.json({ error: "Geef 2 tot 25 punten op als lat,lng;lat,lng" }, { status: 400 });
  try {
    const route = await getRoute(pointsKey(points));
    return Response.json(route, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ error: "De routeplanner is tijdelijk niet bereikbaar" }, { status: 502 });
  }
}
