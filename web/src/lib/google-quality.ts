// Hoe betrouwbaar is het Google-cijfer voor een camperplek? (README 141, opdracht Patrick 22 november 2026)
// Google geeft één cijfer per plek op de kaart, ook als die plek ook een hotel, manege of restaurant is, en oude reviews
// tellen mee zonder dat de lezer het ziet. Deze regels bepalen wanneer we het cijfer tonen en met welk voorbehoud.
// Zuiver (geen netwerk), zodat ze in `tests/google-rating.test.ts` te controleren zijn.

/** Typen waarbij het cijfer over een kampeerplek gaat */
const CAMP_TYPES = new Set(["campground", "rv_park", "camping_cabin", "campsite", "farmstay"]);
/** Typen waarbij het hoofddoel van de plek iets anders is; het cijfer gaat dan vooral over dat andere */
const OTHER_PRIMARY = new Set([
  "hotel", "lodging", "motel", "resort_hotel", "bed_and_breakfast", "guest_house", "hostel", "restaurant", "bar", "cafe", "pub",
  "equestrian_facility", "event_venue", "wedding_venue", "banquet_hall", "store", "supermarket", "gas_station", "museum",
  "tourist_attraction", "park", "amusement_park", "spa", "sports_complex", "golf_course", "swimming_pool", "parking", "parking_lot",
]);

export type Confidence = "hoog" | "middel" | "laag";

export interface GoogleFacts {
  rating?: number | null;
  count?: number | null;
  primaryType?: string | null;
  types?: string[] | null;
  /** Aantal reviews dat we van Google kregen (hoogstens vijf), hoeveel daarvan van de laatste 12 maanden, en de nieuwste */
  reviewsSampled?: number | null;
  reviewsRecent?: number | null;
  newestReviewAt?: string | null;
}

export interface GoogleAssessment {
  confidence: Confidence;
  /** Toon het cijfer op de site? Alleen bij hoog of middel */
  show: boolean;
  /** Korte reden in gewone taal voor Beheer en voor de zin onder het cijfer */
  reasons: string[];
  /** Voorbehoud voor onder het cijfer, of leeg */
  note?: string;
}

const MONTH = 30.44 * 86400_000;

/** Leeftijd van de nieuwste review in maanden; undefined als we geen datum hebben */
export function ageMonths(iso: string | null | undefined, now = Date.now()): number | undefined {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, (now - t) / MONTH) : undefined;
}

export function assessGoogle(g: GoogleFacts, now = Date.now()): GoogleAssessment {
  const reasons: string[] = [];
  const primary = g.primaryType ?? undefined;
  const types = g.types ?? [];
  const campLike = (primary && CAMP_TYPES.has(primary)) || (!primary && types.some((t) => CAMP_TYPES.has(t)));
  const otherMain = !!primary && OTHER_PRIMARY.has(primary);
  const count = g.count ?? 0;
  const newest = ageMonths(g.newestReviewAt, now);

  if (typeof g.rating !== "number" || count < 1) return { confidence: "laag", show: false, reasons: ["geen cijfer"] };
  if (otherMain) reasons.push(`hoofdfunctie bij Google is ${primary}, niet kamperen`);
  else if (!campLike && primary) reasons.push(`type bij Google is ${primary}`);
  if (count < 3) reasons.push("minder dan 3 reviews");
  if (newest !== undefined && newest > 24) reasons.push("nieuwste review ouder dan 2 jaar");

  // Laag: een andere hoofdfunctie, bijna geen reviews, of alleen oude reviews
  if (otherMain || count < 3 || (newest !== undefined && newest > 24)) return { confidence: "laag", show: false, reasons };

  const recentShare = g.reviewsSampled ? (g.reviewsRecent ?? 0) / g.reviewsSampled : undefined;
  const sure = campLike && count >= 10 && (newest === undefined || newest <= 12) && (recentShare === undefined || recentShare >= 0.4);
  if (sure) return { confidence: "hoog", show: true, reasons };

  if (count < 10) reasons.push("weinig reviews");
  if (newest !== undefined && newest > 12) reasons.push("nieuwste review ouder dan een jaar");
  if (recentShare !== undefined && recentShare < 0.4) reasons.push("weinig recente reviews");
  const note = count < 10 ? "Weinig reviews" : newest !== undefined && newest > 12 ? "Vooral oudere reviews" : undefined;
  return { confidence: "middel", show: true, reasons, note };
}

/** Reviewstatistiek voor de afgeleide kolommen: hoeveel van de steekproef is van de laatste 12 maanden, en de nieuwste datum */
export function reviewStats(reviews: { publishTime?: string }[], now = Date.now()) {
  const times = reviews.map((r) => Date.parse(r.publishTime ?? "")).filter(Number.isFinite);
  return {
    sampled: reviews.length,
    recent: times.filter((t) => now - t <= 12 * MONTH).length,
    newest: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}
