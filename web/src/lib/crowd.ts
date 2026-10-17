export type CrowdLevel = "rustig" | "druk" | "vol";
export type CrowdStatus = { level: CrowdLevel | null; reports: number; last_at: string | null; counts: Partial<Record<CrowdLevel, number>> };

export const CROWD_LABEL: Record<CrowdLevel, string> = { rustig: "Rustig", druk: "Druk", vol: "Vol" };

/** "12 minuten geleden", "2 uur geleden", "net" */
export function ago(iso: string, now = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 2) return "net";
  if (min < 60) return `${min} minuten geleden`;
  const h = Math.round(min / 60);
  return h === 1 ? "1 uur geleden" : `${h} uur geleden`;
}

/** Wat we tonen: alleen wat camperaars meldden, met aantal en tijdstip. Geen melding = "nog niemand gemeld". */
export function crowdSummary(s: CrowdStatus | null, now = new Date()): { title: string; detail: string; level: CrowdLevel | null } {
  if (!s || !s.level || !s.reports || !s.last_at) {
    return { title: "Nog niemand gemeld", detail: "Sta je hier? Laat anderen weten hoe druk het is.", level: null };
  }
  const who = s.reports === 1 ? "1 camperaar" : `${s.reports} camperaars`;
  return { title: CROWD_LABEL[s.level], detail: `Volgens ${who}, laatste melding ${ago(s.last_at, now)}`, level: s.level };
}
