import { departureShort } from "./format";

/**
 * Plekpuls (README "VrijStaan 2.0", concept A): na een bezoek één ja/nee-vraag over het kernfeit. Alleen vragen over
 * wat we al weten; een onbekend feit vragen we niet na (dat gaat via "Vertrektijd doorgeven").
 */
export type PulseQuestion = {
  /** Uniek per plek en per waarde: verandert het feit, dan vragen we opnieuw */
  key: string;
  question: string;
};

/**
 * De backend (claims in de bronnenlaag, README nummer 71) komt later. Tot die tijd staat de vraag uit op de live site;
 * zet NEXT_PUBLIC_PLEKPULS=1 om hem te tonen (lokaal, of in een preview om te testen).
 */
export const PLEKPULS_ACTIEF = process.env.NEXT_PUBLIC_PLEKPULS === "1";

export function departureQuestion(place: {
  slug: string;
  departure?: "vrij" | "per24" | "vast";
  checkoutUntil?: string;
  departureCheck?: "bevestigd" | "voorwaardelijk" | "afgewezen";
}): PulseQuestion | undefined {
  const fact = departureShort(place);
  // "Vaste vertrektijd" zonder tijd is geen ja/nee-vraag
  if (!fact || fact === "Vaste vertrektijd") return undefined;
  return {
    key: `${place.slug}:vertrek:${fact}`,
    question: `Klopt het: ${fact[0].toLowerCase()}${fact.slice(1)}?`,
  };
}
