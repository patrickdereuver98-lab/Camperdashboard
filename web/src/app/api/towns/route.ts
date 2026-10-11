import { getTowns } from "@/lib/places";

export async function GET() {
  return Response.json(await getTowns(), {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
