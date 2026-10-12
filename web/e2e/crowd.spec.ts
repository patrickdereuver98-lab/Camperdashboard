import { expect, PLACES, test } from "./fixtures";
import { signIn, SUPABASE } from "./session";

const slug = PLACES[0].slug;
const empty = { level: null, reports: 0, last_at: null, counts: {} };

test("zonder meldingen: niets verzinnen, inloggen om te melden", async ({ page }) => {
  await page.route(`${SUPABASE}/rest/v1/rpc/crowd_status**`, (r) => r.fulfill({ json: empty }));
  await page.goto(`/plek/${slug}`);
  const card = page.getByTestId("crowd");
  await expect(card.getByText("Nog niemand gemeld")).toBeVisible();
  await expect(card.getByRole("link", { name: "Log in om de drukte door te geven" })).toHaveAttribute(
    "href",
    `/inloggen?next=${encodeURIComponent(`/plek/${slug}#drukte`)}`,
  );
});

test("met meldingen: niveau, aantal en tijdstip", async ({ page }) => {
  const last = new Date(Date.now() - 20 * 60000).toISOString();
  await page.route(`${SUPABASE}/rest/v1/rpc/crowd_status**`, (r) => r.fulfill({ json: { level: "druk", reports: 3, last_at: last, counts: { druk: 2, rustig: 1 } } }));
  await page.goto(`/plek/${slug}`);
  const card = page.getByTestId("crowd");
  await expect(card.getByText("Druk", { exact: true })).toBeVisible();
  await expect(card.getByText("Volgens 3 camperaars, laatste melding 20 minuten geleden")).toBeVisible();
});

test("ingelogd: drukte doorgeven", async ({ page }) => {
  await signIn(page);
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
  await page.route(`${SUPABASE}/rest/v1/rpc/crowd_status**`, (r) => r.fulfill({ json: empty }));
  let sent: unknown = null;
  await page.route(`${SUPABASE}/rest/v1/rpc/report_crowd**`, async (r) => {
    sent = r.request().postDataJSON();
    await r.fulfill({ json: { level: "vol", reports: 1, last_at: new Date().toISOString(), counts: { vol: 1 } } });
  });
  await page.goto(`/plek/${slug}`);
  await page.waitForLoadState("networkidle");
  const card = page.getByTestId("crowd");
  await card.getByRole("button", { name: "Vol" }).click();
  await expect(card.getByText("Volgens 1 camperaar, laatste melding net")).toBeVisible();
  await expect(card.getByRole("button", { name: "Vol" })).toHaveAttribute("aria-pressed", "true");
  expect(sent).toMatchObject({ p_level: "vol", p_place_id: expect.any(String) });
});
