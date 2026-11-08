import { expect, test } from "./fixtures";

test("zoekpagina toont resultaten zonder JavaScript-fouten", async ({ page, isMobile }) => {
  await page.goto("/zoeken");
  await expect(page.locator('a[href^="/plek/"]').first()).toBeVisible();
  // Op desktop staat de kaart naast de lijst (op mobiel pas na "Kaart")
  if (!isMobile) {
    await expect(page.getByText(/Kaart laden|kon niet worden geladen/).or(page.locator(".maplibregl-canvas")).first()).toBeAttached();
  }
});

test("resultaten: hartje noemt de plek en rijen zijn even hoog (R55)", async ({ page }) => {
  await page.goto("/zoeken");
  const first = page.locator("article[data-slug]").first();
  await expect(first).toBeVisible();
  const name = (await first.locator("h3").innerText()).trim();
  await expect(first.getByRole("button", { name: `${name} bewaren in Mijn reis` })).toHaveAttribute("aria-pressed", "false");
  const heights = await page.locator("article[data-slug]").evaluateAll((els) => els.slice(0, 10).map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights).size, `rijhoogtes: ${heights.join(", ")}`).toBe(1);
});
