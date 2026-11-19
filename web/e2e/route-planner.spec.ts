import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

type P = { slug: string; name: string; lat: number; lng: number; checkinFrom?: string; checkinUntil?: string; departure?: string; checkoutUntil?: string };

/** Plekken uit de snapshot, met tijden die we per test zelf bepalen */
async function setup(page: Page, request: import("@playwright/test").APIRequestContext, n: number, patch: (p: P, i: number) => Partial<P> = () => ({})) {
  const all = (await (await request.get("/api/places")).json()) as P[];
  const picked = all.slice(0, n).map((p, i) => ({ ...p, ...patch(p, i) }));
  const bySlug = new Map(picked.map((p) => [p.slug, p]));
  await page.route("**/api/places", (r) => r.fulfill({ json: all.map((p) => bySlug.get(p.slug) ?? p) }));
  // Vaste route: elke etappe 90 minuten en 100 km, lijn langs de stops
  await page.route("**/api/route?**", (r) => {
    const pts = new URL(r.request().url()).searchParams.get("p")!.split(";").map((s) => s.split(",").map(Number));
    const legs = pts.slice(1).map(() => ({ distanceM: 100000, durationS: 5400 }));
    r.fulfill({
      json: { distanceM: legs.length * 100000, durationS: legs.length * 5400, legs, geometry: pts.map(([lat, lng]) => [lng, lat]), provider: "osrm", vehicleApplied: false, avoidApplied: true },
    });
  });
  return { all, picked };
}

const store = (page: Page, key: string, value: unknown) =>
  page.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, JSON.stringify(value)] as [string, string]);

test("dagplanning: vertrek, aankomst en waarschuwingen per etappe", async ({ page, request }) => {
  const { picked } = await setup(page, request, 3, (_, i) =>
    i === 0 ? { departure: "vast", checkoutUntil: "09:00" } : i === 1 ? { checkinFrom: "14:00", checkinUntil: "22:00" } : { checkinUntil: "10:00" },
  );
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await store(page, "vrijstaan:routevoorkeuren", { departTime: "10:00", maxDriveMin: 60 });
  await page.goto("/mijn-reis");
  const times = page.getByTestId("leg-times");
  await expect(times).toHaveCount(2);
  // Plek 1 laat je om 09:00 vertrekken: aankomst 10:30, aankomen kan pas vanaf 14:00
  await expect(times.first()).toContainText("Vertrek 09:00 (uiterlijke vertrektijd van de plek), aankomst rond 10:30");
  await expect(page.getByTestId("leg-early")).toContainText("Aankomen kan vanaf 14:00");
  // Plek 3: aankomen tot 10:00, je bent er pas om 11:30
  await expect(page.getByTestId("leg-late")).toContainText("na de laatste aankomsttijd (10:00)");
  // Elke etappe is langer dan de 1 uur die je wilt
  await expect(page.getByTestId("leg-long")).toHaveCount(2);
  await expect(page.getByTestId("drive-days")).toContainText("2 rijdagen, langste 1 u 30 min");
});

test("tussenstop, notitie, omdraaien en ongedaan maken", async ({ page, request }) => {
  const { picked } = await setup(page, request, 3);
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await page.goto("/mijn-reis");
  const stops = page.getByTestId("trip-stop");
  await expect(stops).toHaveCount(3);

  // Tussenstop: 0 nachten
  await stops.nth(1).getByRole("button", { name: "Een nacht minder" }).click();
  await expect(stops.nth(1).getByText("Tussenstop", { exact: true })).toBeVisible();
  await expect(page.getByTestId("leg-times").nth(1)).toContainText("na de tussenstop");

  // Notitie
  await stops.first().getByRole("button", { name: "Notitie toevoegen" }).click();
  await stops.first().getByRole("textbox").fill("Water bijvullen");
  await stops.first().getByRole("button", { name: "Bewaren" }).click();
  await expect(stops.first().getByTestId("stop-note")).toHaveText("Water bijvullen");

  // Omdraaien en terug
  await page.getByRole("button", { name: "Omdraaien" }).click();
  await expect(stops.first()).toContainText(picked[2].name);
  await page.getByTestId("undo-toast").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(stops.first()).toContainText(picked[0].name);

  // Verwijderen en terug
  await stops.nth(2).getByRole("button", { name: `${picked[2].name} verwijderen` }).click();
  await expect(stops).toHaveCount(2);
  await page.getByTestId("undo-toast").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(stops).toHaveCount(3);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis")!));
  expect(saved.v).toBe(3);
  expect(saved.stops[0]).toEqual({ slug: picked[0].slug, nights: 1, note: "Water bijvullen" });
  expect(saved.stops[1].nights).toBe(0);
});

