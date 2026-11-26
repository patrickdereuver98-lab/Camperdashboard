type Dated = { arrive: Date; leave: Date };

/**
 * Welke stop is nu de volgende (Mijn reis "volgende stop eerst", ontwerpronde 2, 26 november 2026)?
 * - Met datum en de reis is bezig: de plek van vannacht, anders de stop na de plek waar je vandaag vertrekt.
 * - Met datum en de reis moet nog beginnen: de eerste stop. Is de reis voorbij: geen.
 * - Zonder datum: de eerste stop.
 */
export function nextStopIndex(
  count: number,
  dated: Dated[] | null,
  today: { tonight?: number; leaving?: number } | undefined,
  now = new Date(),
): { index: number; label: "Vannacht" | "Volgende stop" | "Eerste stop" } | null {
  if (!count) return null;
  if (!dated) return { index: 0, label: "Eerste stop" };
  if (today?.tonight !== undefined) return { index: today.tonight, label: "Vannacht" };
  if (today?.leaving !== undefined) return today.leaving + 1 < count ? { index: today.leaving + 1, label: "Volgende stop" } : null;
  const first = dated[0]?.arrive;
  if (first && first > now) return { index: 0, label: "Volgende stop" };
  return null;
}
