import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getPlaces } from "@/lib/places";
import { PROVINCES } from "@/lib/types";

const STATIC = [
  "",
  "/zoeken",
  "/zonder-vertrektijd",
  "/uitslapers",
  "/overige-plekken",
  "/dichtbij",
  "/plek-aanmelden",
  "/veelgestelde-vragen",
  "/contact",
  "/over-ons",
  "/privacy",
  "/cookies",
  "/voorwaarden",
  "/disclaimer",
  "/toegankelijkheid",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const places = await getPlaces();
  return [
    ...STATIC.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "weekly" as const, priority: path ? 0.6 : 1 })),
    ...PROVINCES.map((p) => ({ url: `${SITE_URL}/camperplaatsen/${p.toLowerCase()}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...places.map((p) => ({
      url: `${SITE_URL}/plek/${p.slug}`,
      lastModified: p.verifiedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
