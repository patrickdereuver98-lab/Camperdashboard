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
  // Een lange naam loopt door naar een tweede regel in plaats van af te kappen (tekstcheck 27 november 2026); rijen met
  // evenveel regels in de naam zijn even hoog
  const rows = await page.locator("article[data-slug]").evaluateAll((els) =>
    els.slice(0, 10).map((e) => {
      const h3 = e.querySelector("h3")!;
      const lines = Math.round(h3.getBoundingClientRect().height / parseFloat(getComputedStyle(h3).lineHeight));
      return { lines, h: Math.round(e.getBoundingClientRect().height) };
    }),
  );
  for (const n of new Set(rows.map((r) => r.lines))) {
    const hs = rows.filter((r) => r.lines === n).map((r) => r.h);
    expect(new Set(hs).size, `rijhoogtes bij ${n} regel(s): ${hs.join(", ")}`).toBe(1);
  }
  // En geen enkele naam afgekapt
  const cut = await page.locator("article[data-slug] h3").evaluateAll((els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).length);
  expect(cut).toBe(0);
});
