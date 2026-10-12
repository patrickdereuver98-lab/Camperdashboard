import { expect, PLACES, test } from "./fixtures";
import { signIn, SUPABASE } from "./session";

const TRIP = "44444444-4444-4444-8444-444444444444";
const CODE = "0123456789abcdef01";

test.beforeEach(async ({ page }) => {
  // Realtime niet naar de echte database laten gaan
  await page.routeWebSocket(/realtime/, () => {});
  await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill({ json: null }));
  await page.route(`${SUPABASE}/rest/v1/user_expenses**`, (r) => r.fulfill({ json: null }));
  await page.route(`${SUPABASE}/rest/v1/user_vehicles**`, (r) => r.fulfill({ json: null }));
});

test("uitnodiging zonder account: eerst inloggen, daarna terug naar de uitnodiging", async ({ page }) => {
  await page.goto(`/samen/${CODE}`);
  await expect(page.getByRole("link", { name: "Inloggen en meedoen" })).toHaveAttribute("href", `/inloggen?next=${encodeURIComponent(`/samen/${CODE}`)}`);
});

test("ongeldige uitnodiging", async ({ page }) => {
  await page.goto("/samen/niet-goed");
  await expect(page.getByRole("alert").filter({ hasText: "klopt niet" })).toBeVisible();
});

test("meedoen vervangt je reis door de gedeelde reis", async ({ page }) => {
  await signIn(page);
  await page.addInitScript((s) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: s, nights: 1 }])), PLACES[2].slug);
  await page.route(`${SUPABASE}/rest/v1/rpc/join_shared_trip**`, (r) =>
    r.fulfill({ json: { id: TRIP, name: "Onze reis", stops: [{ slug: PLACES[0].slug, nights: 2 }, { slug: PLACES[1].slug, nights: 1 }] } }),
  );
  await page.route(`${SUPABASE}/rest/v1/shared_trips**`, (r) =>
    r.fulfill({ json: { stops: [{ slug: PLACES[0].slug, nights: 2 }, { slug: PLACES[1].slug, nights: 1 }] } }),
  );
  await page.route(`${SUPABASE}/rest/v1/shared_trip_members**`, (r) => r.fulfill({ json: [{ user_id: "x", display_name: "Anja" }] }));
  await page.goto(`/samen/${CODE}`);
  await expect(page.getByText("wordt vervangen door de gedeelde reis")).toBeVisible();
  await page.getByRole("button", { name: "Meedoen" }).click();
  await page.waitForURL(/\/mijn-reis$/);
  await expect(page.getByTestId("shared-card")).toContainText("samen met Anja");
  const state = await page.evaluate(() => ({ reis: JSON.parse(localStorage.getItem("vrijstaan:reis")!), samen: JSON.parse(localStorage.getItem("vrijstaan:samen")!) }));
  expect(state.reis).toEqual([{ slug: PLACES[0].slug, nights: 2 }, { slug: PLACES[1].slug, nights: 1 }]);
  expect(state.samen).toEqual({ id: TRIP, name: "Onze reis", code: CODE });
});

test("samen plannen starten en een wijziging gaat naar de gedeelde reis", async ({ page }) => {
  await signIn(page);
  await page.addInitScript((s) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: s, nights: 1 }])), PLACES[0].slug);
  let created: unknown = null;
  await page.route(`${SUPABASE}/rest/v1/rpc/create_shared_trip**`, async (r) => {
    created = r.request().postDataJSON();
    await r.fulfill({ json: { id: TRIP, code: CODE, name: "Onze reis" } });
  });
  const updates: unknown[] = [];
  await page.route(`${SUPABASE}/rest/v1/shared_trips**`, async (r) => {
    if (r.request().method() === "PATCH") {
      updates.push(r.request().postDataJSON());
      return r.fulfill({ status: 204 });
    }
    return r.fulfill({ json: { stops: [{ slug: PLACES[0].slug, nights: 1 }] } });
  });
  await page.route(`${SUPABASE}/rest/v1/shared_trip_members**`, (r) => r.fulfill({ json: [] }));
  await page.goto("/mijn-reis");
  const card = page.getByTestId("shared-card");
  // Na het koppelen haalt de app eerst de stand van de gedeelde reis op (die is leidend)
  const firstState = page.waitForResponse((r) => r.url().includes("/rest/v1/shared_trips") && r.request().method() === "GET");
  await card.getByRole("button", { name: "Samen plannen" }).click();
  await firstState;
  await expect(card.getByRole("button", { name: "Uitnodiging sturen" })).toBeVisible();
  await expect(card).toContainText("Nog niemand heeft je uitnodiging geopend");
  expect(created).toMatchObject({ p_stops: [{ slug: PLACES[0].slug, nights: 1 }] });

  // Eigen wijziging (nacht erbij) wordt naar de gedeelde reis gestuurd
  await page.getByRole("button", { name: "Een nacht meer" }).first().click();
  await expect.poll(() => updates.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(updates.at(-1)).toMatchObject({ stops: [{ slug: PLACES[0].slug, nights: 2 }] });
});
