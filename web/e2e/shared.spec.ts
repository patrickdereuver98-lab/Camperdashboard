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

test("meedoen zet de gedeelde reis als nieuwe reis naast je eigen reis", async ({ page }) => {
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
  await expect(page.getByText("komt als nieuwe reis in Mijn reis")).toBeVisible();
  await page.getByRole("button", { name: "Meedoen" }).click();
  await page.waitForURL(/\/mijn-reis$/);
  await expect(page.getByTestId("shared-card")).toContainText("samen met Anja");
  const state = await page.evaluate(() => ({ reis: JSON.parse(localStorage.getItem("vrijstaan:reis")!), samen: JSON.parse(localStorage.getItem("vrijstaan:samen")!) }));
  // Reisopslag versie 4 (lib/trip-storage.ts): je eigen reis blijft de eerste, de gedeelde reis komt erbij en staat open
  expect(state.reis.v).toBe(4);
  expect(state.reis.trips).toHaveLength(2);
  expect(state.reis.trips[0]).toEqual({ id: "reis-1", name: "Mijn reis", stops: [{ slug: PLACES[2].slug, nights: 1 }] });
  expect(state.reis.trips[1]).toMatchObject({ name: "Onze reis", stops: [{ slug: PLACES[0].slug, nights: 2 }, { slug: PLACES[1].slug, nights: 1 }] });
  expect(state.reis.active).toBe(state.reis.trips[1].id);
  expect(state.samen).toEqual({ id: TRIP, name: "Onze reis", code: CODE, trip: state.reis.trips[1].id });
  await expect(page.getByTestId("trip-name")).toHaveText("Onze reis");
});

test("samen plannen starten en een wijziging gaat naar de gedeelde reis", async ({ page }) => {
  await signIn(page);
  await page.addInitScript((s) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: s, nights: 1 }])), PLACES[0].slug);
  let created: unknown = null;
  await page.route(`${SUPABASE}/rest/v1/rpc/create_shared_trip**`, async (r) => {
    created = r.request().postDataJSON();
    await r.fulfill({ json: { id: TRIP, code: CODE, name: "Mijn reis" } });
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

test("notities: alleen gedeelde notities gaan naar de gedeelde reis, privé blijft hier", async ({ page }) => {
  await signIn(page);
  // Oude opslag (versie 3) met een notitie: die wordt privé
  await page.addInitScript(
    (s) => localStorage.setItem("vrijstaan:reis", JSON.stringify({ v: 3, stops: [{ slug: s, nights: 1, note: "Pincode 1234" }] })),
    PLACES[0].slug,
  );
  let created: { p_stops?: unknown } | null = null;
  await page.route(`${SUPABASE}/rest/v1/rpc/create_shared_trip**`, async (r) => {
    created = r.request().postDataJSON();
    await r.fulfill({ json: { id: TRIP, code: CODE, name: "Mijn reis" } });
  });
  const updates: { stops: { slug: string; notes?: { text: string; shared?: boolean }[] }[] }[] = [];
  await page.route(`${SUPABASE}/rest/v1/shared_trips**`, async (r) => {
    if (r.request().method() === "PATCH") {
      updates.push(r.request().postDataJSON());
      return r.fulfill({ status: 204 });
    }
    // Een reisgenoot deelde al een notitie bij deze stop
    return r.fulfill({ json: { stops: [{ slug: PLACES[0].slug, nights: 1, notes: [{ id: "anja1", text: "Bakker om de hoek", shared: true }] }] } });
  });
  await page.route(`${SUPABASE}/rest/v1/shared_trip_members**`, (r) => r.fulfill({ json: [] }));
  await page.goto("/mijn-reis");
  const stop = page.getByTestId("trip-stop").first();
  await expect(stop.getByTestId("stop-note-scope")).toHaveText("Privé");

  const firstState = page.waitForResponse((r) => r.url().includes("/rest/v1/shared_trips") && r.request().method() === "GET");
  await page.getByTestId("shared-card").getByRole("button", { name: "Samen plannen" }).click();
  await firstState;
  // De privénotitie ging niet mee bij het starten
  expect(JSON.stringify(created)).not.toContain("Pincode");
  // De gedeelde notitie van de reisgenoot staat er, je privénotitie ook
  await expect(stop.getByTestId("stop-note-text")).toHaveText(["Bakker om de hoek", "Pincode 1234"]);
  await expect(stop.getByTestId("stop-note-scope")).toHaveText(["Gedeeld met reisgenoten", "Privé"]);

  // Nieuwe notitie met "Delen met reisgenoten" aan: die gaat mee, de privénotitie nog steeds niet
  await stop.getByRole("button", { name: "Notitie toevoegen" }).click();
  await stop.getByRole("textbox").fill("Om 16:00 verzamelen");
  await stop.getByRole("button", { name: "Delen met reisgenoten" }).click();
  await stop.getByRole("button", { name: "Bewaren" }).click();
  await expect.poll(() => updates.length, { timeout: 5000 }).toBeGreaterThan(0);
  const sent = updates.at(-1)!.stops[0].notes!.map((n) => n.text);
  expect(sent).toEqual(["Bakker om de hoek", "Om 16:00 verzamelen"]);
  expect(JSON.stringify(updates)).not.toContain("Pincode");
});
