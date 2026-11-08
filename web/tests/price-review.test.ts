// Beheer, Plekken: verdachte prijzen (R47) en de site-cache verversen na opslaan.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { revalidatePlaces, suspiciousRows, type PriceRow } from "../src/app/admin/plekken/price-review.ts";

const row = (o: Partial<PriceRow>): PriceRow => ({ id: o.name ?? "x", name: "Plek", town: null, kind: "camperplaats", price_eur: 10, price_note: null, ...o });

test("suspiciousRows: lage campingprijs en grote vanaf-spreiding, laagste prijs eerst; de rest niet", () => {
  const rows = suspiciousRows([
    row({ name: "Camping De Wijde Blick", kind: "camping", price_eur: 5 }),
    row({ name: "Camperplaats Haven", price_eur: 5 }),
    row({ name: "Park Zee", kind: "camperplaats", price_eur: 6, price_note: "vanaf € 6,00 per nacht; hoogste genoemde tarief € 30,00" }),
    row({ name: "Vakantiepark Weltevreden", price_eur: 6.5 }),
    row({ name: "Camping Duur", kind: "camping", price_eur: 25 }),
    row({ name: "Onbekend", kind: "camping", price_eur: null }),
  ]);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Camping De Wijde Blick", "Park Zee", "Vakantiepark Weltevreden"],
  );
  assert.match(rows[0].reason, /onder € 8/);
  assert.match(rows[1].reason, /vanaf-prijs/);
});

test("revalidatePlaces: POST met Bearer-token en tag places", async () => {
  const calls: [string, RequestInit][] = [];
  await revalidatePlaces("abc", (async (url: string, init: RequestInit) => {
    calls.push([url, init]);
    return new Response(null, { status: 204 });
  }) as typeof fetch);
  assert.equal(calls.length, 1);
  const [url, init] = calls[0];
  assert.equal(url, "/api/revalidate");
  assert.equal(init.method, "POST");
  assert.deepEqual(init.headers, { Authorization: "Bearer abc", "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(String(init.body)), { tags: ["places"] });
});

test("revalidatePlaces: zonder token niets, en een fout breekt niets", async () => {
  let called = false;
  await revalidatePlaces(undefined, (async () => {
    called = true;
    return new Response();
  }) as typeof fetch);
  assert.equal(called, false);
  await revalidatePlaces("abc", (async () => {
    throw new Error("netwerk");
  }) as typeof fetch);
});
