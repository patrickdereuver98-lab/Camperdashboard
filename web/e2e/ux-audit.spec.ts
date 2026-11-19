import { expect, test } from "./fixtures";

// UX-audit november: slimme zoekbalk, filters onthouden, snelmenu, ongedaan maken, delen naar VrijStaan

test("zoekvak begrijpt filters in gewone taal (Z2)", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Waar wil je staan?" });
  await box.fill("gratis texel met stroom");
  await expect(page.getByRole("listbox")).toContainText("Met filters: gratis, stroom");
  await expect(page.getByRole("option", { name: /Texel/ }).first()).toBeVisible();
  await box.press("Enter");
  await expect(page).toHaveURL(/\/zoeken\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get("waar")).toBe("Texel");
  expect(url.searchParams.get("gratis")).toBe("1");
  expect(url.searchParams.get("v")).toContain("stroom");
});

test("leeg zoekvak toont wat je eerder zocht en bekeek (Z1)", async ({ page }) => {
  await page.goto("/");
  const box = page.getByRole("combobox", { name: "Waar wil je staan?" });
  await box.fill("Zeeland");
  await page.getByRole("option", { name: /Zeeland/ }).first().click();
  await expect(page).toHaveURL(/provincie=Zeeland/);
  await page.locator('article[data-slug]:visible a[href^="/plek/"]').first().click();
  await expect(page).toHaveURL(/\/plek\//);
  // Zichtbare kop: Next houdt de zoekpagina verborgen in het geheugen
  const name = (await page.locator("h1:visible").first().innerText()).trim();
  await page.goto("/");
  await page.getByRole("combobox", { name: "Waar wil je staan?" }).focus();
  const list = page.getByRole("listbox");
  await expect(list).toContainText("Eerder gezocht");
  await expect(list).toContainText("Zeeland");
  await expect(list).toContainText("Laatst bekeken");
  await expect(list).toContainText(name);
  await list.getByRole("button", { name: "Wis geschiedenis" }).click();
  await expect(list).not.toContainText("Eerder gezocht");
});

test("alleen een filter typen zet dat filter aan (Z3)", async ({ page }) => {
  await page.goto("/zoeken?provincie=Utrecht&waar=Utrecht");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  const box = page.getByRole("combobox", { name: "Waar wil je staan?" });
  await box.fill("honden");
  await page.getByRole("option", { name: /Filter: honden welkom/ }).click();
  await expect(page).toHaveURL(/v=[^&]*honden/);
  await expect(page).toHaveURL(/provincie=Utrecht/);
});

test("tabblad Zoeken brengt je terug naar je filters", async ({ page, isMobile }) => {
  test.skip(!isMobile, "De tabbalk staat alleen op de telefoon");
  await page.goto("/zoeken?gratis=1&provincie=Zeeland&waar=Zeeland");
  await expect(page.locator("article[data-slug]").first()).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Hoofdmenu" });
  // Pas na het laden weet de tabbalk je zoekopdracht
  await expect(nav.getByRole("link", { name: "Zoeken" })).toHaveAttribute("href", /gratis=1/);
  await nav.getByRole("link", { name: "Mijn reis" }).click();
  await expect(page).toHaveURL(/\/mijn-reis/);
  await nav.getByRole("link", { name: "Zoeken" }).click();
  await expect(page).toHaveURL(/gratis=1/);
  await expect(page).toHaveURL(/provincie=Zeeland/);
});

test("snelmenu op een plek in de lijst (G5)", async ({ page }) => {
  await page.goto("/zoeken");
  const row = page.locator("article[data-slug]").first();
  await expect(row).toBeVisible();
  const name = (await row.locator("h3").innerText()).trim();
  const menu = page.getByRole("dialog", { name });
  // De rij staat al in de HTML; het menu werkt pas na het laden van de pagina, dus zo nodig nog eens
  await expect(async () => {
    await row.click({ button: "right" });
    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
  await menu.getByRole("button", { name: "Bewaren in Mijn reis" }).click();
  await expect(menu).toBeHidden();
  await expect(row.getByRole("button", { name: `${name} bewaren in Mijn reis` })).toHaveAttribute("aria-pressed", "true");
  // Nog steeds op de lijst: het menu volgde de link niet
  await expect(page).toHaveURL(/\/zoeken/);
});

test("weghalen uit Mijn reis kun je ongedaan maken (U1)", async ({ page }) => {
  await page.goto("/zoeken");
  const rows = page.locator("article[data-slug]");
  await expect(rows.first()).toBeVisible();
  const names: string[] = [];
  for (const i of [0, 1]) {
    const name = (await rows.nth(i).locator("h3").innerText()).trim();
    names.push(name);
    await rows.nth(i).getByRole("button", { name: `${name} bewaren in Mijn reis` }).click();
  }
  await page.goto("/mijn-reis");
  await expect(page.getByRole("link", { name: names[0] })).toBeVisible();
  await page.getByRole("button", { name: `${names[0]} verwijderen` }).click();
  await expect(page.getByRole("link", { name: names[0] })).toHaveCount(0);
  await page.getByRole("button", { name: "Ongedaan maken" }).click();
  // Terug op de eerste plek
  await expect(page.locator("ol > li").first()).toContainText(names[0]);
});

test("delen naar VrijStaan: een Google Maps-link opent Zoeken rond dat punt", async ({ page }) => {
  await page.goto(`/delen?title=Texel&url=${encodeURIComponent("https://www.google.com/maps/place/Texel/@53.0548,4.7977,11z")}`);
  await expect(page).toHaveURL(/\/zoeken\?.*lat=53\.05480/);
  await expect(page.locator("h1").filter({ hasText: "Texel" })).toBeVisible();
});

test("plekpagina: vorige en volgende uit je zoekresultaten", async ({ page }) => {
  await page.goto("/zoeken");
  const rows = page.locator("article[data-slug]");
  await expect(rows.nth(1)).toBeVisible();
  const second = (await rows.nth(1).locator("h3").innerText()).trim();
  await rows.first().locator('a[href^="/plek/"]').first().click();
  const nav = page.getByRole("navigation", { name: "Zoekresultaten" });
  await expect(nav).toContainText("1 van");
  await nav.getByRole("link", { name: second }).click();
  await expect(page.locator("h1:visible").first()).toHaveText(second);
});
