import { expect, test } from "./fixtures";
import { encodeSummaries } from "../src/lib/summary-wire";
import type { PlaceSummary } from "../src/lib/types";

test("Mijn reis rekent prijs per persoon en toeristenbelasting van de plek mee, en noemt andere toeslagen", async ({ page, request }) => {
  const all = (await (await request.get("/api/places")).json()) as { slug: string; name: string; priceEur?: number; priceExtras?: unknown }[];
  const [a, b] = all.filter((p) => p.priceEur !== undefined && p.priceEur > 0).slice(0, 2);
  const c = all.find((p) => p.priceEur === undefined)!;
  // Plek a: basisprijs + toeristenbelasting p.p.p.n. + hond; plek c: alleen prijs per persoon
  const patched = all.map((p) =>
    p.slug === a.slug
      ? { ...p, priceEur: 20, touristTaxIncluded: undefined, priceExtras: [{ label: "Toeristenbelasting", amount: 2, unit: "per persoon per nacht" }, { label: "Hond", amount: 3, unit: "per nacht" }] }
      : p.slug === c.slug
        ? { ...p, priceExtras: [{ label: "Per persoon", amount: 6, unit: "per persoon per nacht" }] }
        : p.slug === b.slug
          ? { ...p, priceEur: 10, touristTaxIncluded: true, priceExtras: [] }
          : p,
  );
  // De browser haalt het compacte formaat op (lib/summary-wire.ts)
  await page.route("**/api/places?f=compact", (r) => r.fulfill({ json: encodeSummaries(patched as unknown as PlaceSummary[]) }));
  await page.addInitScript(
    ([x, y, z]) => {
      localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: x, nights: 2 }, { slug: y, nights: 1 }, { slug: z, nights: 3 }]));
      localStorage.setItem("vrijstaan:reisinstellingen", JSON.stringify({ litersPer100: 11, fuelPrice: 1.85, persons: 2, touristTax: 1.5 }));
    },
    [a.slug, b.slug, c.slug],
  );
  await page.goto("/mijn-reis");
  // Overnachtingen: 20×2 + 10×1 + 6×2×3 = 86. Belasting: a bekend 2×2×2 = 8, c geschat 2×1,5×3 = 9, b zit in de prijs → 17
  const overview = page.locator("div", { has: page.getByRole("heading", { name: "Overzicht" }) }).first();
  await expect(overview.locator("dd").nth(1)).toContainText("€ 86");
  await expect(overview.locator("dd").nth(3)).toContainText("€ 17");
  const extras = page.getByTestId("surcharges");
  await expect(extras).toContainText(`${a.name}:`);
  await expect(extras).toContainText("hond € 3 per nacht");
  await expect(extras).not.toContainText(c.name);
});

test("totaal in Mijn reis noemt plekken zonder bekende prijs in het bedrag zelf", async ({ page, request }) => {
  const all = (await (await request.get("/api/places")).json()) as { slug: string; priceEur?: number; priceExtras?: unknown }[];
  const known = all.find((p) => p.priceEur !== undefined && p.priceEur > 0)!;
  const [u1, u2] = all.filter((p) => p.priceEur === undefined).slice(0, 2);
  // Geen prijs per persoon bij de onbekende plekken, dan blijft hun prijs echt onbekend
  const patched = all.map((p) => (p.slug === u1.slug || p.slug === u2.slug ? { ...p, priceExtras: [] } : p));
  // De browser haalt het compacte formaat op (lib/summary-wire.ts)
  await page.route("**/api/places?f=compact", (r) => r.fulfill({ json: encodeSummaries(patched as unknown as PlaceSummary[]) }));
  await page.addInitScript(
    ([x, y, z]) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: x, nights: 1 }, { slug: y, nights: 1 }, { slug: z, nights: 1 }])),
    [known.slug, u1.slug, u2.slug],
  );
  await page.goto("/mijn-reis");
  await expect(page.getByTestId("trip-total")).toContainText("+ 2 onbekend");
});
