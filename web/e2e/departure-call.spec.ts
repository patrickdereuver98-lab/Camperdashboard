// Plekpagina-ronde 26 november 2026 (vervangt R48): geen vragen in het beslisblok behalve "Weet jij het?" bij een
// onbekende vertrektijd; oproep, eigenaarsroute en wijzigingen onderaan in Help deze plek kloppen, met bevestiging.
import snapshot from "../src/data/snapshot.json";
import { expect, PLACES, PRERENDERED, test } from "./fixtures";
import { SUPABASE } from "./session";

type Snap = { slug: string; departure?: string; checkoutUntil?: string };
const bySlug = new Map((snapshot as unknown as { places: Snap[] }).places.map((p) => [p.slug, p]));
// Een plek zonder vertrekregel (onvolledig) en een met een vaste, leesbare vertrektijd
const place = PLACES.find((p) => !bySlug.get(p.slug)?.departure)!;
const known = PRERENDERED.find((p) => bySlug.get(p.slug)?.departure === "vast" && bySlug.get(p.slug)?.checkoutUntil)!;

test("bekende vertrektijd: geen vragen in het beslisblok, eigenaarsroute onderaan", async ({ page }) => {
  await page.goto(`/plek/${known.slug}`);
  await expect(page.getByTestId("departure-call")).toHaveCount(0);
  await expect(page.getByText("Klopt dit niet?")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Weet jij het?" })).toHaveCount(0);
  const help = page.getByRole("region", { name: "Help deze plek kloppen" });
  await expect(help.getByRole("button", { name: "Ben je de eigenaar? Vul je gegevens aan" })).toBeVisible();
  await expect(help.getByRole("button", { name: "Wijziging doorgeven" })).toBeVisible();
});

test("onbekende vertrektijd: Weet jij het? springt naar de oproep onderaan, met bevestiging en termijn", async ({ page }) => {
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

  await page.getByRole("link", { name: "Weet jij het?" }).click();
  await expect(page).toHaveURL(/#help$/);
  const call = page.getByTestId("departure-call");
  await expect(call).toContainText("We weten de vertrektijd nog niet.");
  await expect(call.getByRole("button", { name: "Eigenaar? Vul de tijden in" })).toBeVisible();

  await call.getByRole("button", { name: "Vertrektijd doorgeven" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Geen vaste tijd/ }).click();
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(call.getByRole("status")).toContainText("Hij wacht op controle. Dat doen we meestal binnen twee werkdagen");
  expect(sent).toMatchObject({ p_kind: "correctie", p_payload: { onderwerp: "vertrektijd", vertrek: "vrij" } });
});

test("vaste tijd kiezen: het tijdveld begint leeg en is verplicht (R83)", async ({ page }) => {
  test.skip(!place, "geen onvolledige plek in de snapshot");
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  await page.goto(`/plek/${place.slug}`);
  await page.getByTestId("departure-call").getByRole("button", { name: "Vertrektijd doorgeven" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Op een vaste tijd/ }).click();
  const time = sheet.locator('input[name="checkout"]');
  await expect(time).toHaveValue("");
  await expect(time).toHaveAttribute("required", "");
});
