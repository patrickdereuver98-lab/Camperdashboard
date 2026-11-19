import { timeToMinutes } from "./format";

/**
 * "Nog 2 uur en 10 minuten om vandaag aan te komen" op de plekpagina (UX-audit november). Alleen met een bekende
 * laatste aankomsttijd; dag en nacht open of onbekend: niets (we raden geen tijden). `nowMin` = minuten sinds
 * middernacht in Nederland.
 */
export function arrivalToday(
  p: { checkinFrom?: string; checkinUntil?: string; access24h?: boolean },
  nowMin: number,
): { text: string; closed: boolean } | undefined {
  if (p.access24h) return undefined;
  const until = timeToMinutes(p.checkinUntil);
  if (until === undefined) return undefined;
  const from = timeToMinutes(p.checkinFrom);
  // Tot na middernacht (aankomen 14:00 tot 01:00): voor de middag telt de tijd van vannacht nog
  const overnight = from !== undefined && until < from;
  let left: number;
  if (overnight) left = nowMin < until ? until - nowMin : nowMin >= from ? until + 1440 - nowMin : -1;
  else left = until - nowMin;
  if (from !== undefined && !overnight && nowMin < from) return { text: `Aankomen kan vandaag vanaf ${p.checkinFrom}`, closed: false };
  if (left <= 0) return { text: `Vandaag kun je hier niet meer aankomen (tot ${p.checkinUntil})`, closed: true };
  // Ruim de tijd: het aankomstvenster in het beslisblok zegt genoeg
  if (left > 4 * 60) return undefined;
  const h = Math.floor(left / 60);
  const m = left % 60;
  const span = [h ? `${h} uur` : "", m ? `${m} ${m === 1 ? "minuut" : "minuten"}` : ""].filter(Boolean).join(" en ");
  return { text: `Nog ${span} om vandaag aan te komen (tot ${p.checkinUntil})`, closed: false };
}
