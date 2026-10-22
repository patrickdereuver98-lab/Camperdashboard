import { timeToMinutes } from "./format";

/** Vertrekregel zoals de kolommen van `places` hem kennen */
export type DepartureChange = { departure: "vrij" | "per24" | "vast"; checkout_until: string | null };

/**
 * Een inzending "vertrektijd" (Doe mee of review) omzetten naar de kolommen van de plek, zodat beheer hem met één klik
 * kan overnemen. Geeft een reden terug als dat niet kan; beheer past de plek dan zelf aan in Plekken.
 */
export function departureFromSubmission(payload: Record<string, unknown>): DepartureChange | { reason: string } | undefined {
  if (payload.onderwerp !== "vertrektijd") return undefined;
  const kind = payload.vertrek;
  if (kind === "vrij" || kind === "per24") return { departure: kind, checkout_until: null };
  if (kind !== "vast") return { reason: "Geen vertrekregel ingevuld" };
  const raw = typeof payload.vertrek_uiterlijk === "string" ? payload.vertrek_uiterlijk : "";
  const minutes = timeToMinutes(raw);
  if (minutes === undefined || minutes >= 24 * 60) return { reason: "Vaste vertrektijd zonder leesbare tijd" };
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return { departure: "vast", checkout_until: `${hh}:${mm}` };
}
