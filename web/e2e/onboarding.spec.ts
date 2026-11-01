import { expect, test } from "./fixtures";

// Frictieloze onboarding: drie schermen voor een nieuwe bezoeker, daarna nooit meer
test.describe("welkomstuitleg", () => {
  test.use({ welcomeSeen: false });

  test("een nieuwe bezoeker ziet drie schermen, daarna niet meer", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("dialog", { name: "Welkom bij VrijStaan" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Geen lappen tekst, alleen feiten");

    await dialog.getByRole("button", { name: "Volgende" }).click();
    await expect(page.getByRole("dialog", { name: "Actueel, met jouw hulp" })).toBeVisible();
    await page.getByRole("button", { name: "Volgende" }).click();
    const last = page.getByRole("dialog", { name: "Sneller op je plek" });
    await expect(last).toBeVisible();
    await last.getByRole("button", { name: "Aan de slag" }).click();
    await expect(page.getByRole("dialog", { name: /VrijStaan|actueel|plek/i })).toHaveCount(0);

    expect(await page.evaluate(() => localStorage.getItem("vrijstaan:welkom"))).toBeTruthy();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Waar sta je");
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog", { name: "Welkom bij VrijStaan" })).toHaveCount(0);
  });

  test("de cookiebalk wacht tot de uitleg weg is", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: "Welkom bij VrijStaan" })).toBeVisible();
    await expect(page.getByText("Mogen we bezoek tellen")).toHaveCount(0);
    await page.getByRole("button", { name: "Overslaan" }).click();
    await expect(page.getByText("Mogen we bezoek tellen")).toBeVisible();
  });

  test("op een andere pagina staat de cookiebalk er meteen", async ({ page }) => {
    await page.goto("/zoeken");
    await expect(page.getByText("Mogen we bezoek tellen")).toBeVisible();
  });

  test("overslaan en Escape tellen ook als gezien", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Welkom bij VrijStaan" }).getByRole("button", { name: "Overslaan" }).click();
    await expect(page.getByRole("dialog", { name: "Welkom bij VrijStaan" })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("vrijstaan:welkom"))).toBeTruthy();
  });

  test("wie al een cookiekeuze had, krijgt hem niet", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("vrijstaan:toestemming", JSON.stringify({ id: "e2e", analytics: false, version: "2026-10", at: "2026-10-01T00:00:00Z" })),
    );
    await page.goto("/");
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog", { name: "Welkom bij VrijStaan" })).toHaveCount(0);
  });

  test("niet op andere pagina's (bezoekers via Google landen direct op de plek)", async ({ page }) => {
    await page.goto("/zoeken");
    await page.waitForTimeout(800);
    await expect(page.getByRole("dialog", { name: "Welkom bij VrijStaan" })).toHaveCount(0);
  });
});
