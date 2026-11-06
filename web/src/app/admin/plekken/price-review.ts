// Beheer, Plekken: verdachte prijzen (R47) en de site-cache verversen na opslaan. Los van React zodat het te testen is.
import { SUSPICIOUS_CAMPING_PRICE, suspiciousPrice } from "@/lib/price-check";
import type { PlaceKind } from "@/lib/types";

export type PriceRow = { id: string; name: string; town: string | null; kind: string; price_eur: number | null; price_note: string | null };
export type SuspiciousRow = PriceRow & { price_eur: number; reason: string };

/** Ruime voorselectie in de database; `suspiciousPrice` beslist. Lage prijzen en vanaf-prijzen (met hoogste tarief). */
export const SUSPICIOUS_PREFILTER = `price_eur.lt.${SUSPICIOUS_CAMPING_PRICE},price_note.ilike.vanaf*`;

/** De plekken waarvan de nachtprijs nagekeken moet worden, met de reden; laagste prijs eerst */
export function suspiciousRows(rows: PriceRow[]): SuspiciousRow[] {
  const out: SuspiciousRow[] = [];
  for (const r of rows) {
    if (r.price_eur === null) continue;
    const reason = suspiciousPrice({ kind: r.kind as PlaceKind, name: r.name, priceEur: r.price_eur, priceNote: r.price_note ?? undefined });
    if (reason) out.push({ ...r, price_eur: r.price_eur, reason });
  }
  return out.sort((a, b) => a.price_eur - b.price_eur || a.name.localeCompare(b.name, "nl"));
}

/**
 * Vraag de site om de plekken opnieuw op te halen (route /api/revalidate). Fouten negeren we: de cache verloopt
 * vanzelf, en het opslaan zelf is dan al gelukt.
 */
export async function revalidatePlaces(token: string | undefined, doFetch: typeof fetch = fetch): Promise<void> {
  if (!token) return;
  try {
    await doFetch("/api/revalidate", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["places"] }),
    });
  } catch {
    // De cache verloopt vanzelf
  }
}
