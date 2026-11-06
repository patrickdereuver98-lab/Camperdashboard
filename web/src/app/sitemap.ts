import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";
import { getLastUpdate, getSlugs, getSummaries } from "@/lib/places";
import { PROVINCES } from "@/lib/types";
import { areaPath, areasIn, departurePath, DEPARTURE_SEO, indexable, inGroup, lastModifiedOf, provinceSlug, type SeoDeparture } from "@/lib/seo-pages";

/** Pagina's met een lijst plekken: die veranderen mee met de data, dus `lastModified` = de laatste update */
const LISTS = ["", "/zoeken", "/zonder-vertrektijd", "/uitslapers", "/overige-plekken"];

/** Tekstpagina's: geen betrouwbare wijzigingsdatum, dus geen `lastModified` (beter niets dan een verzonnen datum) */
const TEXT = [
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

// Geen `priority` of `changeFrequency`: Google negeert beide. Wel een eerlijke `lastModified` waar we die kennen.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [places, all, updated] = await Promise.all([getSlugs(), getSummaries(), getLastUpdate()]);
  const lastModified = updated || undefined;
  // Landingspagina's alleen met genoeg plekken (MIN_PLACES); dunnere pagina's staan op noindex en horen hier niet
  const landing: string[] = PROVINCES.map((p) => `/camperplaatsen/${provinceSlug(p)}`);
  for (const prov of PROVINCES) {
    const inProv = all.filter((p) => p.province === prov);
    for (const g of Object.keys(DEPARTURE_SEO) as SeoDeparture[]) if (indexable(inGroup(inProv, g).length)) landing.push(departurePath(g, prov));
    for (const a of areasIn(all, prov)) if (indexable(a.places.length)) landing.push(areaPath(prov, a.slug));
  }
  return [
    ...LISTS.map((path) => ({ url: `${SITE_URL}${path}`, lastModified })),
    ...TEXT.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...landing.map((path) => ({ url: `${SITE_URL}${path}`, lastModified })),
    // Jongste van wijziging, websitecontrole en vertrekcontrole (lastModifiedOf); zonder datum geen `lastmod`
    ...places.map((p) => ({ url: `${SITE_URL}/plek/${p.slug}`, lastModified: lastModifiedOf(p) })),
  ];
}
