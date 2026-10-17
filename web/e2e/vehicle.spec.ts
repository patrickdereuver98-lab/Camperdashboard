import { expect, test } from "./fixtures";
import { signIn, SUPABASE, USER } from "./session";

test("camper opslaan zet het lengtefilter bij zoeken vanzelf aan, en uitzetten blijft uit", async ({ page }) => {
  await page.goto("/mijn-camper");
  await page.getByLabel("Lengte in meter").fill("7,4");
  await page.getByLabel("Verbruik per 100 km (liter of kWh)").fill("12");
  await page.getByRole("button", { name: "Bewaren" }).click();
  await expect(page.getByText("Bij het zoeken zie je nu plekken voor 7,4 meter.")).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:camper") ?? "{}"));
  expect(stored).toEqual({ lengthM: 7.4, consumption: 12 });
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reisinstellingen") ?? "{}"));
  expect(settings.litersPer100).toBe(12);

  await page.goto("/zoeken");
  const chip = page.getByRole("button", { name: "Filter Mijn camper (7,4 m) verwijderen" });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page).toHaveURL(/lengte=0/);
  await expect(page.getByRole("button", { name: /Mijn camper/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /Mijn camper/ })).toHaveCount(0);
});

test("onzinnige maten worden niet bewaard", async ({ page }) => {
  await page.goto("/mijn-camper");
  await page.getByLabel("Lengte in meter").fill("70");
  await page.getByRole("button", { name: "Bewaren" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "kloppen niet" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("vrijstaan:camper"))).toBeNull();
});

test("papieren: zonder account inloggen, met account uploaden en openen", async ({ page }) => {
  await page.goto("/mijn-camper");
  await expect(page.getByRole("link", { name: "Log in om papieren te bewaren" })).toBeVisible();

  await signIn(page);
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
  await page.route(`${SUPABASE}/rest/v1/user_vehicles**`, (r) => r.fulfill(r.request().method() === "GET" ? { json: null } : { status: 201, json: [] }));
  let listed = 0;
  await page.route(`${SUPABASE}/storage/v1/object/list/vehicle-docs`, async (r) => {
    listed++;
    await r.fulfill({
      json: listed === 1 ? [] : [{ id: "1", name: "1760000000000-verzekering.pdf", created_at: "2026-10-12T10:00:00Z", metadata: { size: 24000 } }],
    });
  });
  let uploadedPath = "";
  await page.route(`${SUPABASE}/storage/v1/object/vehicle-docs/**`, async (r) => {
    uploadedPath = decodeURIComponent(new URL(r.request().url()).pathname.split("/vehicle-docs/")[1]);
    await r.fulfill({ json: { Key: uploadedPath } });
  });
  let signed = "";
  await page.route(`${SUPABASE}/storage/v1/object/sign/vehicle-docs/**`, async (r) => {
    signed = decodeURIComponent(new URL(r.request().url()).pathname);
    await r.fulfill({ json: { signedURL: "/object/sign/vehicle-docs/x?token=t" } });
  });
  await page.goto("/mijn-camper");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Nog geen papieren bewaard.")).toBeVisible();
  await page.getByTestId("doc-input").setInputFiles({ name: "Verzekering 2026.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") });
  await expect(page.getByRole("button", { name: "verzekering.pdf", exact: false }).first()).toBeVisible();
  expect(uploadedPath).toMatch(new RegExp(`^${USER.id}/\\d+-Verzekering-2026\\.pdf$`));

  const popup = page.waitForEvent("popup");
  await page.getByText("verzekering.pdf").click();
  await (await popup).close();
  expect(signed).toContain(`/vehicle-docs/${USER.id}/1760000000000-verzekering.pdf`);
});
