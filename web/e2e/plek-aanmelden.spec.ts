// G2, G3 en G4 (27 november 2026): Doe mee met één primaire actie, Plek aanmelden in vier stappen,
// fouten bij het veld en een bevestiging met de controletermijn.
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { SUPABASE } from "./session";

async function mock(page: Page, fail = false) {
  const sent: { body?: Record<string, unknown> } = {};
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop();
    if (name === "submit_place") {
      if (fail) return r.fulfill({ status: 400, json: { message: "Het is even erg druk. Probeer het later opnieuw." } });
      sent.body = r.request().postDataJSON();
      return r.fulfill({ json: "33333333-3333-4333-8333-333333333333" });
    }
    await r.fulfill(r.request().method() === "GET" ? { json: [] } : { json: null });
  });
  return sent;
}

const next = (page: Page) => page.getByRole("button", { name: "Volgende" }).click();
const heading = (page: Page, t: string) => page.getByRole("heading", { level: 2, name: new RegExp(t) });

/** Vult stap 1 en 2 in en staat daarna op stap 3 */
async function toStep3(page: Page, name = "Weide bij de Maas") {
  await page.getByLabel(/Naam van de plek/).fill(name);
  await next(page);
  await page.getByLabel(/Plaats/).fill("Gennep");
  await page.getByLabel(/Provincie/).selectOption("Limburg");
  await next(page);
}

test("Doe mee: één primaire actie, aanmelden als tweede, eigenaren onderaan", async ({ page }) => {
  await page.goto("/doe-mee");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ken je een plek of weet je iets dat niet klopt?");
  await expect(page.getByRole("main").getByRole("link", { name: "Plek zoeken" })).toHaveAttribute("href", "/zoeken");
  await expect(page.getByRole("main").getByRole("link", { name: "Plek aanmelden" })).toHaveAttribute("href", "/plek-aanmelden");
  await expect(page.getByRole("link", { name: "Meld je plek als eigenaar" })).toHaveAttribute("href", "/plek-aanmelden?soort=eigenaar");
  await expect(page.getByRole("heading", { name: "Weet je een vertrektijd?" })).toBeVisible();
});

test("stappen: fout bij het veld, focus naar de kop, invoer blijft bij terug", async ({ page }) => {
  await mock(page);
  await page.goto("/plek-aanmelden");
  await expect(heading(page, "Stap 1 van 4")).toBeVisible();

  await next(page);
  const name = page.getByLabel(/Naam van de plek/);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toBeFocused();
  const describedBy = await name.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${describedBy}"]`)).toContainText("Vul de naam van de plek in");

  await name.fill("Weide bij de Maas");
  await next(page);
  await expect(heading(page, "Stap 2 van 4")).toBeFocused();

  await next(page);
  await expect(page.getByLabel(/Plaats/)).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel(/Plaats/).fill("Gennep");
  await next(page);
  await expect(page.getByLabel(/Provincie/)).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel(/Provincie/).selectOption("Limburg");
  await next(page);
  await expect(heading(page, "Stap 3 van 4")).toBeFocused();

  await page.getByRole("button", { name: "Vorige" }).click();
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(heading(page, "Stap 1 van 4")).toBeFocused();
  await expect(name).toHaveValue("Weide bij de Maas");
  await next(page);
  await expect(page.getByLabel(/Plaats/)).toHaveValue("Gennep");
  await expect(page.getByLabel(/Provincie/)).toHaveValue("Limburg");
});

test("verzenden stuurt dezelfde payload als eerder en toont de bevestiging met termijn", async ({ page }) => {
  const sent = await mock(page);
  await page.goto("/plek-aanmelden");
  await page.getByLabel(/Naam van de plek/).fill("Weide bij de Maas");
  await next(page);
  await page.getByLabel(/Plaats/).fill("Gennep");
  await page.getByLabel(/Provincie/).selectOption("Limburg");
  await page.getByLabel(/Adres/).fill("Maasweg 1");
  await next(page);
  await page.getByRole("radio", { name: /Op een vaste tijd/ }).click();
  await page.locator('input[name="checkout"]').fill("10:30");
  await page.getByLabel(/Prijs per nacht/).fill("12,50");
  await page.getByLabel("Website").fill("www.maasweide.nl");
  await next(page);
  // Contact is optioneel voor wie een plek kent
  await page.getByRole("button", { name: "Plek aanmelden" }).click();
  await expect(page.getByTestId("success-note")).toContainText("meestal binnen twee werkdagen");
  expect(sent.body).toMatchObject({
    p_kind: "nieuw",
    p_place_id: null,
    p_payload: {
      naam: "Weide bij de Maas",
      plaats: "Gennep",
      provincie: "Limburg",
      adres: "Maasweg 1",
      website: "https://www.maasweide.nl",
      prijs_per_nacht: "12,50",
      vertrek: "vast",
      vertrek_uiterlijk: "10:30",
      voorzieningen: {},
    },
    p_contact_name: "",
    p_contact_email: "",
  });
});

test("eigenaar-variant: soort uit de link, naam en e-mail verplicht bij de laatste stap", async ({ page }) => {
  const sent = await mock(page);
  await page.goto("/plek-aanmelden?soort=eigenaar");
  await expect(page.getByRole("radio", { name: "Ik ben eigenaar" })).toBeChecked();
  await toStep3(page, "Camping De Kolk");
  await next(page);
  await page.getByRole("button", { name: "Plek aanmelden" }).click();
  const contactName = page.locator('input[name="contact_name"]');
  await expect(contactName).toHaveAttribute("aria-invalid", "true");
  await expect(contactName).toBeFocused();
  await contactName.fill("Anna de Vries");
  await page.getByRole("button", { name: "Plek aanmelden" }).click();
  await expect(page.locator('input[name="contact_email"]')).toHaveAttribute("aria-invalid", "true");
  await page.locator('input[name="contact_email"]').fill("anna@voorbeeld.nl");
  await page.getByRole("button", { name: "Plek aanmelden" }).click();
  await expect(page.getByTestId("success-note")).toBeVisible();
  expect(sent.body).toMatchObject({ p_kind: "eigenaar", p_contact_name: "Anna de Vries", p_contact_email: "anna@voorbeeld.nl" });
});

test("serverfout: de melding staat er en de invoer blijft", async ({ page }) => {
  await mock(page, true);
  await page.goto("/plek-aanmelden");
  await toStep3(page);
  await next(page);
  await page.getByRole("button", { name: "Plek aanmelden" }).click();
  await expect(page.locator('form [role="alert"]')).toContainText("erg druk");
  await page.getByRole("button", { name: "Vorige" }).click();
  await page.getByRole("button", { name: "Vorige" }).click();
  await page.getByRole("button", { name: "Vorige" }).click();
  await expect(page.getByLabel(/Naam van de plek/)).toHaveValue("Weide bij de Maas");
});

test("Enter in een tekstveld gaat naar de volgende stap, met de fout bij het veld als het leeg is", async ({ page }) => {
  const sent = await mock(page);
  await page.goto("/plek-aanmelden");
  const name = page.getByLabel(/Naam van de plek/);
  await name.press("Enter");
  await expect(heading(page, "Stap 1 van 4")).toBeVisible();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("Weide bij de Maas");
  await name.press("Enter");
  await expect(heading(page, "Stap 2 van 4")).toBeVisible();
  await page.getByLabel(/Plaats/).fill("Gennep");
  await page.getByLabel(/Provincie/).selectOption("Limburg");
  await page.getByLabel(/Plaats/).press("Enter");
  await expect(heading(page, "Stap 3 van 4")).toBeVisible();
  // Nog niets verstuurd: Enter verstuurt alleen op de laatste stap
  expect(sent.body).toBeUndefined();
});
