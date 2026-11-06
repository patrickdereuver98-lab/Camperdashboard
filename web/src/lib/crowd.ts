export type CrowdLevel = "rustig" | "druk" | "vol";
export type CrowdStatus = { level: CrowdLevel | null; reports: number; last_at: string | null; counts: Partial<Record<CrowdLevel, number>> };

export const CROWD_LABEL: Record<CrowdLevel, string> = { rustig: "Rustig", druk: "Druk", vol: "Vol" };

/** "12 minuten geleden", "2 uur geleden", "net"; undefined als het tijdstip onleesbaar is (nooit "NaN uur geleden") */
export function ago(iso: string, now = new Date()): string | undefined {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t) || Number.isNaN(now.getTime())) return undefined;
  const min = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (min < 2) return "net";
  if (min < 60) return `${min} minuten geleden`;
  const h = Math.round(min / 60);
  return h === 1 ? "1 uur geleden" : `${h} uur geleden`;
}

export type CrowdSummary = { title: string; detail: string; level: CrowdLevel | null };

/** Wat we tonen: alleen wat camperaars meldden, met aantal en tijdstip. Geen melding = "nog niemand gemeld". */
export function crowdSummary(s: CrowdStatus | null, now = new Date()): CrowdSummary {
  if (!s || !s.level || !s.reports || !s.last_at) {
    return { title: "Nog niemand gemeld", detail: "Sta je hier? Laat anderen weten hoe druk het is.", level: null };
  }
  const who = s.reports === 1 ? "1 camperaar" : `${s.reports} camperaars`;
  const when = ago(s.last_at, now);
  return { title: CROWD_LABEL[s.level], detail: when ? `Volgens ${who}, laatste melding ${when}` : `Volgens ${who}`, level: s.level };
}

/** Wat we tonen als de drukte niet te laden is: een storing is geen "nog niemand gemeld" (DATA-12) */
export const CROWD_ERROR: CrowdSummary = { title: "Drukte nu niet te laden", detail: "Probeer het later opnieuw.", level: null };
