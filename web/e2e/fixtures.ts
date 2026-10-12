import { test as base, expect } from "@playwright/test";
import snapshot from "../src/data/snapshot.json";

type SnapPlace = { slug: string; name: string; town: string };
export const PLACES = (snapshot as unknown as { places: SnapPlace[] }).places;

/** Faalt de test bij onafgevangen JavaScript-fouten in de pagina */
export const test = base.extend<{ pageErrors: Error[] }>({
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
