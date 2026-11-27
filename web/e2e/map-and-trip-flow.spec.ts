// Fase E4 en F2 (plan.md): lijst en kaartselectie met behoud van filters, en de volgorde van blokken en stops in Mijn reis.
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type P = { slug: string; name: string; lat: number; lng: number; departure?: string; departureCheck?: string; checkoutUntil?: string; checkinFrom?: string; checkinUntil?: string };

/** Cookiebalk weg, zodat hij het paneel en de knoppen onderaan niet afdekt */
async function consent(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vrijstaan:toestemming", JSON.stringify({ id: "e2e", analytics: false, version: "2026-10", at: new Date().toISOString() }));
    } catch {
      /* geen opslag */
    }
  });
}

/**
 * Tikt op de enige stip van de kaart. Waar hij precies ligt hangt van de zoomstand af, dus we lopen langs de middenlijn
 * van de kaart (het tikvlak is 44 px) tot het paneel verschijnt; de kaart moet dan stil liggen.
 */
async function pickStip(page: Page, panel: Locator) {
  const canvas = page.locator(".maplibregl-canvas");
  await page.waitForTimeout(1500);
  await expect(async () => {
    const box = (await canvas.boundingBox())!;
    for (let y = box.y + box.height * 0.1; y < box.y + box.height * 0.65; y += 20) {
      await page.mouse.click(box.x + box.width / 2, y);
      if (await panel.isVisible()) return;
      await page.waitForTimeout(60);
    }
    throw new Error("stip niet gevonden");
  }).toPass({ timeout: 30_000 });
  await expect(panel).toBeVisible();
}

