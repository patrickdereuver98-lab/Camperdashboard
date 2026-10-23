// Concept van een review, per plek bewaard in de browser. Zo is de bezoeker niets kwijt als hij eerst moet inloggen
// (ook via Google, Apple of Facebook, of de link in de mail) en daarna terugkomt op de plekpagina.

export type ReviewDraft = {
  scores: Record<string, number>;
  departure: "" | "vrij" | "per24" | "vast";
  checkout: string;
  title: string;
  body: string;
  month: string;
  vehicle: string;
  name: string;
  savedAt: number;
};

/** Na een week is een concept vergeten: dan is de ervaring niet meer vers */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SCORE_KEYS = ["rating", "location", "quiet", "facilities", "value"];
const DEPARTURES = ["", "vrij", "per24", "vast"];
const VEHICLES = ["", "camper", "buscamper", "caravan", "overig"];

export const draftKey = (placeId: string) => `vrijstaan-review-concept:${placeId}`;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Concept uit opslag lezen; alles wat niet klopt of te oud is, valt weg */
export function parseDraft(raw: string | null, now = Date.now()): ReviewDraft | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || typeof v.savedAt !== "number" || now - v.savedAt > DRAFT_TTL_MS) return null;
  const scores: Record<string, number> = {};
  const rawScores = (v.scores ?? {}) as Record<string, unknown>;
  for (const k of SCORE_KEYS) {
    const n = rawScores[k];
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 10) scores[k] = n;
  }
  const departure = DEPARTURES.includes(v.departure as string) ? (v.departure as ReviewDraft["departure"]) : "";
  const checkout = /^\d{2}:\d{2}$/.test(String(v.checkout)) ? String(v.checkout) : "";
  const month = /^\d{4}-\d{2}$/.test(String(v.month)) ? String(v.month) : "";
  const vehicle = VEHICLES.includes(v.vehicle as string) ? String(v.vehicle) : "";
  return {
    scores,
    departure,
    checkout,
    title: text(v.title, 120),
    body: text(v.body, 3000),
    month,
    vehicle,
    name: text(v.name, 60),
    savedAt: v.savedAt,
  };
}

/** Is er iets ingevuld dat het bewaren waard is? */
export function hasContent(d: Omit<ReviewDraft, "savedAt">): boolean {
  return Object.keys(d.scores).length > 0 || !!d.departure || !!d.title.trim() || !!d.body.trim();
}

export function loadDraft(placeId: string): ReviewDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(placeId));
    const d = parseDraft(raw);
    // Te oud of kapot: meteen opruimen
    if (raw && !d) localStorage.removeItem(draftKey(placeId));
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(placeId: string, d: Omit<ReviewDraft, "savedAt">) {
  try {
    if (hasContent(d)) localStorage.setItem(draftKey(placeId), JSON.stringify({ ...d, savedAt: Date.now() }));
    else localStorage.removeItem(draftKey(placeId));
  } catch {
    // Geen opslag (privévenster): het formulier werkt gewoon, alleen zonder concept
  }
}

export function clearDraft(placeId: string) {
  try {
    localStorage.removeItem(draftKey(placeId));
  } catch {
    // idem
  }
}
