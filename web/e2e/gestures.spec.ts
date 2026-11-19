import { expect, test } from "./fixtures";

// UX-audit november: G1 (terug sluit eerst de sheet), G2 (tik op het actieve tabblad) en K1 ("Toon meer" onthouden)

test("terug sluit eerst de filtersheet en blijft op dezelfde pagina (G1)", async ({ page }) => {
  await page.goto("/zoeken?waar=Texel&lat=53.07&lng=4.8");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  const url = page.url();
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  // De sheet zet zijn stap een tik na het openen
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vrijstaanSheet))).toBe(true);
  await page.goBack();
  await expect(sheet).toBeHidden();
  expect(page.url()).toBe(url);
});

test("sluiten met × haalt de stap weg: daarna gaat terug naar de vorige pagina (G1)", async ({ page }) => {
  await page.goto("/veelgestelde-vragen");
  await page.goto("/zoeken");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vrijstaanSheet))).toBe(true);
  await sheet.getByRole("button", { name: "Sluiten" }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => page.evaluate(() => Boolean(history.state?.vrijstaanSheet))).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/veelgestelde-vragen$/);
});

test("filters toepassen houdt de nieuwe filters vast (G1)", async ({ page }) => {
  await page.goto("/zoeken");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByRole("button", { name: /^Water/ }).first().click();
  await sheet.getByRole("button", { name: /^Toon .*plek/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/v=[^&]*water/);
  // Even wachten: een late terugstap zou het adres nog kunnen terugzetten
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/v=[^&]*water/);
});

test("tik op het actieve tabblad Zoeken: naar boven, daarna in het zoekvak (G2)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "De tabbalk staat alleen op de telefoon");
  await page.goto("/zoeken");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
  const tab = page.getByRole("navigation", { name: "Hoofdmenu" }).getByRole("link", { name: "Zoeken" });
  await tab.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
  await tab.click();
  await expect(page.getByRole("combobox", { name: "Waar wil je staan?" })).toBeFocused();
  await expect(page).toHaveURL(/\/zoeken$/);
});

test("terug van een plek: evenveel plekken als je had opengeklapt (K1)", async ({ page }) => {
  await page.goto("/zoeken");
  // Alleen zichtbare kaarten: Next houdt de plekpagina na terug nog verborgen in het geheugen
  const cards = page.locator("article[data-slug]:visible");
  await expect(cards.first()).toBeVisible();
  await page.getByRole("button", { name: "Toon meer plekken" }).click();
  await expect(cards).toHaveCount(40);
  await cards.nth(30).locator('a[href^="/plek/"]').first().click();
  await expect(page).toHaveURL(/\/plek\//);
  await page.goBack();
  await expect(page).toHaveURL(/\/zoeken/);
  await expect(cards).toHaveCount(40);
  // Ook als de pagina opnieuw laadt (app op de achtergrond, weinig geheugen): het aantal komt uit deze sessie
  await page.reload();
  await expect(cards).toHaveCount(40);
});
