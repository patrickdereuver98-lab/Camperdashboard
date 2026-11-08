// Review R48: duidelijke oproep "Vertrektijd doorgeven", "Klopt dit niet?" in het beslisblok, eigenaarsroute hoog,
// en na verzenden een bevestiging met status en termijn.
import snapshot from "../src/data/snapshot.json";
import { expect, PLACES, PRERENDERED, test } from "./fixtures";
import { SUPABASE } from "./session";

type Snap = { slug: string; departure?: string; checkoutUntil?: string };
const bySlug = new Map((snapshot as unknown as { places: Snap[] }).places.map((p) => [p.slug, p]));
// Een plek zonder vertrekregel (onvolledig) en een met een vaste, leesbare vertrektijd
const place = PLACES.find((p) => !bySlug.get(p.slug)?.departure)!;
const known = PRERENDERED.find((p) => bySlug.get(p.slug)?.departure === "vast" && bySlug.get(p.slug)?.checkoutUntil)!;

test("bekende vertrektijd: Klopt dit niet? in de cel en de eigenaarsroute onder het beslisblok", async ({ page }) => {
  await page.goto(`/plek/${known.slug}`);
  await expect(page.getByTestId("departure-call")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Klopt dit niet? De vertrektijd doorgeven" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Details over tijden en prijs" }).getByRole("button", { name: "Ben je de eigenaar? Vul je gegevens aan" })).toBeVisible();
});

test("oproep met knop, Klopt dit niet? en bevestiging met termijn", async ({ page }) => {
  test.skip(!place, "geen onvolledige plek in de snapshot");
  let sent: Record<string, unknown> | null = null;
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "submit_place") {
      sent = r.request().postDataJSON();
      return r.fulfill({ json: "33333333-3333-4333-8333-333333333333" });
    }
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  await page.goto(`/plek/${place.slug}`);

  const call = page.getByTestId("departure-call");
  await expect(call).toContainText("We weten de vertrektijd van deze plek nog niet.");
  await expect(call.getByRole("button", { name: "Eigenaar? Vul de tijden in" })).toBeVisible();

  await call.getByRole("button", { name: "Vertrektijd doorgeven" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Geen vaste tijd/ }).click();
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(call.getByRole("status")).toContainText("Hij wacht op controle. Dat doen we meestal binnen twee werkdagen");
  expect(sent).toMatchObject({ p_kind: "correctie", p_payload: { onderwerp: "vertrektijd", vertrek: "vrij" } });
});
