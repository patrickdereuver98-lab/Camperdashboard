import { expect, test } from "./fixtures";

test("zoekpagina toont resultaten zonder JavaScript-fouten", async ({ page, isMobile }) => {
  await page.goto("/zoeken");
  await expect(page.locator('a[href^="/plek/"]').first()).toBeVisible();
  // Op desktop staat de kaart naast de lijst (op mobiel pas na "Kaart")
  if (!isMobile) {
    await expect(page.getByText(/Kaart laden|kon niet worden geladen/).or(page.locator(".maplibregl-canvas")).first()).toBeAttached();
  }
});
