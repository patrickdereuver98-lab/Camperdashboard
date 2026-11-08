// Terugval op de snapshot (R25/TS-01 en DATA-11): drukte en time-outs zijn een storing, andere 4xx niet.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { fetchWithRetry, isOutageStatus, SupabaseError, withFallback, withFallbackSource } from "../src/lib/fallback.ts";

const quiet = <T>(fn: () => Promise<T>) => {
  const orig = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = orig;
  });
};

test("408, 425, 429 en 5xx zijn een storing; 400, 401, 404 niet", () => {
  for (const s of [408, 425, 429, 500, 502, 503, 504]) assert.equal(isOutageStatus(s), true, String(s));
  for (const s of [400, 401, 403, 404, 406, 416]) assert.equal(isOutageStatus(s), false, String(s));
});

test("withFallback: bij 408, 425 en 429 de snapshot, met fromSnapshot", async () => {
  for (const status of [408, 425, 429, 503]) {
    const r = await quiet(() =>
      withFallbackSource(
        async () => {
          throw new SupabaseError(status, "druk");
        },
        () => "snapshot",
      ),
    );
    assert.deepEqual(r, { value: "snapshot", fromSnapshot: true });
  }
});

test("withFallback: geen verbinding of time-out: snapshot", async () => {
  const r = await quiet(() =>
    withFallbackSource(
      async () => {
        throw new TypeError("fetch failed");
      },
      () => 1,
    ),
  );
  assert.deepEqual(r, { value: 1, fromSnapshot: true });
});

test("withFallback: een fout in de query (400, 404) gaat door, geen stille snapshot", async () => {
  for (const status of [400, 404]) {
    await quiet(() =>
      assert.rejects(
        withFallback(
          async () => {
            throw new SupabaseError(status, "kolom bestaat niet");
          },
          () => "snapshot",
        ),
        SupabaseError,
      ),
    );
  }
});

test("withFallback: live gaat voor, offline build gebruikt de snapshot", async () => {
  assert.deepEqual(await withFallbackSource(async () => "live", () => "snapshot"), { value: "live", fromSnapshot: false });
  assert.deepEqual(await withFallbackSource(async () => "live", () => "snapshot", true), { value: "snapshot", fromSnapshot: true });
});

test("fetchWithRetry: één keer opnieuw bij 429 en 408, niet bij 404", async () => {
  for (const [status, calls] of [
    [429, 2],
    [408, 2],
    [404, 1],
  ] as const) {
    let n = 0;
    const fake = (async () => {
      n++;
      return new Response("x", { status });
    }) as typeof fetch;
    const res = await fetchWithRetry("https://voorbeeld.invalid", {}, 1, fake);
    assert.equal(res.status, status);
    assert.equal(n, calls, `status ${status}`);
  }
});
