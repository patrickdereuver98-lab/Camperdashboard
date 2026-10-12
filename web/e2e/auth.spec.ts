import type { Page } from "@playwright/test";
import { expect, PLACES, test } from "./fixtures";

const SUPABASE = "https://qkrmthrhwmmmwswmfgwc.supabase.co";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "kampeerder@example.com",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Kees Kampeerder" },
  created_at: "2026-10-01T00:00:00Z",
};
const SESSION = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, exp, role: "authenticated", aud: "authenticated" })}.sig`,
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: exp,
  user: USER,
};

async function signIn(page: Page) {
  await page.addInitScript((s) => localStorage.setItem("vrijstaan-auth", JSON.stringify(s)), SESSION);
  await page.route(`${SUPABASE}/auth/v1/user`, (r) => r.fulfill({ json: USER }));
}

test.describe("inloggen", () => {
  test("toont Google, Apple, Facebook en e-mail", async ({ page }) => {
    await page.goto("/inloggen");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inloggen");
    for (const p of ["Google", "Apple", "Facebook"]) await expect(page.getByRole("button", { name: `Doorgaan met ${p}` })).toBeVisible();
    await expect(page.getByLabel("E-mailadres")).toBeVisible();
    await expect(page.getByTestId("account-button").filter({ visible: true })).toHaveAttribute("data-state", "out");
  });

  test("Google stuurt door naar Supabase met PKCE en de juiste callback", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/authorize**`, (r) => r.fulfill({ contentType: "text/html", body: "<h1>provider</h1>" }));
    await page.goto("/inloggen?next=/mijn-reis");
    await page.getByRole("button", { name: "Doorgaan met Google" }).click();
    await page.waitForURL(/\/auth\/v1\/authorize/);
    const url = new URL(page.url());
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("s256");
    const back = new URL(url.searchParams.get("redirect_to")!);
    expect(back.pathname).toBe("/auth/callback");
    expect(back.searchParams.get("next")).toBe("/mijn-reis");
  });

  test("magic link: verstuurt de aanvraag en toont 'Check je mail'", async ({ page }) => {
    let body: Record<string, unknown> | null = null;
    await page.route(`${SUPABASE}/auth/v1/otp**`, async (r) => {
      body = r.request().postDataJSON();
      await r.fulfill({ json: {} });
    });
    await page.goto("/inloggen");
    await page.getByLabel("E-mailadres").fill("kampeerder@example.com");
    await page.getByRole("button", { name: "Stuur mij een inloglink" }).click();
    await expect(page.getByText("Check je mail")).toBeVisible();
    expect(body).toMatchObject({ email: "kampeerder@example.com", create_user: true });
    expect(body!.code_challenge).toBeTruthy();
  });

  test("magic link: te vaak aangevraagd geeft een begrijpelijke melding", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/otp**`, (r) =>
      r.fulfill({ status: 429, json: { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 30 seconds." } }),
    );
    await page.goto("/inloggen");
    await page.getByLabel("E-mailadres").fill("kampeerder@example.com");
    await page.getByRole("button", { name: "Stuur mij een inloglink" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wacht een minuutje" })).toBeVisible();
  });

  test("callback met een fout van de provider", async ({ page }) => {
    await page.goto("/auth/callback?error=access_denied&error_description=Unsupported+provider%3A+provider+is+not+enabled");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Inloggen lukte niet");
    await expect(page.getByRole("alert").filter({ hasText: "nog niet beschikbaar" })).toBeVisible();
  });

  test("account zonder sessie verwijst naar inloggen", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("link", { name: "Inloggen", exact: true }).last()).toHaveAttribute("href", "/inloggen?next=/account");
  });
});

test.describe("ingelogd", () => {
  test("header, accountpagina en uitloggen", async ({ page }) => {
    await signIn(page);
    await page.route(`${SUPABASE}/rest/v1/user_trips**`, (r) => r.fulfill(r.request().method() === "GET" ? { json: null, status: 200 } : { status: 201, json: [] }));
    await page.route(`${SUPABASE}/auth/v1/logout**`, (r) => r.fulfill({ status: 204 }));
    await page.goto("/account");
    await expect(page.getByTestId("account-button").filter({ visible: true })).toHaveAttribute("data-state", "in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kees Kampeerder");
    await expect(page.getByText("kampeerder@example.com")).toBeVisible();
    await expect(page.getByText("Ingelogd via Google.")).toBeVisible();
    await page.getByRole("button", { name: "Uitloggen" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByTestId("account-button").filter({ visible: true })).toHaveAttribute("data-state", "out");
  });

  test("Mijn reis wordt samengevoegd met het account en teruggeschreven", async ({ page }) => {
    const [local, remote] = [PLACES[0].slug, PLACES[1].slug];
    await signIn(page);
    await page.addInitScript((slug) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug, nights: 2 }])), local);
    const pushed: unknown[] = [];
    await page.route(`${SUPABASE}/rest/v1/user_trips**`, async (r) => {
      if (r.request().method() === "GET") return r.fulfill({ json: { stops: [{ slug: remote, nights: 3 }] } });
      pushed.push(r.request().postDataJSON());
      return r.fulfill({ status: 201, json: [] });
    });
    await page.goto("/account");
    await expect(page.getByText("2 plekken, bewaard in je account")).toBeVisible();
    const trip = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis") ?? "[]"));
    expect(trip).toEqual([{ slug: local, nights: 2 }, { slug: remote, nights: 3 }]);
    await expect.poll(() => pushed.length).toBeGreaterThan(0);
    expect(pushed[0]).toMatchObject({ user_id: USER.id, stops: [{ slug: local, nights: 2 }, { slug: remote, nights: 3 }] });
  });
});