test("slepen verandert de volgorde", async ({ page, request }, info) => {
  test.skip(info.project.name === "mobile", "slepen met de muis; op de telefoon gelden de pijltjes");
  const { picked } = await setup(page, request, 3);
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await page.goto("/mijn-reis");
  const stops = page.getByTestId("trip-stop");
  await expect(stops).toHaveCount(3);
  // Eerst de route af laten komen: de regels tussen de stops veranderen anders de indeling tijdens het slepen
  await expect(page.getByTestId("leg-times")).toHaveCount(2);
  const grip = stops.first().getByRole("button", { name: `${picked[0].name} verslepen` });
  await grip.scrollIntoViewIfNeeded();
  const box = (await grip.boundingBox())!;
  const target = (await stops.nth(2).boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2 + 10, { steps: 3 });
  await page.mouse.move(x, target.y + target.height + 20, { steps: 25 });
  await page.mouse.up();
  await expect(stops.last()).toContainText(picked[0].name);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis")!).stops.at(-1).slug)).toBe(picked[0].slug);
});

test("Google Maps in delen bij meer dan 10 stops, en een GPX-bestand", async ({ page, request }) => {
  const { picked } = await setup(page, request, 12);
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await page.goto("/mijn-reis");
  const exportPanel = page.getByTestId("export-panel");
  await expect(exportPanel.getByRole("link", { name: /Deel 1: stop 1 t\/m 10/ })).toBeVisible();
  await expect(exportPanel.getByRole("link", { name: /Deel 2: stop 11 t\/m 12/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await exportPanel.getByRole("button", { name: "GPX-bestand" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("mijn-camperreis.gpx");
  // Agenda kan pas met een vertrekdatum
  await expect(exportPanel.getByRole("button", { name: "In je agenda" })).toBeDisabled();
});

test("begin- en eindpunt: adres kiezen, terug naar het begin", async ({ page, request }) => {
  const { picked } = await setup(page, request, 2);
  await page.route("**/api/locatie?q=**", (r) => r.fulfill({ json: { bron: "pdok", resultaten: [{ id: "adr-1", type: "adres", label: "Dorpsstraat 1, Ergens" }] } }));
  await page.route("**/api/locatie?id=**", (r) => r.fulfill({ json: { id: "adr-1", type: "adres", label: "Dorpsstraat 1, Ergens", lat: 52.1, lng: 5.1 } }));
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  const routeCalls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/route?") && routeCalls.push(r.url()));
  await page.goto("/mijn-reis");
  const startCard = page.getByTestId("start-card");
  await startCard.getByRole("button", { name: "Adres kiezen" }).click();
  await startCard.getByLabel("Adres, postcode of plaats").fill("Dorps");
  await startCard.getByRole("button", { name: "Dorpsstraat 1, Ergens" }).click();
  await expect(startCard).toContainText("Dorpsstraat 1, Ergens");
  await page.getByTestId("end-card").getByRole("button", { name: "Terug naar het beginpunt" }).click();
  // Drie etappes: beginpunt, twee stops, terug
  await expect(page.getByTestId("leg-times")).toHaveCount(3);
  // Het huisadres gaat alleen afgerond (2 decimalen) naar de server
  await expect.poll(() => routeCalls.at(-1)).toContain("p=52.10,5.10;");
  expect(routeCalls.at(-1)).toMatch(/;52\.10,5\.10$/);
  const ends = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reispunten")!));
  expect(ends.end).toBe("start");
});

test("plekken langs de route toevoegen als tussenstop", async ({ page, request }) => {
  // Twee stops in een streek zonder andere plekken (Duitsland), zodat alleen de kandidaat langs de route ligt
  const { all, picked } = await setup(page, request, 2, (_, i) => ({ lat: 50.0, lng: 8.0 + i * 0.2 }));
  // Een plek die niet in de reis staat, precies tussen de twee stops
  const between = { lat: (picked[0].lat + picked[1].lat) / 2, lng: (picked[0].lng + picked[1].lng) / 2 };
  const candidate = all.find((p) => !picked.some((x) => x.slug === p.slug))!;
  const moved = all.map((p) => (p.slug === candidate.slug ? { ...p, ...between } : p));
  await page.route("**/api/places", (r) => r.fulfill({ json: moved.map((p) => picked.find((x) => x.slug === p.slug) ?? p) }));
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await page.goto("/mijn-reis");
  await page.getByRole("button", { name: "Langs de route" }).click();
  const panel = page.getByTestId("along-route");
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: `${candidate.name} toevoegen aan je reis` }).click();
  const stops = page.getByTestId("trip-stop");
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(1)).toContainText(candidate.name);
});
