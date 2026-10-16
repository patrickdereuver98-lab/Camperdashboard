/** Bounding box als [westLng, zuidLat, oostLng, noordLat] */
export type Bbox = [number, number, number, number];

/** Ruim om Nederland heen: verder weg staan geen plekken en hoeven we niets op te vragen */
const WORLD: Bbox = [2.5, 50.3, 7.9, 54.0];

/** Raster (graden) waarop een bbox naar buiten wordt afgerond: bezoekers delen zo dezelfde (CDN-)cache-sleutels */
export const BBOX_STEP = 0.25;

export function parseBbox(raw: string | null | undefined): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w >= e || s >= n || w < -180 || e > 180 || s < -90 || n > 90) return null;
  return [w, s, e, n];
}

/** Naar buiten afronden op het raster en begrenzen tot rond Nederland */
export function snapBbox([w, s, e, n]: Bbox, step = BBOX_STEP): Bbox {
  const down = (v: number) => Math.round(Math.floor(v / step) * step * 1000) / 1000;
  const up = (v: number) => Math.round(Math.ceil(v / step) * step * 1000) / 1000;
  return [
    Math.max(WORLD[0], down(w)),
    Math.max(WORLD[1], down(s)),
    Math.min(WORLD[2], up(e)),
    Math.min(WORLD[3], up(n)),
  ];
}

export const bboxKey = (b: Bbox) => b.join(",");

export function inBbox(p: { lat: number; lng: number }, [w, s, e, n]: Bbox) {
  return p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n;
}
