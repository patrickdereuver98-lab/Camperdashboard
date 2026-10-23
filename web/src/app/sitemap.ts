import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getSlugs, getSummaries } from "@/lib/places";
import { PROVINCES } from "@/lib/types";
import { areaPath, areasIn, departurePath, DEPARTURE_SEO, indexable, inGroup, provinceSlug, type SeoDeparture } from "@/lib/seo-pages";

const STATIC = [
  "",
  "/zoeken",
  "/zonder-vertrektijd",
  "/uitslapers",
  "/overige-plekken",
  "/dichtbij",
  "/plek-aanmelden",
  "/doe-mee",
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
  const [places, all] = await Promise.all([getSlugs(), getSummaries()]);
  const weekly = "weekly" as const;
  // Landingspagina's alleen met genoeg plekken (MIN_PLACES); dunnere pagina's staan op noindex en horen hier niet
  const landing: string[] = [];
  for (const prov of PROVINCES) {
    const inProv = all.filter((p) => p.province === prov);
    for (const g of Object.keys(DEPARTURE_SEO) as SeoDeparture[]) if (indexable(inGroup(inProv, g).length)) landing.push(departurePath(g, prov));
    for (const a of areasIn(all, prov)) if (indexable(a.places.length)) landing.push(areaPath(prov, a.slug));
  }
  return [
    ...STATIC.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: weekly, priority: path ? 0.6 : 1 })),
    ...PROVINCES.map((p) => ({ url: `${SITE_URL}/camperplaatsen/${provinceSlug(p)}`, changeFrequency: weekly, priority: 0.7 })),
    ...landing.map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: weekly, priority: 0.7 })),
    ...places.map((p) => ({
      url: `${SITE_URL}/plek/${p.slug}`,
      lastModified: p.verifiedAt ?? undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
