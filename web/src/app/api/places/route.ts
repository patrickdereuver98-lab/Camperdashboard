import { bboxKey, parseBbox, snapBbox } from "@/lib/bbox";
import { getSummaries, getSummariesInBbox } from "@/lib/places";
import { encodeSummaries } from "@/lib/summary-wire";
import type { PlaceSummary } from "@/lib/types";

const CACHE = { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" };

/**
 * Lichte dataset voor zoeken, kaart en reisplanner in de browser.
 * `?bbox=west,zuid,oost,noord` geeft alleen de plekken in dat gebied (PostGIS); de bbox wordt op een raster
 * afgerond, en een afwijkende aanvraag doorgestuurd naar die afgeronde URL zodat de CDN-cache gedeeld wordt.
 * `?f=compact` geeft het compacte formaat (`lib/summary-wire.ts`, een derde kleiner); zonder blijft het een lijst.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const compact = url.searchParams.get("f") === "compact";
  const send = (places: PlaceSummary[]) => Response.json(compact ? encodeSummaries(places) : places, { headers: CACHE });
  const raw = url.searchParams.get("bbox");
  if (raw === null) return send(await getSummaries());

  const bbox = parseBbox(raw);
  if (!bbox) return Response.json({ error: "bbox moet west,zuid,oost,noord zijn" }, { status: 400 });
  const snapped = snapBbox(bbox);
  if (bboxKey(snapped) !== raw) {
    url.searchParams.set("bbox", bboxKey(snapped));
    return Response.redirect(url, 308);
  }
  return send(await getSummariesInBbox(snapped));
}
