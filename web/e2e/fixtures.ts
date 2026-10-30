import { test as base, expect } from "@playwright/test";
import snapshot from "../src/data/snapshot.json";
import { rankForPrerender } from "../src/lib/prerender";

type SnapPlace = { slug: string; name: string; town: string; completeness: number; ratingCount?: number; ratingAvg?: number; imageUrl?: string };
export const PLACES = (snapshot as unknown as { places: SnapPlace[] }).places;
const top = new Set(rankForPrerender(PLACES).map((p) => p.slug));
export const PRERENDERED = PLACES.filter((p) => top.has(p.slug));
export const ON_DEMAND = PLACES.filter((p) => !top.has(p.slug));

/** Faalt de test bij onafgevangen JavaScript-fouten in de pagina */
export const test = base.extend<{ pageErrors: Error[]; fixedTheme: void }>({
  // De avondmodus (lib/theme.ts) volgt de zon; tests leggen het thema vast op het kleurschema van de test,
  // zodat een test in licht 's avonds niet donker draait
  fixedTheme: [
    async ({ page, colorScheme }, use) => {
      await page.addInitScript((choice) => {
        try {
          if (!localStorage.getItem("vrijstaan:thema")) localStorage.setItem("vrijstaan:thema", choice);
        } catch {}
      }, colorScheme === "dark" ? "donker" : "licht");
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
