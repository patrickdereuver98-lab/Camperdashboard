import { cacheLife } from "next/cache";
import bundled from "@/data/places.json";
import type { Place } from "./types";
import { distanceKm } from "./geo";

/**
 * Alle camperplaatsen. Leest uit Supabase wanneer die is geconfigureerd,
 * anders uit de meegebouwde dataset (web/scripts/build_data.py).
 */
export async function getPlaces(): Promise<Place[]> {
  "use cache";
  cacheLife("hours");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      return await fetchFromSupabase(url, key);
    } catch (err) {
      console.error("Supabase niet bereikbaar, val terug op lokale data", err);
    }
  }
  return bundled as Place[];
}

export async function getPlace(slug: string): Promise<Place | undefined> {
  const places = await getPlaces();
  return places.find((p) => p.slug === slug);
}

export async function getNearby(place: Place, limit = 6) {
  const places = await getPlaces();
  return places
    .filter((p) => p.slug !== place.slug)
    .map((p) => ({ place: p, km: distanceKm(place, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export async function getStats() {
  const places = await getPlaces();
  const byProvince: Record<string, number> = {};
  for (const p of places)
    byProvince[p.province] = (byProvince[p.province] ?? 0) + 1;
  const share = (fn: (p: Place) => unknown) =>
    places.filter(fn).length / Math.max(1, places.length);
  return {
    known: {
      price: share((p) => p.price),
      dogs: share((p) => p.dogs !== undefined),
      spots: share((p) => p.spots),
      hours: share((p) => p.hours),
      contact: share((p) => p.website || p.phone),
    },
    total: places.length,
    free: places.filter((p) => p.price === "gratis").length,
    power: places.filter((p) => p.power).length,
    water: places.filter((p) => p.water).length,
    priceKnown: places.filter((p) => p.price).length,
    byProvince,
  };
}

async function fetchFromSupabase(url: string, key: string): Promise<Place[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("places")
      .select("*")
      .order("slug")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows.map((r) => {
    const place: Record<string, unknown> = {
      slug: r.slug,
      name: r.name,
      unnamed: r.unnamed,
      town: r.town,
      province: r.province,
      lat: r.lat,
      lng: r.lng,
      price: r.price,
      priceEur: r.price_eur,
      priceText: r.price_text,
      power: r.power,
      dogs: r.dogs,
      water: r.water,
      spots: r.spots,
      hours: r.hours,
      website: r.website,
      phone: r.phone,
    };
    for (const k of Object.keys(place)) if (place[k] == null) delete place[k];
    return place as unknown as Place;
  });
}
