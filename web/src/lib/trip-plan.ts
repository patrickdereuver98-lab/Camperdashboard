// Dagplanning voor Mijn reis: per etappe hoe laat je vertrekt, hoe lang je rijdt en hoe laat je aankomt, en of dat
// past bij de aankomsttijden van de volgende plek. Vertrektijd is het kernfeit: vraagt een plek je eerder te vertrekken
// dan je gewend bent, dan rekenen we met die tijd. Wat de plek niet noemt, blijft onbekend: dan geen waarschuwing.
import { timeToMinutes } from "./format";
import type { RoutePrefs } from "./route-prefs";
import type { PlaceSummary } from "./types";

export type PlanPlace = Pick<PlaceSummary, "departure" | "checkoutUntil" | "departureCheck" | "checkinFrom" | "checkinUntil" | "access24h">;

export interface Leg {
  distanceM: number;
  durationS: number;
}

export type ArrivalStatus = "ok" | "vroeg" | "laat" | "onbekend";

export interface LegPlan {
  /** Dag van de reis waarop je deze etappe rijdt (0 = eerste dag) */
  day: number;
  /** Vertrektijd in minuten na middernacht */
  departMin: number;
  /** Waar de vertrektijd vandaan komt: de vertrektijd van de plek, jouw eigen tijd, of na een tussenstop */
  departSource: "plek" | "jij" | "tussenstop";
  /** Rijtijd met jouw marge, zonder pauzes (minuten) */
  driveMin: number;
  /** Pauzes onderweg (minuten) */
  pauseMin: number;
  /** Aankomst in minuten na middernacht van die dag (kan boven 24 uur komen) */
  arriveMin: number;
  /** Of de aankomst past bij de aankomsttijden van de bestemming */
  status: ArrivalStatus;
  /** Bij "vroeg": hoe lang je moet wachten */
  waitMin?: number;
  /** Rijtijd van die dag tot en met deze etappe (meerdere etappes op één dag bij tussenstops) */
  dayDriveMin: number;
  /** Meer dan je wilt rijden op één dag */
  overLimit: boolean;
  /**
   * Plek "per 24 uur": vertrek je later dan je aankwam, dan betaal je mogelijk een dag extra. Alleen als de aankomsttijd
   * bij die plek bekend is (de vorige etappe). Waarde = de aankomsttijd daar.
   */
  per24Until?: number;
}

export interface PlanInput {
  stops: { nights: number; place: PlanPlace }[];
  /** legs[i] = etappe naar stop i; undefined als er geen etappe is (eerste stop zonder beginpunt) of niet bekend */
  legs: (Leg | undefined)[];
  /** Etappe van de laatste stop naar het eindpunt, als de reis daar eindigt */
  endLeg?: Leg;
  prefs: RoutePrefs;
}

export interface TripPlan {
  legs: (LegPlan | undefined)[];
  endLeg?: LegPlan;
  /** Langste rijdag in minuten (rijden plus pauzes) */
  longestDayMin: number;
  /** Aantal dagen waarop je rijdt */
  driveDays: number;
  /** Etappes boven je grens */
  overLimitCount: number;
  /** Aankomsten buiten de aankomsttijden */
  arrivalIssues: number;
}

/** Uiterlijke vertrektijd van de plek, als die vaststaat en niet is afgewezen */
export function checkoutMin(p: PlanPlace): number | undefined {
  if (p.departure !== "vast" || p.departureCheck === "afgewezen") return undefined;
  return timeToMinutes(p.checkoutUntil);
}

/** Rijtijd met marge en pauzes: per volle 2 uur rijden één pauze */
export function driveTime(durationS: number, prefs: Pick<RoutePrefs, "slowerPct" | "pauseMin">) {
  const driveMin = Math.round((durationS / 60) * (1 + prefs.slowerPct / 100));
  const pauses = Math.floor(driveMin / 120);
  // Een pauze precies bij aankomst telt niet
  const n = driveMin > 0 && driveMin % 120 === 0 ? pauses - 1 : pauses;
  return { driveMin, pauseMin: Math.max(0, n) * prefs.pauseMin };
}

