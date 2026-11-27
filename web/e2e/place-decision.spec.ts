// UX-audit 27 november 2026: het beslisblok beantwoordt eerst hoe laat je weg moet, dan wat het kost, dan aankomst,
// open en reserveren. Onbekend is een gewone waarde, geen fout; "mogelijk verouderd" is een rustig signaal.
import snapshot from "../src/data/snapshot.json";
import { expect, PRERENDERED, test } from "./fixtures";
import { SUPABASE } from "./session";

type Snap = { slug: string; priceEur?: number; priceExtras?: unknown[]; reservationRule?: string; reservation?: boolean; verifiedAt?: string; website?: string };
const all = (snapshot as unknown as { places: Snap[] }).places;
const top = new Set(PRERENDERED.map((p) => p.slug));
const noPrice = all.find((p) => top.has(p.slug) && p.priceEur === undefined && !p.priceExtras?.length) ?? all.find((p) => p.priceEur === undefined && !p.priceExtras?.length);
const noReservation = all.find((p) => top.has(p.slug) && !p.reservationRule && p.reservation === undefined && p.website);
const checked = all.find((p) => top.has(p.slug) && p.verifiedAt);

test.beforeEach(async ({ page }) => {
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
});

test("volgorde: vertrek, dan prijs, dan aankomst, open en reserveren", async ({ page }) => {
  await page.goto(`/plek/${PRERENDERED[0].slug}`);
  const block = page.getByTestId("decision-summary");
  await expect(block).toBeVisible();
  const text = (await block.innerText()).replace(/\s+/g, " ");
  const at = (s: string) => text.indexOf(s);
  expect(at("Aankomst")).toBeGreaterThan(-1);
  expect(at("Open")).toBeGreaterThan(at("Aankomst"));
  expect(at("Reserveren")).toBeGreaterThan(at("Open"));
  const dep = await page.getByTestId("decision-departure").boundingBox();
  const price = await page.getByTestId("decision-price").boundingBox();
  expect(price!.y).toBeGreaterThan(dep!.y);
  // Vertrekken is de grootste waarde in het blok
  const depSize = await page.getByTestId("decision-departure").locator("p").nth(1).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const priceSize = await page.getByTestId("decision-price").locator("span").nth(1).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(depSize).toBeGreaterThan(priceSize);
});

test("prijs onbekend: rustig 'Prijs onbekend', geen foutkleur", async ({ page }) => {
  test.skip(!noPrice, "geen plek zonder prijs in de snapshot");
  await page.goto(`/plek/${noPrice!.slug}`);
  const price = page.getByTestId("decision-price");
  await expect(price).toContainText("Prijs onbekend");
  await expect(price.locator(".text-alert")).toHaveCount(0);
});

test("reserveren onbekend: 'Onbekend' in het beslisblok en uitleg vóór de link naar de website", async ({ page }, info) => {
  test.skip(!noReservation, "geen plek zonder reserveerregel met website in de snapshot");
  await page.goto(`/plek/${noReservation!.slug}`);
  const value = page.getByTestId("decision-summary").locator("dt", { hasText: "Reserveren" }).locator("xpath=following-sibling::dd");
  await expect(value).toHaveText("Onbekend");
  const res = page.getByTestId("reservation");
  await expect(res).toContainText("We weten niet of je vooraf moet reserveren.");
  if (info.project.name === "mobile") await expect(res.getByRole("link", { name: /Naar de website/ })).toBeVisible();
});

test("mogelijk verouderd: rustig signaal achter de datum, niet in de foutkleur", async ({ page }) => {
  test.skip(!checked, "geen plek met controledatum in de snapshot");
  // Twee jaar na de controle: dan is de laatste controle ouder dan 12 maanden
  await page.clock.install({ time: new Date(Date.parse(checked!.verifiedAt!) + 2 * 365 * 864e5) });
  await page.goto(`/plek/${checked!.slug}`);
  const note = page.getByTestId("outdated");
  await expect(note).toContainText("mogelijk verouderd");
  await expect(note).not.toHaveClass(/text-alert/);
});

test("groot scherm: vertrektijd en Route openen staan zonder scrollen in beeld", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "alleen groot scherm");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/plek/${PRERENDERED[0].slug}`);
  await expect(page.getByTestId("decision-departure").locator("p").nth(1)).toBeInViewport({ ratio: 1 });
  const actions = page.getByTestId("place-actions").filter({ visible: true });
  await expect(actions.getByRole("button", { name: "Route openen" })).toBeInViewport();
  // Route openen is de enige gevulde knop; de website is ondergeschikt
  await expect(actions.getByRole("link", { name: /Naar de website/ })).not.toHaveClass(/bg-forest/);
});
