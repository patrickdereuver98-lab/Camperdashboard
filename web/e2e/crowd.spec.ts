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

test("ingelogd bij drukte: melding aanzetten vraagt toestemming en volgt de plek", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium");
  await context.grantPermissions(["notifications"]);
  await signIn(page);
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
  await page.route(`${SUPABASE}/rest/v1/rpc/crowd_status**`, (r) =>
    r.fulfill({ json: { level: "vol", reports: 2, last_at: new Date().toISOString(), counts: { vol: 2 } } }),
  );
  await page.route(`${SUPABASE}/rest/v1/crowd_watches**`, (r) => r.fulfill({ json: null }));
  // Pushdienst van de browser nabootsen: subscribe geeft een vast abonnement terug
  await page.addInitScript(() => {
    const key = new Uint8Array(65).fill(4).buffer;
    const fake = { endpoint: "https://push.example/abc", getKey: (n: string) => (n === "auth" ? new Uint8Array(16).fill(7).buffer : key) };
    Object.defineProperty(window, "PushManager", { value: function PushManager() {}, configurable: true });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: async () => ({}), ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe: async () => fake } }) },
    });
  });
  const calls: Record<string, unknown> = {};
  await page.route(`${SUPABASE}/rest/v1/rpc/push_public_key**`, (r) => r.fulfill({ json: "BNkwUPbJiKWuPJOKtest" }));
  await page.route(`${SUPABASE}/rest/v1/rpc/push_subscribe**`, async (r) => {
    calls.subscribe = r.request().postDataJSON();
    await r.fulfill({ status: 204 });
  });
  await page.route(`${SUPABASE}/rest/v1/rpc/watch_place**`, async (r) => {
    calls.watch = r.request().postDataJSON();
    await r.fulfill({ json: true });
  });
  await page.goto(`/plek/${slug}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Laat het me weten als het hier rustig is" }).click();
  await expect(page.getByText("We sturen je één melding zodra iemand meldt dat het hier rustig is")).toBeVisible();
  expect(calls.subscribe).toMatchObject({ p_endpoint: "https://push.example/abc", p_p256dh: expect.any(String), p_auth: expect.any(String) });
  expect(calls.watch).toMatchObject({ p_on: true });
  await expect(page.getByRole("button", { name: "Melding uitzetten" })).toBeVisible();
});