test.describe("Zoeken: lijst, kaart en terug", () => {
  test("filters blijven staan na een plek bekijken en terug (lijst)", async ({ page }) => {
    await consent(page);
    await page.goto("/zoeken");
    await page.getByRole("button", { name: "Nu open", exact: true }).first().click();
    await expect(page).toHaveURL(/open=1/);
    await page.locator('a[href^="/plek/"]').first().click();
    await expect(page).toHaveURL(/\/plek\//);
    await page.goBack();
    await expect(page).toHaveURL(/open=1/);
    await expect(page.getByRole("button", { name: "Nu open", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('a[href^="/plek/"]').first()).toBeVisible();
  });

  test("kaartselectie: paneel met Route openen en Bekijk plek; terug behoudt de zoekopdracht", async ({ page, request, isMobile }) => {
    test.skip(!isMobile, "het kaartpaneel is er op de telefoon; op een groot scherm staat een popup op de kaart");
    await consent(page);
    const all = (await (await request.get("/api/places")).json()) as P[];
    const p = all[5];
    // Eén plek binnen 1 km: de stip ligt midden op de kaart
    await page.goto(`/zoeken?kaart=1&waar=Test&lat=${p.lat}&lng=${p.lng}&straal=1`);
    const canvas = page.locator(".maplibregl-canvas");
    await expect(canvas).toBeVisible();
    const panel = page.getByRole("region", { name: /Gekozen plek/ });
    await pickStip(page, panel);

    // Inhoud van het paneel (brief: "Gekozen plek op de kaart"): Route openen is primair, dan Bekijk plek en het hartje
    await expect(panel.getByRole("button", { name: "Route openen", exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Route", exact: true })).toHaveCount(0);
    await expect(panel.getByRole("link", { name: "Bekijk plek" })).toBeVisible();
    await expect(panel.getByRole("button", { name: /bewaren in Mijn reis/ })).toBeVisible();

    // Sluiten en opnieuw kiezen
    await panel.getByRole("button", { name: "Sluiten" }).click();
    await expect(panel).toBeHidden();
    // De kaart schuift bij het kiezen mee; opnieuw laden zet de stip weer midden in beeld
    await page.reload();
    await expect(canvas).toBeVisible();
    await pickStip(page, panel);

    // Naar de plek en terug: dezelfde zoekopdracht, kaart nog open
    await panel.getByRole("link", { name: "Bekijk plek" }).click();
    await expect(page).toHaveURL(/\/plek\//);
    await page.goBack();
    await expect(page).toHaveURL(/straal=1/);
    await expect(page).toHaveURL(/waar=Test/);
    await expect(page.getByRole("button", { name: "Lijst", exact: true })).toBeVisible();

    // Terug naar de lijst: de plek staat erin
    await page.getByRole("button", { name: "Lijst", exact: true }).click();
    await expect(page.locator('a[href^="/plek/"]').first()).toBeVisible();
  });
});

async function setupTrip(page: Page, request: APIRequestContext, patch: (i: number) => Partial<P>) {
  const all = (await (await request.get("/api/places")).json()) as P[];
  const picked = all.slice(0, 3).map((p, i) => ({ ...p, ...patch(i) }));
  const bySlug = new Map(picked.map((p) => [p.slug, p]));
  await page.route("**/api/places", (r) => r.fulfill({ json: all.map((p) => bySlug.get(p.slug) ?? p) }));
  await page.route("**/api/route?**", (r) => {
    const pts = new URL(r.request().url()).searchParams.get("p")!.split(";").map((s) => s.split(",").map(Number));
    const legs = pts.slice(1).map(() => ({ distanceM: 100000, durationS: 5400 }));
    r.fulfill({ json: { distanceM: legs.length * 100000, durationS: legs.length * 5400, legs, geometry: pts.map(([lat, lng]) => [lng, lat]), provider: "osrm", vehicleApplied: false, avoidApplied: true } });
  });
  await page.addInitScript((stops) => localStorage.setItem("vrijstaan:reis", JSON.stringify({ v: 3, stops })), picked.map((p) => ({ slug: p.slug, nights: 1 })));
  await consent(page);
  return picked;
}

test.describe("Mijn reis", () => {
  test("volgende stop staat boven de stops, de uitklappers niet; volgorde wijzigen met de knoppen", async ({ page, request }) => {
    const picked = await setupTrip(page, request, () => ({}));
    await page.goto("/mijn-reis");
    const stops = page.getByTestId("trip-stop");
    await expect(stops).toHaveCount(3);

    // Volgende stop boven de eerste stop
    const next = page.getByTestId("next-stop");
    await expect(next).toBeVisible();
    const nb = (await next.boundingBox())!;
    const fb = (await stops.first().boundingBox())!;
    expect(nb.y + nb.height).toBeLessThanOrEqual(fb.y);
    // Route openen, niet "Route"
    await expect(next.getByRole("button", { name: "Route openen", exact: true })).toBeVisible();
    await expect(next.getByRole("button", { name: "Route", exact: true })).toHaveCount(0);

    // Instellingen staan dicht en nemen geen ruimte boven de stops: start en datum, en het reisopties-menu
    await expect(page.getByTestId("trip-setup")).not.toHaveAttribute("open", "");
    await expect(page.getByText("Vertrekdatum", { exact: true })).toBeHidden();
    await expect(page.getByRole("button", { name: "Meer reisopties" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("button", { name: "Omdraaien" })).toBeHidden();

    // Volgorde wijzigen zonder slepen
    await expect(stops.first()).toContainText(picked[0].name);
    await stops.first().getByRole("button", { name: "Later in de reis" }).click();
    await expect(stops.first()).toContainText(picked[1].name);
    await expect(stops.nth(1)).toContainText(picked[0].name);
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis") ?? "null")?.trips?.[0]?.stops?.map((s: { slug: string }) => s.slug)))
      .toEqual([picked[1].slug, picked[0].slug, picked[2].slug]);
    await stops.nth(1).getByRole("button", { name: "Eerder in de reis" }).click();
    await expect(stops.first()).toContainText(picked[0].name);
    await expect(stops.first().getByRole("button", { name: "Eerder in de reis" })).toBeDisabled();
    await expect(stops.last().getByRole("button", { name: "Later in de reis" })).toBeDisabled();
  });

  test("onbekende vertrektijd: gewone status, uitleg alleen bij de etappe die ervan afhangt", async ({ page, request }) => {
    // Stop 1 zonder vertrekgegevens, stop 2 met bevestigd "geen vaste vertrektijd"
    await setupTrip(page, request, (i) =>
      i === 0 ? { departure: undefined, departureCheck: undefined, checkoutUntil: undefined } : i === 1 ? { departure: "vrij", departureCheck: "bevestigd" } : {},
    );
    await page.goto("/mijn-reis");
    const stops = page.getByTestId("trip-stop");
    await expect(stops).toHaveCount(3);
    // Gewone status in grijs, geen alarmkleur
    const status = stops.first().getByText("Vertrektijd onbekend");
    await expect(status).toBeVisible();
    expect(await status.evaluate((el) => el.closest("[class*='text-alert'], [class*='bg-alert']") === null)).toBe(true);
    // Eén uitleg: de etappe vanaf stop 1; die vanaf stop 2 (bevestigd vrij) heeft er geen
    const note = page.getByTestId("leg-unknown-departure");
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText("We kunnen de aankomsttijd niet betrouwbaar berekenen omdat de vertrektijd van deze plek onbekend is.");
    expect(await note.evaluate((el) => el.closest("[class*='text-alert'], [class*='bg-alert']") === null)).toBe(true);
  });
});