/** Past de aankomst bij de aankomsttijden van de plek? Onbekend blijft onbekend. */
export function arrivalStatus(arriveMin: number, p: PlanPlace): { status: ArrivalStatus; waitMin?: number } {
  const from = timeToMinutes(p.checkinFrom);
  const until = timeToMinutes(p.checkinUntil);
  if (from === undefined && until === undefined) return { status: "onbekend" };
  if (until !== undefined && !p.access24h && arriveMin > until) return { status: "laat" };
  if (from !== undefined && arriveMin < from) return { status: "vroeg", waitMin: from - arriveMin };
  return { status: "ok" };
}

export function planTrip({ stops, legs, endLeg, prefs }: PlanInput): TripPlan {
  const ownDepart = timeToMinutes(prefs.departTime) ?? 600;
  const out: (LegPlan | undefined)[] = [];
  let day = 0;
  // Waar en wanneer je vertrekt voor de volgende etappe
  let prev: { place?: PlanPlace; nights: number; arriveMin?: number; day: number } | null = null;
  let dayDrive = 0;
  let dayOf = -1;

  const plan = (leg: Leg, target: PlanPlace | null): LegPlan => {
    let departMin = ownDepart;
    let departSource: LegPlan["departSource"] = "jij";
    let per24Until: number | undefined;
    if (prev && prev.nights === 0 && prev.arriveMin !== undefined) {
      // Tussenstop: dezelfde dag verder na je eigen verblijfstijd
      departMin = prev.arriveMin + prefs.stopoverMin;
      departSource = "tussenstop";
      day = prev.day;
    } else {
      if (prev) day = prev.day + prev.nights;
      const latest = prev?.place ? checkoutMin(prev.place) : undefined;
      if (latest !== undefined && latest < departMin) {
        departMin = latest;
        departSource = "plek";
      }
      if (prev?.place?.departure === "per24" && prev.place.departureCheck !== "afgewezen" && prev.arriveMin !== undefined && prev.arriveMin < 24 * 60 && departMin > prev.arriveMin)
        per24Until = prev.arriveMin;
    }
    if (day !== dayOf) {
      dayOf = day;
      dayDrive = 0;
    }
    const { driveMin, pauseMin } = driveTime(leg.durationS, prefs);
    dayDrive += driveMin + pauseMin;
    const arriveMin = departMin + driveMin + pauseMin;
    const arrival = target ? arrivalStatus(arriveMin, target) : { status: "onbekend" as const };
    return {
      day,
      departMin,
      departSource,
      driveMin,
      pauseMin,
      arriveMin,
      ...arrival,
      dayDriveMin: dayDrive,
      overLimit: prefs.maxDriveMin > 0 && dayDrive > prefs.maxDriveMin,
      ...(per24Until !== undefined ? { per24Until } : {}),
    };
  };

  stops.forEach((s, i) => {
    const leg = legs[i];
    if (!leg) {
      out.push(undefined);
      // Eerste stop zonder beginpunt: de reis begint hier, de aankomsttijd weten we niet
      const last: { nights: number; day: number } | null = prev;
      prev = { place: s.place, nights: s.nights, day: last ? last.day + last.nights : 0 };
      return;
    }
    const lp = plan(leg, s.place);
    out.push(lp);
    prev = { place: s.place, nights: s.nights, arriveMin: lp.arriveMin, day: lp.day };
  });
  const end = endLeg ? plan(endLeg, null) : undefined;

  const all = [...out, end].filter((l): l is LegPlan => !!l);
  const perDay = new Map<number, number>();
  for (const l of all) perDay.set(l.day, Math.max(perDay.get(l.day) ?? 0, l.dayDriveMin));
  return {
    legs: out,
    endLeg: end,
    longestDayMin: Math.max(0, ...perDay.values()),
    driveDays: perDay.size,
    overLimitCount: all.filter((l) => l.overLimit).length,
    arrivalIssues: out.filter((l) => l && (l.status === "laat" || l.status === "vroeg")).length,
  };
}

/** Minuten na middernacht als klok: 615 → "10:15"; boven 24 uur met "+1 dag" erachter */
export function clock(min: number): string {
  const m = Math.round(min);
  const days = Math.floor(m / (24 * 60));
  const t = ((m % (24 * 60)) + 24 * 60) % (24 * 60);
  const s = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  return days > 0 ? `${s} (+${days} dag)` : s;
}

/** Minuten als duur: 95 → "1 u 35 min" */
export function minutesText(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} u ${m % 60} min` : `${h} uur`;
}
