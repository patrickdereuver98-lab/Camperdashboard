// Review R45: doorkliks naar website en telefoon tellen als 'outbound' met soort en slug; een route is een eigen 'route'.
import snapshot from "../src/data/snapshot.json";
import { expect, PRERENDERED, test } from "./fixtures";

type Snap = { slug: string; website?: string; phone?: string };
const withContact = new Set((snapshot as unknown as { places: Snap[] }).places.filter((p) => p.website && p.phone).map((p) => p.slug));
const place = PRERENDERED.find((p) => withContact.has(p.slug))!;

test.beforeEach(async ({ page, context }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vrijstaan:toestemming", JSON.stringify({ id: "e2e", analytics: true, version: "2026-10", at: new Date().toISOString() }));
    } catch {
      /* geen opslag */
    }
  });
  // Externe websites en navigatie-apps niet echt openen
  await context.route(/^https?:\/\/(?!localhost)(?![^/]*supabase\.co)/, (route) => route.abort());
});

test("website en route tellen elk apart, met de slug van de plek", async ({ page }) => {
  const events: { p_name: string; p_props: Record<string, unknown> }[] = [];
  await page.route("**/rest/v1/rpc/track", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`/plek/${place.slug}`);

  const praktisch = page.locator("section", { has: page.getByRole("heading", { name: "Praktisch en contact" }) });
  await praktisch.locator("a[target=_blank]").first().click();
  await expect.poll(() => events.filter((e) => e.p_name === "outbound").map((e) => e.p_props)).toContainEqual({ soort: "website", slug: place.slug });

  await page.locator("#ligging").getByRole("button", { name: "Open in navigatie" }).click();
  await page.getByRole("link", { name: "Google Maps" }).click();
  await expect.poll(() => events.filter((e) => e.p_name === "route").map((e) => e.p_props)).toContainEqual({ slug: place.slug, app: "Google Maps" });
  // Een route is geen doorklik naar de website
  expect(events.filter((e) => e.p_name === "outbound" && e.p_props.soort === "route")).toEqual([]);
});
