// Review R51: Dichtbij helpt verder als er niets past (voorstellen, Binnen 30 min, actieve filters, Wis filters).
import { expect, test } from "./fixtures";

test.use({ geolocation: { latitude: 52.09, longitude: 5.12 }, permissions: ["geolocation"] });

test("lege staat met voorstellen, Binnen 30 min en Wis filters", async ({ page }) => {
  // Rijtijden nagemaakt: eerst ligt niets binnen 30 minuten, later alleen de eerste plek
  let fast = 0;
  await page.route("**/api/distances**", async (route) => {
    const n = new URL(route.request().url()).searchParams.get("p")!.split(";").length - 1;
    const durationsS = Array.from({ length: n }, (_, i) => (i < fast ? 20 * 60 : 45 * 60));
    await route.fulfill({ json: { distancesM: durationsS.map((s) => s * 15), durationsS } });
  });
  await page.goto("/dichtbij");
  await expect(page.getByRole("heading", { name: "Dichtbij jou" })).toBeVisible();
  await expect(page.getByText(/plekken, dichtstbij eerst \(rijtijd\)/)).toBeVisible();

  // Niets binnen 30 minuten: een voorstel om verder te kijken, met het aantal
  await page.getByRole("button", { name: "Binnen 30 min" }).click();
  await expect(page.getByText("Geen plekken binnen 30 minuten rijden met deze keuzes.")).toBeVisible();
  const empty = page.getByTestId("nearby-empty");
  await empty.getByRole("button", { name: /Ook verder dan 30 minuten \(\d+\)/ }).click();
  await expect(empty).toBeHidden();
  await expect(page.getByRole("button", { name: "Binnen 30 min" })).toHaveAttribute("aria-pressed", "false");

  // Eén plek binnen 30 minuten: "1 plek", niet "1 plekken"
  fast = 1;
  await page.getByRole("button", { name: "Opnieuw" }).click();
  await page.getByRole("button", { name: "Binnen 30 min" }).click();
  await expect(page.getByText("1 plek, dichtstbij eerst (rijtijd).", { exact: false })).toBeVisible();
  const active = page.getByTestId("nearby-active");
  await expect(active).toContainText("Binnen 30 min");

  await active.getByRole("button", { name: "Wis filters" }).click();
  await expect(active).toBeHidden();
  await expect(page.getByRole("button", { name: "Nu open" })).toHaveAttribute("aria-pressed", "false");
});
