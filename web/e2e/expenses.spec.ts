import { expect, PLACES, test } from "./fixtures";

test("uitgaven bijhouden in Mijn reis, naast de begroting", async ({ page }) => {
  const [a, b] = [PLACES[0], PLACES[1]];
  await page.addInitScript(
    ([x, y]) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: x, nights: 2 }, { slug: y, nights: 1 }])),
    [a.slug, b.slug],
  );
  await page.goto("/mijn-reis");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Uitgaven onderweg" }) });
  await expect(panel).toBeVisible();

  // Tankbeurt met liters
  await panel.getByRole("button", { name: "Uitgave" }).click();
  await panel.getByRole("button", { name: "Brandstof" }).click();
  await panel.getByLabel("Bedrag in euro").fill("90");
  await panel.getByLabel("Liters (optioneel)").fill("50");
  await panel.getByRole("button", { name: "Opslaan" }).click();

  // Overnachting bij een stop
  await panel.getByRole("button", { name: "Uitgave" }).click();
  await panel.getByLabel("Bedrag in euro").fill("22,50");
  await panel.getByLabel("Bij welke stop (optioneel)").selectOption(a.slug);
  await panel.getByRole("button", { name: "Opslaan" }).click();

  const summary = panel.getByTestId("expense-summary");
  await expect(summary).toContainText("Uitgegeven");
  await expect(summary).toContainText("112,50");
  await expect(panel).toContainText("gemiddeld € 1,80 per liter");
  await expect(panel).toContainText(a.name);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:uitgaven") ?? "[]"));
  expect(stored).toHaveLength(2);
  expect(stored.find((e: { category: string }) => e.category === "brandstof")).toMatchObject({ amountEur: 90, liters: 50 });

  // Weghalen
  await panel.getByRole("button", { name: /Brandstof van .* weghalen/ }).click();
  await expect(summary).toContainText("22,50");
  await expect(page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:uitgaven") ?? "[]").length)).resolves.toBe(1);
});

test("uitgave zonder geldig bedrag wordt niet bewaard", async ({ page }) => {
  await page.addInitScript((s) => localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: s, nights: 1 }])), PLACES[0].slug);
  await page.goto("/mijn-reis");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: "Uitgaven onderweg" }) });
  await panel.getByRole("button", { name: "Uitgave" }).click();
  await panel.getByLabel("Bedrag in euro").fill("0");
  await panel.getByRole("button", { name: "Opslaan" }).click();
  await expect(panel.getByRole("alert")).toContainText("Vul een bedrag in");
});
