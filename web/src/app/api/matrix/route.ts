import { getTable, pointsKey } from "@/lib/routing";
import { checkPoints, parseRouteOptions, POINTS_ERROR } from "@/lib/route-options";
import { rateLimited } from "@/lib/rate-limit";

/** GET /api/matrix?p=lat,lng;… (3–27 punten): rijtijden van elk punt naar elk punt, voor de slimste volgorde */
export async function GET(request: Request) {
  const limited = rateLimited(request, 10, "matrix");
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const check = checkPoints(params.get("p"), 3, 27);
  if (!check.ok) return Response.json({ error: POINTS_ERROR[check.reason], reason: check.reason }, { status: 400 });
  const points = check.points.map(([lat, lng]) => [Math.round(lng * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4] as [number, number]);
  try {
    const table = await getTable(pointsKey(points, parseRouteOptions(params)));
    return Response.json(table, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch {
    return Response.json({ error: "Rijtijden zijn tijdelijk niet beschikbaar", reason: "dienst" }, { status: 502 });
  }
}
