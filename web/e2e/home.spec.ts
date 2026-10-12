import { expect, test } from "./fixtures";

test.describe("startpagina", () => {
  test("laadt met kop, zoekveld en uitgelichte plekken", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    await expect(page).toHaveTitle(/VrijStaan/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Waar sta je");
    await expect(page.getByText(/^\d[\d.]* camperplaatsen in Nederland/)).toBeVisible();

    const cards = page.locator('main a[href^="/plek/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("een uitgelichte plek opent de detailpagina", async ({ page }) => {
    await page.goto("/");
    const card = page.locator('main a[href^="/plek/"]').first();
    const href = await card.getAttribute("href");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test("API levert een lijst met plekken", async ({ request }) => {
  const res = await request.get("/api/places");
  expect(res.ok()).toBe(true);
  // CDN-cache: bij burst traffic komt de kaartdata van de edge, niet van de database
  expect(res.headers()["cache-control"]).toContain("s-maxage=");
  const body = (await res.json()) as { slug: string; lat: number; lng: number }[];
  expect(body.length).toBeGreaterThan(100);
  expect(body[0]).toEqual(expect.objectContaining({ slug: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) }));
});
