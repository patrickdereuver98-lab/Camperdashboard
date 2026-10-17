import { expect, PLACES, test } from "./fixtures";

const withPower = PLACES.filter((p) => (p as { power?: boolean }).power === true).slice(0, 1);
const without = PLACES.filter((p) => (p as { power?: boolean }).power === false).slice(0, 1);

test("reisstatistieken: kilometers, nachten, stroom en uitgaven", async ({ page }) => {
  const stops = [...withPower.map((p) => ({ slug: p.slug, nights: 2 })), ...without.map((p) => ({ slug: p.slug, nights: 2 }))];
  await page.addInitScript(
    ([s]) => {
      localStorage.setItem("vrijstaan:reis", JSON.stringify(s));
      localStorage.setItem(
        "vrijstaan:uitgaven",
        JSON.stringify([
          { id: "stat-001", date: "2026-10-10", category: "overnachting", amountEur: 40 },
          { id: "stat-002", date: "2026-10-11", category: "brandstof", amountEur: 60, liters: 30 },
        ]),
      );
    },
    [stops],
  );
  await page.route("**/api/route**", (r) => r.fulfill({ json: { distanceM: 123400, durationS: 5400, legs: [], geometry: [] } }));
  await page.goto("/mijn-reis/statistieken");
  const tiles = page.getByTestId("stat-tiles");
  await expect(tiles).toContainText("123 km");
  await expect(tiles).toContainText("4");
  await expect(tiles).toContainText("Zonder stroom");
  await expect(tiles).toContainText("50%");
  await expect(page.getByRole("listitem", { name: "Met stroom: 2 nachten" })).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Zonder stroom: 2 nachten" })).toBeVisible();
  await expect(page.getByText("Totaal € 100, gemiddeld € 50 per dag. Aan overnachtingen € 10 per nacht.")).toBeVisible();
  await page.getByText("Als tabel").last().click();
  await expect(page.getByRole("row", { name: /Brandstof/ })).toBeVisible();
});

test("reisstatistieken zonder reis: uitleg en terug naar Mijn reis", async ({ page }) => {
  await page.goto("/mijn-reis/statistieken");
  await expect(page.getByRole("link", { name: "Naar Mijn reis" })).toBeVisible();
});
