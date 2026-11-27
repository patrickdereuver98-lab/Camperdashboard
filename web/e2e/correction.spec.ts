import snapshot from "../src/data/snapshot.json";
import { expect, PRERENDERED, test } from "./fixtures";
import { SUPABASE } from "./session";

// Voorzieningen doorgeven: per voorziening ja, nee of "weet ik niet"; alleen wat anders is gaat naar beheer
type Snap = { slug: string; power?: boolean; dumpStation?: boolean };
const all = (snapshot as unknown as { places: Snap[] }).places;
const top = new Set(PRERENDERED.map((p) => p.slug));
// Een plek waar stroom bekend is en lozen niet: dan is te zien dat alleen de wijziging meegaat
const place = all.find((p) => top.has(p.slug) && p.power !== undefined && p.dumpStation === undefined)!;

test("voorzieningen doorgeven: alleen wat anders is gaat mee, met de oude waarde", async ({ page }) => {
  test.skip(!place, "geen geschikte plek in de snapshot");
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
  await page.getByRole("button", { name: "Gegevens corrigeren of aanvullen" }).click();
  const sheet = page.getByRole("dialog");
  // Eerst kiezen wat je wilt aanpassen; pas daarna staan de velden er (UX-audit 27 november, D13)
  await expect(sheet.getByRole("group", { name: "Wat wil je aanpassen?" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Versturen" })).toHaveCount(0);
  await sheet.getByRole("radio", { name: "Voorzieningen", exact: true }).check();

  // Beginstand = wat we weten; niets aangepast en geen toelichting: niet versturen
  const power = sheet.getByRole("radiogroup", { name: "Stroom" });
  await expect(power.getByRole("radio", { name: place.power ? "Ja" : "Nee" })).toBeChecked();
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Je hebt nog niets aangepast");
  expect(sent).toBeNull();

  await sheet.getByRole("radiogroup", { name: "Lozen" }).getByRole("radio", { name: "Ja" }).check();
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByText("Je melding is binnen en wacht op controle.")).toBeVisible();
  expect(sent).toMatchObject({
    p_kind: "correctie",
    p_payload: { onderwerp: "voorzieningen", voorzieningen: { dump_station: { was: null, nieuw: true } } },
  });
  expect(Object.keys((sent!.p_payload as { voorzieningen: object }).voorzieningen)).toEqual(["dump_station"]);
});

test("voorzieningenraster: onbekend staat gedempt, zonder vraagknop in de cel", async ({ page }) => {
  type Snap2 = { slug: string; power?: boolean; water?: boolean; dumpStation?: boolean; toilet?: boolean; shower?: boolean; wifi?: boolean; dogs?: boolean };
  const p = (snapshot as unknown as { places: Snap2[] }).places.find((x) => top.has(x.slug) && x.wifi === undefined);
  test.skip(!p, "geen plek met onbekende wifi in de snapshot");
  let sent: Record<string, unknown> | null = null;
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "submit_place") {
      sent = r.request().postDataJSON();
      return r.fulfill({ json: "44444444-4444-4444-8444-444444444444" });
    }
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  await page.goto(`/plek/${p!.slug}`);
  // Sinds de plekpagina-ronde (26 november 2026) geen vraagknop per voorziening meer: onbekend staat gedempt in het
  // raster en doorgeven gaat via Gegevens corrigeren of aanvullen onderaan (de test hierboven)
  await expect(page.getByRole("button", { name: "Is hier wifi? Geef het door" })).toHaveCount(0);
  await expect(page.locator('section[aria-labelledby="voorzieningen"]')).toContainText("Onbekend");
  expect(sent).toBeNull();
});

test("prijs corrigeren: alleen het tekstvak voor de juiste prijs, fout bij het veld", async ({ page }) => {
  const p = PRERENDERED[0];
  let sent: Record<string, unknown> | null = null;
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "submit_place") {
      sent = r.request().postDataJSON();
      return r.fulfill({ json: "55555555-5555-4555-8555-555555555555" });
    }
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  await page.goto(`/plek/${p.slug}`);
  // Eén centrale knop, onderaan in Klopt er iets niet?
  const help = page.getByRole("region", { name: "Klopt er iets niet?" });
  await expect(page.getByRole("button", { name: "Gegevens corrigeren of aanvullen" })).toHaveCount(1);
  await help.getByRole("button", { name: "Gegevens corrigeren of aanvullen" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: "Prijs", exact: true }).check();
  await expect(sheet.getByRole("radiogroup", { name: "Stroom" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Versturen" }).click();
  const field = sheet.getByLabel("Wat is de juiste informatie?");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(sheet.getByRole("alert")).toHaveText("Schrijf kort wat er niet klopt.");
  expect(sent).toBeNull();
  await field.fill("€ 20 per nacht, toeristenbelasting € 1,50 per persoon");
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(page.getByText("Je melding is binnen en wacht op controle.")).toBeVisible();
  expect(sent).toMatchObject({ p_kind: "correctie", p_payload: { onderwerp: "prijs" } });
});
