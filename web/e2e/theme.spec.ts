import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Licht en donker (lib/theme.ts): standaard het systeem, live; de zon/maan-knop zet een afwijkende keuze vast.

const theme = (page: Page) => page.locator("html").getAttribute("data-theme");
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("vrijstaan:thema"));

test("volgt het systeem, ook als dat wisselt zonder herladen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await theme(page)).toBe("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // De tokens volgen het attribuut
  await expect(page.locator("body")).toHaveCSS("color-scheme", "dark");
});

test("zon/maan-knop wisselt, onthoudt een afwijkende keuze en volgt daarna weer het systeem", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const button = page.getByTestId("theme-button");
  await expect(button).toHaveAttribute("aria-pressed", "false");

  await button.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  expect(await stored(page)).toBe("dark");

  // Blijft na herladen, al vóór de eerste weergave (geen lichte flits): het script in <head> zet het attribuut
  await page.reload();
  expect(await theme(page)).toBe("dark");
  // Een eigen keuze wint van een systeemwissel
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(100);
  expect(await theme(page)).toBe("dark");

  // Terug naar het systeemthema: geen keuze meer bewaard
  await page.getByTestId("theme-button").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await stored(page)).toBeNull();
});

test("de kaart wisselt mee zonder herladen", async ({ page, isMobile }) => {
  test.skip(isMobile, "op de telefoon staat de kaart op Zoeken achter een knop");
  // Kaartstijlen nagemaakt (geen netwerk in de test); we tellen welke stijl de kaart opvraagt
  const styles: string[] = [];
  await page.route("https://tiles.openfreemap.org/styles/*", (route) => {
    styles.push(route.request().url().split("/").pop() ?? "");
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#ffffff" } }] }),
    });
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/zoeken");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect.poll(() => styles).toEqual(["positron"]);

  await page.getByTestId("theme-button").click();
  await expect.poll(() => styles).toEqual(["positron", "dark"]);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(1);
  await expect(page.getByText("De kaart kon niet worden geladen")).toHaveCount(0);
});
