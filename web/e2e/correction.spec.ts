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
  await page.getByRole("button", { name: "Klopt er iets niet? Meld het" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Wat klopt er niet?").selectOption("voorzieningen");

  // Beginstand = wat we weten; niets aangepast en geen toelichting: niet versturen
  const power = sheet.getByRole("radiogroup", { name: "Stroom" });
  await expect(power.getByRole("radio", { name: place.power ? "Ja" : "Nee" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Melding versturen" }).click();
  await expect(sheet.getByRole("alert")).toContainText("Je hebt nog niets aangepast");
  expect(sent).toBeNull();

  await sheet.getByRole("radiogroup", { name: "Lozen" }).getByRole("radio", { name: "Ja" }).click();
  await sheet.getByRole("button", { name: "Melding versturen" }).click();
  await expect(page.getByText("We controleren je melding")).toBeVisible();
  expect(sent).toMatchObject({
    p_kind: "correctie",
    p_payload: { onderwerp: "voorzieningen", voorzieningen: { dump_station: { was: null, nieuw: true } } },
  });
  expect(Object.keys((sent!.p_payload as { voorzieningen: object }).voorzieningen)).toEqual(["dump_station"]);
});
