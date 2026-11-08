/**
 * Terugval op de snapshot als Supabase niet antwoordt. Los van `places.ts` (dat `next/cache` en de snapshot laadt),
 * zodat de regels in een gewone test te controleren zijn.
 */

export class SupabaseError extends Error {
  // Geen parameter property: de tests draaien met Node type stripping
  readonly status: number;
  constructor(status: number, body: string) {
    super(`Supabase ${status}: ${body.slice(0, 300)}`);
    this.status = status;
  }
}

/** Statuscodes die op drukte of een time-out wijzen (408, 425, 429): een storing, geen fout in onze query */
const BUSY = new Set([408, 425, 429]);

/** Een storing (opnieuw proberen, daarna snapshot) of een fout in onze query of het schema (doorgeven)? */
export function isOutageStatus(status: number): boolean {
  return status >= 500 || BUSY.has(status);
}

/** Bij drukte (408, 425, 429) of een haperende database (5xx) één keer opnieuw proberen voordat we op de snapshot terugvallen */
export async function fetchWithRetry(url: string, init: RequestInit, retries = 1, doFetch: typeof fetch = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await doFetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (res.ok || attempt >= retries || !isOutageStatus(res.status)) return res;
    await new Promise((r) => setTimeout(r, 300 * 2 ** attempt + Math.random() * 200));
  }
}

export type Sourced<T> = { value: T; fromSnapshot: boolean };

/**
 * Live gegevens, of bij een storing de snapshot (met `fromSnapshot`, zodat de aanroeper die korter cachet en de
 * pagina het kan melden). Een andere 4xx is een fout in onze query of het schema, geen storing. Dan niet stil de
 * snapshot tonen (oude prijzen, verborgen plekken die terugkomen): de fout gaat door, en Next.js blijft de laatst
 * goede versie serveren.
 */
export async function withFallbackSource<T>(live: () => Promise<T>, offline: () => T, offlineBuild = false): Promise<Sourced<T>> {
  if (offlineBuild) return { value: offline(), fromSnapshot: true };
  try {
    return { value: await live(), fromSnapshot: false };
  } catch (err) {
    if (err instanceof SupabaseError && !isOutageStatus(err.status)) {
      console.error("[vrijstaan] Supabase weigert de query:", err.message);
      throw err;
    }
    console.error("[vrijstaan] Supabase niet bereikbaar, snapshot gebruikt:", (err as Error).message);
    return { value: offline(), fromSnapshot: true };
  }
}

export async function withFallback<T>(live: () => Promise<T>, offline: () => T, offlineBuild = false): Promise<T> {
  return (await withFallbackSource(live, offline, offlineBuild)).value;
}

/**
 * Cacheduur voor een resultaat uit de snapshot bij een storing: na 30 seconden proberen we het live opnieuw (op de
 * achtergrond, de bezoeker wacht niet). `stale` en `expire` blijven op 5 minuten en 1 uur, zodat de pagina nog
 * vooraf gebouwd kan worden als Supabase tijdens de build hapert.
 */
export const SNAPSHOT_LIFE = { stale: 300, revalidate: 30, expire: 3600 } as const;
