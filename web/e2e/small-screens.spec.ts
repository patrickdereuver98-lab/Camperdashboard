import type { Page } from "@playwright/test";
import { expect, PRERENDERED, test } from "./fixtures";

// Kleine schermen (review november R27): de pagina mag op 320, 360, 390 en 820 px niet horizontaal schuiven, Inloggen
// blijft in de kop en "Nee" in de cookiebalk is net zo goed te zien als "Ja" (weigeren even makkelijk als toestaan).
// Alleen in het desktopproject: de breedte zetten we hier zelf.

const WIDTHS = [320, 360, 390, 820];
const PAGES = ["/", "/zoeken", `/plek/${PRERENDERED[0].slug}`, "/mijn-reis", "/plek-aanmelden"];

async function overflow(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    // Elementen die buiten de rechterrand steken (niet binnen een eigen schuifstrook), voor een leesbare foutmelding
    const inScroller = (el: Element) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    const out = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1 && !inScroller(el) && getComputedStyle(el).position !== "fixed")
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
    return { scroll: root.scrollWidth, client: root.clientWidth, body: document.body.scrollWidth, out };
  });
}

test.describe("kleine schermen", () => {
  test.skip(({ isMobile }) => isMobile, "breedtes worden hier zelf gezet");

  for (const width of WIDTHS) {
    test(`${width} px: geen horizontaal schuiven, kop compleet`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const m = await overflow(page);
        expect(m.scroll, `${path} op ${width} px schuift: ${m.out.join(", ")}`).toBeLessThanOrEqual(m.client);
        expect(m.body, `${path} op ${width} px: body breder dan het scherm`).toBeLessThanOrEqual(m.client);

        // Inloggen en de themaknop staan helemaal in beeld
        for (const id of ["account-button", "theme-button"]) {
          const box = await page.getByTestId(id).boundingBox();
          expect(box, `${id} op ${path}`).not.toBeNull();
          expect(box!.x, `${id} links op ${path}`).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width, `${id} valt rechts weg op ${path} (${width} px)`).toBeLessThanOrEqual(width);
        }
      }
    });
  }

  test("820 px (tablet): tabbalk onderaan, geen desktopmenu in de kop", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.goto("/zoeken");
    await expect(page.locator("header nav[aria-label=Hoofdmenu]")).toBeHidden();
    await expect(page.locator("body > nav[aria-label=Hoofdmenu], nav.fixed[aria-label=Hoofdmenu]").first()).toBeVisible();
  });

  for (const width of [320, 360, 390]) {
    test(`${width} px: cookiebalk met Ja en Nee even groot en helemaal in beeld`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/zoeken");
      const banner = page.getByRole("dialog", { name: /Mogen we bezoek tellen/ });
      await expect(banner).toBeVisible();
      const yes = await banner.getByRole("button", { name: "Ja, tel mijn bezoek" }).boundingBox();
      const no = await banner.getByRole("button", { name: "Nee, alleen wat nodig is" }).boundingBox();
      expect(yes && no).toBeTruthy();
      expect(no!.x + no!.width).toBeLessThanOrEqual(width);
      expect(no!.x).toBeGreaterThanOrEqual(0);
      expect(Math.abs(no!.width - yes!.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(no!.height - yes!.height)).toBeLessThanOrEqual(2);
      const m = await overflow(page);
      expect(m.scroll).toBeLessThanOrEqual(m.client);
    });
  }

  test("cookiebalk staat vroeg in de tabvolgorde, direct na de kop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/zoeken");
    await expect(page.getByRole("dialog", { name: /Mogen we bezoek tellen/ })).toBeVisible();
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => !!document.activeElement?.closest("[aria-labelledby=cookie-titel]"));
    }
    expect(reached, "cookiebalk niet binnen 12 tabs bereikt").toBe(true);
  });
});
