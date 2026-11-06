import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

// /api/og is de deelafbeelding van een plek (og:image): zoekmachines en sociale media moeten die kunnen ophalen.
// Geen `host`: alleen Yandex las dat, en het domein staat al in de sitemap en de canonicals.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/api/og"], disallow: ["/admin", "/api/", "/support/", "/account", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
