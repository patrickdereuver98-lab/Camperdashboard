import { getRoute, pointsKey } from "@/lib/routing";
import { checkPoints, parseRouteOptions, POINTS_ERROR } from "@/lib/route-options";
import { rateLimited } from "@/lib/rate-limit";

/**
 * GET /api/route?p=lat,lng;lat,lng;… (2–27 punten: vertrekpunt, 25 stops en eindpunt)
 * Optioneel de camper (h, w, l, b) en wat je wilt vermijden (x=tolls,ferries,highways).
 */
export async function GET(request: Request) {
  const limited = rateLimited(request, 30);
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const check = checkPoints(params.get("p"), 2, 27);
  if (!check.ok) return Response.json({ error: POINTS_ERROR[check.reason], reason: check.reason }, { status: 400 });
  const points = check.points.map(([lat, lng]) => [Math.round(lng * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] as [number, number]);
  try {
    const route = await getRoute(pointsKey(points, parseRouteOptions(params)));
    return Response.json(route, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ error: "De routeplanner is tijdelijk niet bereikbaar", reason: "dienst" }, { status: 502 });
  }
}
