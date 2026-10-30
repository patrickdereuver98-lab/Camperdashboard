// Ontdubbelen vóór de import (Master Database, 30 oktober 2026).
//
// OpenStreetMap heeft dezelfde plek vaak twee keer: een punt bij de receptie én het terrein als vlak, of een vlak én een
// relatie. Live stonden er op 30 oktober 2026 zo'n 30 paren met precies dezelfde naam binnen 100 meter (De Zeeman,
// Zonnehoek, 't Vierendeel). We voegen twee punten alleen samen als ze dicht bij elkaar liggen én de naam overeenkomt;
// twijfelgevallen (Camping de Boomgaard en Camperplaats de Boomgaard, Veld 11 en Veld 12) blijven apart en komen in
// Beheer → Dubbelen (admin_duplicate_candidates), waar een mens beslist.

import { fold } from "./discover.ts";

/** Binnen deze afstand kan het dezelfde plek zijn */
export const CLUSTER_METERS = 100;

/** Woorden die niets zeggen over welke plek het is; cijfers blijven (Veld 11 is niet Veld 12) */
const FILLER = new Set([
  "camping", "minicamping", "mini", "boerencamping", "natuurcamping", "natuurkampeerterrein", "kampeerterrein",
  "camperplaats", "camperplaatsen", "camperpark", "camperplek", "camperstandplaats", "camperparkeerplaats", "camperweide",
  "svr", "de", "het", "den", "der", "t", "aan", "op", "in", "bij", "en", "van",
]);

export type GeoRow = { lat: number; lng: number; name?: unknown; kind?: unknown; osm_type?: unknown; osm_id?: unknown };

/** Afstand in meters (haversine) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Kern van de naam: zonder hoofdletters, accenten, leestekens en vulwoorden ("Minicamping 't Haike" → "haike") */
export function nameKey(name: string): string {
  return fold(name)
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ");
}

/**
 * Dezelfde naam? Alleen als beide een echte naam hebben (een plek zonder naam koppelen we nooit op afstand alleen) en
 * de naam letterlijk gelijk is na het opschonen, of de kern gelijk is bij hetzelfde soort plek.
 */
export function sameName(a: GeoRow, b: GeoRow): boolean {
  if (typeof a.name !== "string" || typeof b.name !== "string") return false;
  const fa = fold(a.name);
  const fb = fold(b.name);
  if (!fa || !fb) return false;
  if (fa === fb) return true;
  const ka = nameKey(a.name);
  return ka.length >= 3 && ka === nameKey(b.name) && a.kind === b.kind;
}

/**
 * Groepen van rijen die dezelfde plek zijn: binnen `meters` én dezelfde naam, transitief (union-find). Rasterindex van
 * ±110 m zodat 4.000 plekken in milliseconden klaar zijn in plaats van 16 miljoen vergelijkingen.
 */
export function clusters<T extends GeoRow>(rows: T[], meters = CLUSTER_METERS): number[][] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const cellDeg = meters / 111_000;
  const cell = (r: GeoRow) => [Math.floor(r.lat / cellDeg), Math.floor(r.lng / (cellDeg / Math.cos((r.lat * Math.PI) / 180)))];
  const grid = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const [y, x] = cell(r);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const j of grid.get(`${y + dy}:${x + dx}`) ?? [])
          if (distanceM(r, rows[j]) <= meters && sameName(r, rows[j])) parent[find(i)] = find(j);
    const key = `${y}:${x}`;
    grid.set(key, [...(grid.get(key) ?? []), i]);
  });
  const groups = new Map<number, number[]>();
  rows.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
  return [...groups.values()];
}

const TYPE_ORDER: Record<string, number> = { relation: 0, way: 1, node: 2 };
const filled = (r: Record<string, unknown>) => Object.values(r).filter((v) => v !== undefined && v !== null && v !== "").length;
export const osmRef = (r: GeoRow) => `${r.osm_type}/${r.osm_id}`;

/**
 * Eén rij per plek. De rij met de meeste gegevens leidt (bij gelijkspel: relatie, dan vlak, dan punt; dan laagste id).
 * Ontbrekende velden vult hij aan uit de andere rijen (allemaal OSM, dus geen nieuwe bron), en `osm_refs` noemt de
 * andere OSM-objecten zodat ingest_osm een plek die eerder onder een van die objecten is binnengekomen, terugvindt in
 * plaats van een tweede aan te maken.
 */
export function dedupeOsm<T extends GeoRow & Record<string, unknown>>(rows: T[], meters = CLUSTER_METERS): T[] {
  return clusters(rows, meters).map((group) => {
    if (group.length === 1) return rows[group[0]];
    const sorted = group
      .map((i) => rows[i])
      .sort(
        (a, b) =>
          filled(b) - filled(a) ||
          (TYPE_ORDER[String(a.osm_type)] ?? 3) - (TYPE_ORDER[String(b.osm_type)] ?? 3) ||
          Number(a.osm_id) - Number(b.osm_id),
      );
    const [lead, ...rest] = sorted;
    const merged: Record<string, unknown> = { ...lead };
    for (const r of rest) for (const [k, v] of Object.entries(r)) if (merged[k] === undefined && v !== undefined) merged[k] = v;
    merged.osm_refs = rest.map(osmRef);
    return merged as T;
  });
}
