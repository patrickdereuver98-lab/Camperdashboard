// Nieuwe pogingen bij tijdelijke fouten van open-data-diensten (PDOK, Overpass): 429 en 5xx-overbelasting, time-outs en
// verbroken verbindingen. Exponentiële wachttijd met spreiding; een Retry-After van de dienst gaat voor.

/** Statussen waarbij de dienst tijdelijk niet kan; alles daarbuiten (400, 404) is blijvend en proberen we niet opnieuw */
export const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export type RetryOptions = {
  retries?: number;
  /** Eerste wachttijd in ms; daarna 2×, 4× … */
  baseMs?: number;
  maxMs?: number;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
  rand?: () => number;
};

/** Wachttijd voor poging `attempt` (0 = eerste herhaling): tussen de helft en het geheel van base × 2^attempt */
export function backoffMs(attempt: number, baseMs = 1000, maxMs = 60_000, rand = Math.random): number {
  const top = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.round(top / 2 + (rand() * top) / 2);
}

/** Retry-After in ms (seconden of een HTTP-datum), of undefined */
export function retryAfterMs(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const s = Number(value);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

/** fetch met nieuwe pogingen. Geeft het laatste antwoord terug (ook een 503 na alle pogingen); gooit alleen bij netwerkfouten. */
export async function fetchRetry(url: string, init: RequestInit = {}, o: RetryOptions = {}): Promise<Response> {
  const { retries = 3, baseMs = 1000, maxMs = 60_000, timeoutMs = 10_000, fetchFn = fetch, rand = Math.random } = o;
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!RETRY_STATUS.has(res.status) || attempt >= retries) return res;
      const wait = Math.min(maxMs, retryAfterMs(res.headers.get("retry-after")) ?? backoffMs(attempt, baseMs, maxMs, rand));
      await res.body?.cancel();
      await sleep(wait);
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(backoffMs(attempt, baseMs, maxMs, rand));
    }
  }
}

/** Werk in delen van `limit` tegelijk, zodat een batch van 40 adressen de dienst niet met 40 verzoeken tegelijk raakt */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
