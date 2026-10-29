import { expect, test } from "./fixtures";
import { encodeSummaries } from "../src/lib/summary-wire";
import type { PlaceSummary } from "../src/lib/types";

test("reis met datums: aankomst en vertrek per stop, waarschuwing als de plek dan dicht is", async ({ page, request }) => {
  const all = (await (await request.get("/api/places")).json()) as { slug: string; season?: string; openAllYear?: boolean }[];
  const [a, b] = all.slice(0, 2);
  // Plek a is het hele jaar open, plek b alleen in de zomer
  const patched = all.map((p) =>
    p.slug === a.slug ? { ...p, openAllYear: true, season: undefined } : p.slug === b.slug ? { ...p, openAllYear: false, season: "1 april – 31 oktober" } : p,
  );
  // De browser haalt het compacte formaat op (lib/summary-wire.ts)
  await page.route("**/api/places?f=compact", (r) => r.fulfill({ json: encodeSummaries(patched as unknown as PlaceSummary[]) }));
  await page.addInitScript(
    ([x, y]) => {
      localStorage.setItem("vrijstaan:reis", JSON.stringify([{ slug: x, nights: 2 }, { slug: y, nights: 1 }]));
      localStorage.setItem("vrijstaan:reisdatum", JSON.stringify("2027-10-30"));
    },
    [a.slug, b.slug],
  );
  await page.goto("/mijn-reis");
  const dates = page.getByTestId("stop-dates");
  await expect(dates).toHaveCount(2);
  // Plek b: aankomst 1 november, dus dicht volgens het seizoen
  await expect(page.getByTestId("stop-closed")).toHaveCount(1);
  await expect(page.getByTestId("stop-closed")).toContainText("1 november");
  await page.getByRole("button", { name: "Vertrekdatum wissen" }).click();
  await expect(page.getByTestId("stop-dates")).toHaveCount(0);
});
