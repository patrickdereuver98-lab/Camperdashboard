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

  test("telefoon: kop met Bewaren en menu, geen springlinks, één vaste Route openen", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "Kop en vaste balk zijn voor de telefoon");
    const place = PRERENDERED[0];
    await page.goto(`/plek/${place.slug}`);
    // Kop (V3): terug, Bewaren en ⋯; Plek aanmelden en Inloggen staan in het menu, met Delen
    await expect(page.getByRole("button", { name: `${place.name} bewaren in Mijn reis` })).toBeVisible();
    await expect(page.locator("header").first().getByRole("link", { name: "Plek aanmelden", exact: true })).toBeHidden();
    await page.getByTestId("menu-button").click();
    await expect(page.getByTestId("menu-share")).toBeVisible();
    await expect(page.locator("#meer-menu").getByRole("link", { name: "Plek aanmelden" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Geen actierij met vier tegels en geen springlinks meer (V2, D9)
    await expect(page.getByRole("button", { name: "Bewaar", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Onderdelen van deze plek" })).toHaveCount(0);
    // Eén hoofdactie in de vaste balk; de prijs staat daar pas als het beslisblok uit beeld is (K4)
    const bar = page.getByTestId("sticky-route");
    await expect(bar.getByRole("button", { name: "Route openen" })).toBeVisible();
    await expect(page.getByTestId("sticky-price")).toBeHidden();
    await page.getByRole("heading", { name: "Voorzieningen" }).scrollIntoViewIfNeeded();
    await expect(page.getByTestId("sticky-price")).toBeVisible();
    // De naam van de plek staat dan in de kop
    await expect(page.getByTestId("header-place-name")).toHaveCSS("opacity", "1");
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
