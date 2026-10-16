import { expect, test } from "@playwright/test";

type P = { slug: string; lat: number; lng: number };

test.describe("/api/places?bbox (PostGIS bounding box)", () => {
  test("geeft alleen plekken binnen het gebied", async ({ request }) => {
    const all = (await (await request.get("/api/places")).json()) as P[];
    const res = await request.get("/api/places?bbox=4.75,51.75,5.75,52.5");
    expect(res.ok()).toBe(true);
    expect(res.headers()["cache-control"]).toContain("s-maxage=");
    const some = (await res.json()) as P[];
    expect(some.length).toBeGreaterThan(0);
    expect(some.length).toBeLessThan(all.length);
    for (const p of some) {
      expect(p.lng).toBeGreaterThanOrEqual(4.75);
      expect(p.lng).toBeLessThanOrEqual(5.75);
      expect(p.lat).toBeGreaterThanOrEqual(51.75);
      expect(p.lat).toBeLessThanOrEqual(52.5);
    }
    const expected = all.filter((p) => p.lng >= 4.75 && p.lng <= 5.75 && p.lat >= 51.75 && p.lat <= 52.5);
    expect(some.map((p) => p.slug).sort()).toEqual(expected.map((p) => p.slug).sort());
  });

  test("stuurt een niet-afgeronde bbox door naar de rastervariant (gedeelde cache)", async ({ request }) => {
    const res = await request.get("/api/places?bbox=4.81,51.93,5.61,52.27", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toContain("bbox=4.75%2C51.75%2C5.75%2C52.5");
  });

  test("weigert een ongeldige bbox", async ({ request }) => {
    const res = await request.get("/api/places?bbox=5,52,4,53");
    expect(res.status()).toBe(400);
  });
});
