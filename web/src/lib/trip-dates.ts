// Reis met datums: per stop de aankomst- en vertrekdatum vanaf de vertrekdatum van de reis, en de nachten waarop de
// plek volgens zijn seizoen dicht is. Onbekend seizoen geeft geen waarschuwing (we gokken niet).
import { isOpenOn } from "./search";
import type { PlaceSummary } from "./types";

export type DatedStop = {
  arrive: Date;
  leave: Date;
  /** Nachten (avond van aankomst) waarop de plek volgens het seizoen dicht is */
  closedNights: Date[];
};

/** "2026-11-06" → 6 november 2026, 12:00 lokale tijd (midden op de dag: geen gedoe met zomertijd) */
export function parseDay(value: string | null | undefined): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : undefined;
}

export function dayValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);

export function tripDates(start: Date, stops: { nights: number; place: Pick<PlaceSummary, "openAllYear" | "season"> }[]): DatedStop[] {
  let cursor = start;
  return stops.map((s) => {
    const arrive = cursor;
    const leave = addDays(arrive, s.nights);
    const closedNights: Date[] = [];
    for (let i = 0; i < s.nights; i++) {
      const night = addDays(arrive, i);
      if (isOpenOn(s.place, night) === false) closedNights.push(night);
    }
    cursor = leave;
    return { arrive, leave, closedNights };
  });
}

const DAY = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" });
const DATE = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });

/** "do 6 nov." */
export const shortDay = (d: Date) => DAY.format(d);

/** "7 november", of "7 en 8 november", of "7 november t/m 9 november" bij meer nachten */
export function closedText(nights: Date[]): string {
  if (nights.length === 1) return DATE.format(nights[0]);
  const first = nights[0];
  const last = nights[nights.length - 1];
  if (nights.length === 2 && first.getMonth() === last.getMonth()) return `${first.getDate()} en ${DATE.format(last)}`;
  return `${DATE.format(first)} t/m ${DATE.format(last)}`;
}
