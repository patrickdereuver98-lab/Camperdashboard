import { getMatrix, parsePoints, pointsKey } from "@/lib/routing";

/** GET /api/distances?p=van;naar1;naar2;… (eerste punt = vertrek, max 40 bestemmingen) */
export async function GET(request: Request) {
  const points = parsePoints(new URL(request.url).searchParams.get("p"), 41);
  if (!points) return Response.json({ error: "Geef een vertrekpunt en 1 tot 40 bestemmingen op" }, { status: 400 });
  try {
    const matrix = await getMatrix(pointsKey(points));
    return Response.json(matrix, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return Response.json({ error: "Afstanden zijn tijdelijk niet beschikbaar" }, { status: 502 });
  }
}
