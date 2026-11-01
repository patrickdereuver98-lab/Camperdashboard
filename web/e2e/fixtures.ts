import { test as base, expect } from "@playwright/test";
import snapshot from "../src/data/snapshot.json";
import { rankForPrerender } from "../src/lib/prerender";

type SnapPlace = { slug: string; name: string; town: string; completeness: number; ratingCount?: number; ratingAvg?: number; imageUrl?: string };
export const PLACES = (snapshot as unknown as { places: SnapPlace[] }).places;
const top = new Set(rankForPrerender(PLACES).map((p) => p.slug));
export const PRERENDERED = PLACES.filter((p) => top.has(p.slug));
export const ON_DEMAND = PLACES.filter((p) => !top.has(p.slug));

/** Faalt de test bij onafgevangen JavaScript-fouten in de pagina */
export const test = base.extend<{ pageErrors: Error[]; welcomeSeen: boolean; welcome: void }>({
  // De welkomstuitleg op de startpagina staat standaard als gezien, zodat hij andere tests niet in de weg zit.
  // e2e/onboarding.spec.ts zet dit uit met test.use({ welcomeSeen: false }).
  welcomeSeen: [true, { option: true }],
  welcome: [
    async ({ page, welcomeSeen }, use) => {
      if (welcomeSeen)
        await page.addInitScript(() => {
          try {
            localStorage.setItem("vrijstaan:welkom", JSON.stringify("e2e"));
          } catch {
            /* geen opslag */
          }
        });
      await use();
    },
    { auto: true },
  ],
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on("pageerror", (e) => errors.push(e));
      await use(errors);
      expect(errors.map((e) => e.message), "geen JavaScript-fouten in de pagina").toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };
