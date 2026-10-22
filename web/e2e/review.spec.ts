import type { Page } from "@playwright/test";
import { expect, PRERENDERED, test } from "./fixtures";
import { SESSION, signIn, SUPABASE, USER } from "./session";

// Reviews alleen met account of code per mail (PRD open vraag 6)
const slug = PRERENDERED[0].slug;
const body = "Rustige plek aan het water, 's nachts helemaal stil. Stroom bij de paal.";

async function mockRest(page: Page) {
  const calls: Record<string, { body: Record<string, unknown>; auth: string | undefined }[]> = {};
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    if (r.request().method() === "POST") (calls[name] ??= []).push({ body: r.request().postDataJSON(), auth: r.request().headers().authorization });
    if (name === "crowd_status") return r.fulfill({ json: { level: null, reports: 0, last_at: null, counts: {} } });
    if (name === "submit_review") return r.fulfill({ json: "22222222-2222-4222-8222-222222222222" });
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  return calls;
}

async function fillReview(page: Page) {
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("group", { name: "Totaalcijfer *" }).getByRole("button", { name: "8", exact: true }).click();
  await sheet.getByLabel("Je ervaring *").fill(body);
  await sheet.getByRole("radio", { name: "Geen vaste tijd, je vertrekt wanneer je wilt" }).click();
  return sheet;
}

test("zonder account: code per mail, dan pas versturen; e-mail komt uit het account", async ({ page }) => {
  const calls = await mockRest(page);
  let otp: Record<string, unknown> | null = null;
  await page.route(`${SUPABASE}/auth/v1/otp**`, async (r) => {
    otp = r.request().postDataJSON();
    await r.fulfill({ json: {} });
  });
  await page.route(`${SUPABASE}/auth/v1/verify**`, (r) => r.fulfill({ json: SESSION }));
  await page.route(`${SUPABASE}/auth/v1/user`, (r) => r.fulfill({ json: USER }));
  await page.goto(`/plek/${slug}`);
  await page.getByRole("button", { name: "Schrijf een review" }).click();
  const sheet = await fillReview(page);
  await sheet.getByLabel("Je naam *").fill("Ans");
  await expect(sheet.getByRole("link", { name: "Liever inloggen met Google, Apple of Facebook" })).toHaveAttribute(
    "href",
    `/inloggen?next=${encodeURIComponent(`/plek/${slug}#review`)}`,
  );
  await sheet.getByLabel("Je e-mailadres *").fill("kampeerder@example.com");
  await sheet.getByRole("button", { name: "Stuur mij een code" }).click();
  await expect(sheet.getByText("Check je mail")).toBeVisible();
  expect(otp).toMatchObject({ email: "kampeerder@example.com", create_user: true });
  expect(calls.submit_review).toBeUndefined();

  await sheet.getByLabel("Code uit de mail").fill("123456");
  await sheet.getByRole("button", { name: "Bevestigen en versturen" }).click();
  await expect(page.getByText("Je review is ontvangen")).toBeVisible();

  const review = calls.submit_review![0];
  expect(review.auth).toBe(`Bearer ${SESSION.access_token}`);
  expect(review.body).toMatchObject({ p_author_name: "Ans", p_rating: 8, p_body: body });
  expect(review.body).not.toHaveProperty("p_author_email");
  // De vertrektijdvraag blijft werken: aparte inzending naar beheer, met het adres van het account
  expect(calls.submit_place![0].body).toMatchObject({
    p_kind: "correctie",
    p_payload: { onderwerp: "vertrektijd", vertrek: "vrij" },
    p_contact_email: USER.email,
  });
  // Concept is weg na versturen
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("vrijstaan-review-concept")))).toEqual([]);
});

test("concept blijft bewaard en de sheet gaat open na terugkomst (#review)", async ({ page }) => {
  await mockRest(page);
  await page.goto(`/plek/${slug}`);
  await page.getByRole("button", { name: "Schrijf een review" }).click();
  await fillReview(page);
  // Terug na inloggen elders: zelfde plek met #review, nu ingelogd
  await signIn(page);
  await page.goto("/over-ons");
  await page.goto(`/plek/${slug}#review`);
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByLabel("Je ervaring *")).toHaveValue(body);
  await expect(sheet.getByRole("button", { name: "8", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(sheet.getByRole("radio", { name: "Geen vaste tijd, je vertrekt wanneer je wilt" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByLabel("Je naam *")).toHaveValue("Kees Kampeerder");
  await expect(sheet.getByTestId("review-account")).toContainText(USER.email);
  await expect(sheet.getByRole("button", { name: "Review versturen" })).toBeVisible();
  await expect(sheet.getByLabel("Je e-mailadres *")).toHaveCount(0);
});
