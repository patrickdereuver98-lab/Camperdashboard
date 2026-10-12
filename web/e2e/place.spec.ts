import { expect, PLACES, test } from "./fixtures";

test.describe("detailpagina", () => {
  for (const place of [PLACES[0], PLACES[PLACES.length - 1]]) {
    test(`toont ${place.slug}`, async ({ page }) => {
      const res = await page.goto(`/plek/${place.slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(place.name);
      await expect(page.getByRole("heading", { name: "Voorzieningen" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "In de buurt" })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(place.town));
    });
  }

  test("onbekende plek geeft een 404-pagina", async ({ page }) => {
    const res = await page.goto("/plek/deze-plek-bestaat-echt-niet");
    // Bij een gestreamde (PPR) eerste render kan de status al 200 zijn; zoekmachines krijgen dan noindex
    expect([200, 404]).toContain(res?.status());
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verkeerd afgeslagen");
  });
});
