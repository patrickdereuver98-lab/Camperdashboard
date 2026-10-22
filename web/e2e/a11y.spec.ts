import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, PLACES, PRERENDERED, test } from "./fixtures";

// WCAG 2.1 AA (lanceervoorwaarde in de PRD): geautomatiseerde controle op de hoofdpagina's, in licht en donker.
// Daarnaast twee huisregels die axe niet meet (docs/stijlgids.md §2, §4, §5): tekst minstens 14 px en tikdoelen
// minstens 44 × 44 px. Enige uitzondering: de kaartbronvermelding van MapLibre (12 px, stijlgids §4).

const PLACE = `/plek/${PRERENDERED[0].slug}`;
const PAGES = [
  "/",
  "/zoeken",
  "/zonder-vertrektijd",
  "/dichtbij",
  "/mijn-reis",
  PLACE,
  "/plek-aanmelden",
  "/melden",
  "/contact",
  "/inloggen",
  "/veelgestelde-vragen",
  "/toegankelijkheid",
  "/camperplaatsen/gelderland",
];

/** Cookiekeuze en een reis met twee stops vooraf invullen, zodat ook die onderdelen gemeten worden */
async function prepare(page: Page, { consent = true, trip = true } = {}) {
  await page.addInitScript(
    ([consent, stops]) => {
      try {
        if (consent)
          localStorage.setItem(
            "vrijstaan:toestemming",
            JSON.stringify({ id: "e2e", analytics: false, version: "2026-10", at: new Date().toISOString() }),
          );
        if (stops.length) localStorage.setItem("vrijstaan:reis", JSON.stringify(stops.map((slug) => ({ slug, nights: 1 }))));
      } catch {
        /* geen opslag */
      }
    },
    [consent, trip ? [PLACES[0].slug, PLACES[1].slug] : []] as const,
  );
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  // Animaties (opkomende kaarten) afwachten, anders meet axe het contrast halverwege een fade
  await page.waitForTimeout(600);
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // De kaart is een canvas van MapLibre; de inhoud staat ook in de lijst (zie /toegankelijkheid)
    .exclude(".maplibregl-canvas-container")
    .analyze();
  return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join(" | ")}`);
}

/** Tekst onder 14 px en tikdoelen onder 44 × 44 px binnen `scope` */
async function houseRules(page: Page, scope = "body") {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope) ?? document.body;
    const out: string[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    };
    const label = (el: Element) =>
      `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      if (!visible(el) || el.closest(".maplibregl-ctrl-attrib, .sr-only, .sr-only-focusable, script, style, noscript")) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 14) out.push(`tekst ${size}px: ${label(el)}`);
    }
    // Alles wat je kunt aantikken, behalve links midden in lopende tekst (WCAG 2.5.5: "inline")
    const targets = root.querySelectorAll<HTMLElement>(
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"]',
    );
    for (const el of targets) {
      if (!visible(el) || el.closest("[inert], [aria-hidden='true'], details:not([open]) > :not(summary)")) continue;
      // "Naar de inhoud" is alleen zichtbaar met focus
      if (el.matches(".sr-only-focusable:not(:focus)")) continue;
      if (el.matches("a") && getComputedStyle(el).display === "inline" && el.closest("p, li, dd, td, figcaption")) continue;
      // Link over de hele kaart (after:absolute inset-0): de kaart is het tikdoel
      const after = getComputedStyle(el, "::after");
      if (el.matches("a") && after.position === "absolute" && after.content !== "none") continue;
      // Een vinkje, rondje of keuzelijst in een label: het label is het tikdoel
      const hit = el.matches("input[type=checkbox], input[type=radio], select") ? (el.closest("label") ?? el) : el;
      const r = hit.getBoundingClientRect();
      if (Math.round(r.height) < 44 || Math.round(r.width) < 44) out.push(`tikdoel ${Math.round(r.width)}×${Math.round(r.height)}: ${label(el)}`);
    }
    return out;
  }, scope);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    for (const path of PAGES) {
      test(`geen WCAG 2.1 AA-fouten op ${path}`, async ({ page }) => {
        await prepare(page, { consent: false });
        await page.goto(path);
        await settle(page);
        expect(await axe(page)).toEqual([]);
      });
    }

    test("geen WCAG 2.1 AA-fouten in de filtersheet", async ({ page }) => {
      await prepare(page);
      await page.goto("/zoeken");
      await page.getByRole("button", { name: /^Filters/ }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(500);
      expect(await axe(page)).toEqual([]);
    });
  });
}

test.describe("huisregels: tekst ≥ 14 px, tikdoelen ≥ 44 px", () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await prepare(page);
      await page.goto(path);
      await settle(page);
      expect(await houseRules(page)).toEqual([]);
    });
  }

  test("cookiebanner", async ({ page }) => {
    await prepare(page, { consent: false });
    await page.goto("/");
    await page.getByRole("button", { name: "Zelf instellen" }).click();
    expect(await houseRules(page, '[aria-labelledby="cookie-titel"]')).toEqual([]);
  });

  for (const [name, path, opener] of [
    ["filtersheet", "/zoeken", /^Filters/],
    ["uitleg icoontjes", "/zoeken", /icoontjes/i],
    ["review schrijven", PLACE, /Schrijf een review/],
  ] as const) {
    test(name, async ({ page }) => {
      await prepare(page);
      await page.goto(path);
      await page.getByRole("button", { name: opener }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.waitForTimeout(500);
      expect(await houseRules(page, '[role="dialog"]')).toEqual([]);
    });
  }
});

test("sheet: focus blijft binnen, Escape sluit en geeft de focus terug", async ({ page }) => {
  await prepare(page);
  await page.goto("/zoeken");
  const opener = page.getByRole("button", { name: /^Filters/ }).first();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    expect(await inside()).toBe(true);
  }
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await inside()).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("sheet: een keuze maken verplaatst de focus niet", async ({ page }) => {
  await prepare(page);
  await page.goto(PLACE);
  await page.getByRole("button", { name: /Schrijf een review/ }).click();
  const seven = page.getByRole("dialog").getByRole("button", { name: "7", exact: true }).first();
  await seven.focus();
  await page.keyboard.press("Enter");
  await expect(seven).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(200);
  await expect(seven).toBeFocused();
});
