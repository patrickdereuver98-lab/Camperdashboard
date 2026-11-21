// "Check voor vertrek": drie regels in gewone taal vlak voor de reviews, alleen uit feiten die we kennen.
// Onbekend verzinnen we niet: bij een onbekende vertrektijd staat er eerlijk dat we het niet weten.
import { arrivalText, cardPrice, departureLong, RESERVATION_TEXT, reservationRuleOf, type ReservationRule } from "./format";
import type { Extra } from "./trip-extras";

export interface CheckFacts {
  departure?: "vrij" | "per24" | "vast";
  departureCheck?: "bevestigd" | "voorwaardelijk" | "afgewezen";
  checkoutUntil?: string;
  checkinFrom?: string;
  checkinUntil?: string;
  priceEur?: number;
  priceFrom?: boolean;
  priceExtras?: Extra[];
  touristTaxIncluded?: boolean;
  reservationRule?: ReservationRule;
  reservation?: boolean;
  dogs?: boolean;
  power?: boolean;
  maxStayNights?: number;
}

export interface CheckLine {
  /** Kort woord voor de lezer: "Vertrek", "Prijs", "Aankomst", "Honden" */
  label: string;
  text: string;
}

/** Hoogstens `max` regels. Volgorde: vertrektijd, prijs, daarna het eerste bekende van aankomst, honden, stroom */
export function checkVoorVertrek(p: CheckFacts, max = 3): CheckLine[] {
  const lines: CheckLine[] = [];

  const departure = departureLong(p);
  lines.push(
    departure === "Onbekend"
      ? { label: "Vertrek", text: "De vertrektijd kennen we nog niet. Vraag het bij aankomst na." }
      : { label: "Vertrek", text: departure },
  );

  const price = cardPrice(p);
  if (price) {
    const extra = price.extras || p.touristTaxIncluded === false ? ", plus toeslagen" : price.perNight ? " per nacht" : "";
    lines.push({ label: "Prijs", text: `${price.value}${extra}` });
  }

  const rule = reservationRuleOf(p);
  const arrival = arrivalText(p);
  if (rule === "verplicht") lines.push({ label: "Reserveren", text: RESERVATION_TEXT.verplicht });
  else if (arrival) lines.push({ label: "Aankomst", text: arrival });
  else if (rule) lines.push({ label: "Reserveren", text: RESERVATION_TEXT[rule] });
  else if (typeof p.dogs === "boolean") lines.push({ label: "Honden", text: p.dogs ? "Honden zijn welkom" : "Honden zijn niet toegestaan" });
  else if (typeof p.power === "boolean") lines.push({ label: "Stroom", text: p.power ? "Stroom aanwezig" : "Geen stroom" });

  return lines.slice(0, max);
}
