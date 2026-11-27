// UX-audit 27 november 2026 (besluiten V1 en V4): bij een onbekende vertrektijd staat in het beslisblok één knop
// Vertrektijd doorgeven; verder geen vragen in het beslisblok. Correcties gaan via één knop onderaan, eigenaren hebben
// een eigen blok.
import snapshot from "../src/data/snapshot.json";
import { expect, PLACES, PRERENDERED, test } from "./fixtures";
import { SUPABASE } from "./session";

type Snap = { slug: string; departure?: string; checkoutUntil?: string };
const bySlug = new Map((snapshot as unknown as { places: Snap[] }).places.map((p) => [p.slug, p]));
// Een plek zonder vertrekregel (onvolledig) en een met een vaste, leesbare vertrektijd
const place = PLACES.find((p) => !bySlug.get(p.slug)?.departure)!;
const known = PRERENDERED.find((p) => bySlug.get(p.slug)?.departure === "vast" && bySlug.get(p.slug)?.checkoutUntil)!;

const quiet = async (page: import("@playwright/test").Page, onSubmit?: (body: Record<string, unknown>) => void) =>
  page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "submit_place") {
      onSubmit?.(r.request().postDataJSON());
      return r.fulfill({ json: "33333333-3333-4333-8333-333333333333" });
    }
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });

test("bekende vertrektijd: geen vragen in het beslisblok, eigenaar en correctie onderaan", async ({ page }) => {
  await quiet(page);
  await page.goto(`/plek/${known.slug}`);
  const decision = page.getByTestId("decision-summary");
  await expect(decision.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Klopt dit niet?")).toHaveCount(0);
  await expect(page.getByText(/gegevens bekend/)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Eigenaar van deze plek?" }).getByRole("button", { name: "Gegevens aanpassen" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Klopt er iets niet?" }).getByRole("button", { name: "Gegevens corrigeren of aanvullen" })).toBeVisible();
});

test("onbekende vertrektijd: rustig in het beslisblok, één knop om hem door te geven, met bevestiging", async ({ page }) => {
  test.skip(!place, "geen onvolledige plek in de snapshot");
  let sent: Record<string, unknown> | null = null;
  await quiet(page, (b) => (sent = b));
  await page.goto(`/plek/${place.slug}`);

  const departure = page.getByTestId("decision-departure");
  await expect(departure).toContainText("Vertrektijd onbekend");
  await expect(departure).toContainText("We weten nog niet hoe laat je hier moet vertrekken.");
  // Geen foutkleur voor een onbekende waarde
  await expect(departure.locator(".text-alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Vertrektijd doorgeven" })).toHaveCount(1);

  await departure.getByRole("button", { name: "Vertrektijd doorgeven" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Geen vaste tijd/ }).click();
  await sheet.getByRole("button", { name: "Versturen" }).click();
  await expect(departure.getByRole("status")).toContainText("Hij wacht op controle. Dat doen we meestal binnen twee werkdagen");
  expect(sent).toMatchObject({ p_kind: "correctie", p_payload: { onderwerp: "vertrektijd", vertrek: "vrij" } });
});

test("vaste tijd kiezen: het tijdveld begint leeg en is verplicht (R83)", async ({ page }) => {
  test.skip(!place, "geen onvolledige plek in de snapshot");
  await quiet(page);
  await page.goto(`/plek/${place.slug}`);
  await page.getByTestId("decision-departure").getByRole("button", { name: "Vertrektijd doorgeven" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("radio", { name: /Op een vaste tijd/ }).click();
  const time = sheet.locator('input[name="checkout"]');
  await expect(time).toHaveValue("");
  await expect(time).toHaveAttribute("required", "");
});
