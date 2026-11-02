/**
 * Links met herkomst (plan §3.6): `?bron=` en `?campagne=` die de eigen statistiek meeneemt (lib/track.ts). Geen
 * pixels of cookies van derden: alleen de link zelf zegt waar iemand vandaan kwam.
 */

/** "Instagram Bio" → "instagram-bio"; undefined als er niets bruikbaars overblijft */
export function cleanSource(v: string | null | undefined): string | undefined {
  const s = (v ?? "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return s || undefined;
}

/** Link naar een pagina van VrijStaan met bron en campagne; bestaande parameters blijven staan */
export function campaignLink(base: string, path: string, bron: string, campagne?: string): string {
  const url = new URL(path.startsWith("http") ? path : `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  const b = cleanSource(bron);
  const c = cleanSource(campagne);
  if (b) url.searchParams.set("bron", b);
  if (c) url.searchParams.set("campagne", c);
  return url.toString();
}

/** Standaardbron per kanaal: dezelfde namen als campaigns.bron en de filters in het overzicht */
export const CHANNEL_SOURCE = { instagram: "instagram", tiktok: "tiktok", facebook: "facebook", "google-ads": "google-ads" } as const;
