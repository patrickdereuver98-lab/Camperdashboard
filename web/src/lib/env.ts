// Publieke Supabase-gegevens: de URL en de publishable key zijn bedoeld om in de browser te staan
// (Row Level Security beschermt de data). Overschrijfbaar via .env.local.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://qkrmthrhwmmmwswmfgwc.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_EGEUx5L3Df4w18_DgmtbHw_6RUoglht";

const FALLBACK_SITE_URL = "https://vrijstaan.nl";

/**
 * Adres van de site voor canonicals, sitemap en deelkaarten. Op een productiebuild van Vercel (VERCEL_ENV=production)
 * moet NEXT_PUBLIC_SITE_URL gezet zijn: anders zouden canonicals stil naar de terugval wijzen (review november 2026,
 * R2). Elders (lokaal, CI, previews) blijft de terugval.
 */
export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_ENV?: string }): string {
  const url = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (url) return url.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "production")
    throw new Error("NEXT_PUBLIC_SITE_URL ontbreekt in Vercel (Production). Zet het echte adres van de site, bv. https://www.vrijstaan.nl.");
  return FALLBACK_SITE_URL;
}

export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  VERCEL_ENV: process.env.VERCEL_ENV,
});

/** Zonder netwerk bouwen (CI, afgeschermde omgevingen): gebruik de meegeleverde snapshot. */
export const OFFLINE_BUILD = process.env.VRIJSTAAN_OFFLINE === "1";
