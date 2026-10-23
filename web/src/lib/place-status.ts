import type { Place } from "./types";

/**
 * Onvolledig (PRD, "Wanneer staat een plek online", besluit 18 oktober 2026): de plek haalt de publicatiedrempel en
 * staat online, maar de vertrekregel is onbekend. Op kaart en lijst grijs, op de plekpagina met de vraag om de
 * vertrektijd door te geven. Plekken onder de drempel zijn niet gepubliceerd en komen hier niet langs.
 */
export function isIncomplete(p: Pick<Place, "departure">): boolean {
  return !p.departure;
}

/** Na zoveel maanden zonder controle staat er "mogelijk verouderd" (PRD, "Databronnen") */
export const OUTDATED_MONTHS = 12;

type CheckDates = Pick<Place, "verifiedAt" | "departureCheckedAt">;

/**
 * Het meest recente controlemoment van een plek: de laatste keer dat de website iets opleverde (`verified_at`) of dat
 * beheer of de eigenaar de vertrekregel controleerde (`departure_checked_at`). Bewust niet `last_scraped_at` (wordt
 * ook gezet als de website niets opleverde) en niet `updated_at` (verandert bij elke schrijfactie). Geen geldige
 * datum: undefined, nooit een gok.
 */
export function lastChecked(p: CheckDates): string | undefined {
  let best: string | undefined;
  let bestTime = -Infinity;
  for (const iso of [p.verifiedAt, p.departureCheckedAt]) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isNaN(t) || t <= bestTime) continue;
    best = iso;
    bestTime = t;
  }
  return best;
}

/** Ouder dan 12 kalendermaanden? Zonder controlemoment is het antwoord nee: dan weten we het niet. */
export function isPossiblyOutdated(p: CheckDates, now: Date = new Date()): boolean {
  const iso = lastChecked(p);
  if (!iso) return false;
  const limit = new Date(iso);
  limit.setUTCMonth(limit.getUTCMonth() + OUTDATED_MONTHS);
  return now.getTime() > limit.getTime();
}
