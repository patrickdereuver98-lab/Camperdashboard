import { expect, ON_DEMAND, PRERENDERED, test } from "./fixtures";

test.describe("detailpagina", () => {
  for (const [label, place] of [["geprerenderd", PRERENDERED[0]], ["on-demand", ON_DEMAND[0]], ["on-demand", ON_DEMAND[ON_DEMAND.length - 1]]] as const) {
    test(`${label}: toont ${place.slug}`, async ({ page }) => {
      const res = await page.goto(`/plek/${place.slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(place.name);
      await expect(page.getByRole("heading", { name: "Voorzieningen" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "In de buurt" })).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(place.town));
    });
  }

  test("telefoon: actierij onder de naam en springlinks die blijven plakken", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Actierij en springlinks staan alleen op de telefoon");
    const place = PRERENDERED[0];
    await page.goto(`/plek/${place.slug}`);
    await expect(page.getByRole("button", { name: "Bewaar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delen" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Onderdelen van deze plek" });
    await expect(nav.getByRole("link", { name: "Overzicht" })).toHaveAttribute("aria-current", "location");
    await nav.getByRole("link", { name: "Voorzieningen" }).click();
    await expect(page.getByRole("heading", { name: "Voorzieningen" })).toBeInViewport();
    // De rij blijft onder de header staan en zegt waar je bent
    await expect(nav).toBeInViewport();
    await expect(nav.getByRole("link", { name: "Voorzieningen" })).toHaveAttribute("aria-current", "location");
    // Eén hoofdactie in de vaste balk
    await expect(page.getByRole("button", { name: "Route", exact: true })).toBeVisible();
  });

  test("onbekende plek geeft een 404-pagina", async ({ page }) => {
    const res = await page.goto("/plek/deze-plek-bestaat-echt-niet");
    // Bij een gestreamde (PPR) eerste render kan de status al 200 zijn; zoekmachines krijgen dan noindex
    expect([200, 404]).toContain(res?.status());
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
    // De 404-pagina (src/app/not-found.tsx)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Deze pagina bestaat niet meer");
    await expect(page.locator('main a[href="/zoeken"]')).toBeVisible();
  });
});
