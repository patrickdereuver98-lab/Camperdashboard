import { expect, PLACES, test } from "./fixtures";
import { USER, signIn, SUPABASE } from "./session";

const slug = PLACES[0].slug;

// Klein maar groot genoeg testbeeld (800×600) als PNG, gemaakt in de browser
async function pngBuffer(page: import("@playwright/test").Page, w = 800, h = 600) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#2d5a43";
    ctx.fillRect(0, 0, w, h);
    return c.toDataURL("image/png").split(",")[1];
  }, [w, h] as const);
  return Buffer.from(b64, "base64");
}

test("niet ingelogd: 'Foto toevoegen' stuurt naar inloggen en terug", async ({ page }) => {
  await page.goto(`/plek/${slug}`);
  await expect(page.getByTestId("photo-login")).toHaveAttribute("href", `/inloggen?next=${encodeURIComponent(`/plek/${slug}#foto-toevoegen`)}`);
});

test("ingelogd: foto wordt verkleind, geüpload en ter controle ingestuurd", async ({ page }) => {
  await signIn(page);
  let uploaded: { path: string; type: string | undefined; size: number } | null = null;
  let inserted: Record<string, unknown> | null = null;
  await page.route(`${SUPABASE}/storage/v1/object/place-photos/**`, async (r) => {
    const url = new URL(r.request().url());
    uploaded = { path: decodeURIComponent(url.pathname.split("/place-photos/")[1]), type: r.request().headers()["content-type"], size: r.request().postDataBuffer()?.length ?? 0 };
    await r.fulfill({ json: { Key: `place-photos/${uploaded.path}` } });
  });
  await page.route(`${SUPABASE}/rest/v1/place_photos**`, async (r) => {
    inserted = r.request().postDataJSON();
    await r.fulfill({ status: 201, json: { status: "pending" } });
  });
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));

  await page.goto(`/plek/${slug}`);
  await page.getByTestId("photo-input").setInputFiles({ name: "plek.png", mimeType: "image/png", buffer: await pngBuffer(page, 2400, 1800) });
  await expect(page.getByAltText("Gekozen foto")).toBeVisible();
  await page.getByLabel(/Wat zie je op de foto/).fill("Uitzicht op het water");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Foto versturen" }).click();
  await expect(page.getByText("We bekijken je foto")).toBeVisible();

  expect(uploaded!.path).toMatch(new RegExp(`^${USER.id}/[0-9a-f-]{36}\\.(webp|jpg)$`));
  expect(uploaded!.size).toBeGreaterThan(0);
  expect(inserted).toMatchObject({ user_id: USER.id, storage_path: uploaded!.path, width: 1600, height: 1200, caption: "Uitzicht op het water" });
});

test("ingelogd: te kleine foto wordt geweigerd vóór het uploaden", async ({ page }) => {
  await signIn(page);
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
  let uploads = 0;
  await page.route(`${SUPABASE}/storage/v1/**`, (r) => {
    uploads++;
    return r.fulfill({ json: {} });
  });
  await page.goto(`/plek/${slug}`);
  await page.getByTestId("photo-input").setInputFiles({ name: "klein.png", mimeType: "image/png", buffer: await pngBuffer(page, 300, 200) });
  await expect(page.getByRole("alert").filter({ hasText: "te klein" })).toBeVisible();
  expect(uploads).toBe(0);
});
