// Nieuwe pogingen bij PDOK en Overpass: 429 en 5xx opnieuw, 4xx niet, Retry-After gaat voor
import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffMs, fetchRetry, mapLimit, retryAfterMs } from "../supabase/functions/pipeline/retry";

const answers = (...statuses: (number | Error)[]) => {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url);
    const s = statuses.shift()!;
    if (s instanceof Error) throw s;
    return new Response("x", { status: s, headers: s === 429 ? { "retry-after": "7" } : {} });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
};

test("wachttijd: exponentieel, met spreiding en een plafond", () => {
  assert.equal(backoffMs(0, 1000, 60_000, () => 1), 1000);
  assert.equal(backoffMs(2, 1000, 60_000, () => 0), 2000);
  assert.equal(backoffMs(20, 1000, 60_000, () => 1), 60_000);
  assert.equal(retryAfterMs("3"), 3000);
  assert.equal(retryAfterMs(new Date(10_000).toUTCString(), 4000), 6000);
  assert.equal(retryAfterMs(null), undefined);
});

test("503 en 429 opnieuw, met Retry-After; daarna het goede antwoord", async () => {
  const { calls, fetchFn } = answers(503, 429, 200);
  const slept: number[] = [];
  const res = await fetchRetry("https://api.pdok.nl/x", {}, { fetchFn, sleep: async (ms) => slept.push(ms), rand: () => 1 });
  assert.equal(res.status, 200);
  assert.equal(calls.length, 3);
  assert.deepEqual(slept, [1000, 7000]);
});

test("404 is blijvend: geen nieuwe poging; na alle pogingen het laatste antwoord", async () => {
  const a = answers(404);
  assert.equal((await fetchRetry("https://x", {}, { fetchFn: a.fetchFn, sleep: async () => {} })).status, 404);
  assert.equal(a.calls.length, 1);
  const b = answers(503, 503, 503);
  assert.equal((await fetchRetry("https://x", {}, { retries: 2, fetchFn: b.fetchFn, sleep: async () => {} })).status, 503);
  assert.equal(b.calls.length, 3);
});

test("netwerkfout: opnieuw, en na de laatste poging de fout", async () => {
  const a = answers(new Error("reset"), 200);
  assert.equal((await fetchRetry("https://x", {}, { fetchFn: a.fetchFn, sleep: async () => {} })).status, 200);
  const b = answers(new Error("reset"), new Error("reset"));
  await assert.rejects(fetchRetry("https://x", {}, { retries: 1, fetchFn: b.fetchFn, sleep: async () => {} }), /reset/);
});

test("mapLimit: nooit meer dan het maximum tegelijk, volgorde blijft", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    peak = Math.max(peak, ++running);
    await new Promise((r) => setTimeout(r, 5));
    running--;
    return n * 2;
  });
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14]);
  assert.equal(peak, 3);
});
