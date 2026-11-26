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
  await expect(stops.first().getByTestId("stop-note-text")).toHaveText("Water bijvullen");
  // Standaard privé
  await expect(stops.first().getByTestId("stop-note-scope")).toHaveText("Privé");

  // Omdraaien en terug
  // Omdraaien zit in het menu Meer reisopties (ontwerpronde 2)
  await page.getByRole("button", { name: "Meer reisopties" }).click();
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
  expect(saved.v).toBe(4);
  const first = saved.trips[0].stops[0];
  expect(first).toMatchObject({ slug: picked[0].slug, nights: 1 });
  expect(first.notes).toHaveLength(1);
  expect(first.notes[0].text).toBe("Water bijvullen");
  expect(first.notes[0].shared).toBeUndefined();
  expect(saved.trips[0].stops[1].nights).toBe(0);
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
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis") ?? "null")?.trips?.[0]?.stops?.at(-1)?.slug)).toBe(picked[0].slug);
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
  // Start en vertrekdatum staan in een inklapbaar blok (ontwerpronde 2)
  await page.getByTestId("trip-setup").locator("summary").click();
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

test("te lange dag: overnachtingen voorstellen, toevoegen doe je zelf", async ({ page, request }) => {
  // Twee stops in een streek zonder andere plekken (Duitsland); elke etappe duurt 90 minuten, je wilt er 60 rijden
  const { all, picked } = await setup(page, request, 2, (_, i) => ({ lat: 50.0, lng: 8.0 + i * 0.3 }));
  const others = all.filter((p) => !picked.some((x) => x.slug === p.slug));
  // Twee plekken rond het punt waar de dag vol is (2/3 van de etappe): een met vaste vertrektijd, een zonder
  const at = (f: number) => ({ lat: 50.0, lng: 8.0 + 0.3 * f });
  const fixed = { ...others[0], ...at(0.62), departure: "vast", checkoutUntil: "10:00", departureCheck: undefined };
  const free = { ...others[1], ...at(0.7), departure: "vrij", departureCheck: undefined };
  const moved = new Map([fixed, free].map((p) => [p.slug, p]));
  await page.route("**/api/places", (r) => r.fulfill({ json: all.map((p) => picked.find((x) => x.slug === p.slug) ?? moved.get(p.slug) ?? p) }));
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await store(page, "vrijstaan:routevoorkeuren", { departTime: "10:00", maxDriveMin: 60, pauseMin: 0 });
  await page.goto("/mijn-reis");
  const box = page.getByTestId("overnight");
  await expect(box).toBeVisible();
  const items = box.getByTestId("overnight-place");
  await expect(items).toHaveCount(2);
  // Zonder vaste vertrektijd eerst
  await expect(items.first()).toContainText(free.name);
  await expect(items.nth(1)).toContainText(fixed.name);
  // Huisregel: de naam is een tikdoel van minstens 44 px hoog (CI vond 20 px, release 0.9.2)
  const link = items.first().getByRole("link", { name: free.name });
  // Wachten tot de lijst is ingeschoven (animatie): daarna is het vlak op volle grootte
  await expect.poll(async () => (await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  // Er is niets vanzelf toegevoegd
  const stops = page.getByTestId("trip-stop");
  await expect(stops).toHaveCount(2);
  await items.first().getByRole("button", { name: `${free.name} toevoegen als overnachting` }).click();
  await expect(stops).toHaveCount(3);
  await expect(stops.nth(1)).toContainText(free.name);
  await expect(stops.nth(1)).toContainText("1 nacht");
  // Een plek die al in de reis staat stellen we niet nog eens voor; terugdraaien kan
  await expect(page.getByTestId("overnight-place").filter({ hasText: free.name })).toHaveCount(0);
  await page.getByTestId("undo-toast").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(stops).toHaveCount(2);
});

test("meerdere reizen en een eigen punt: aanmaken, punt toevoegen, hernoemen, wisselen, verwijderen en terugzetten", async ({ page, request }) => {
  const { picked } = await setup(page, request, 2);
  await page.route("**/api/locatie?q=**", (r) => r.fulfill({ json: { bron: "pdok", resultaten: [{ id: "adr-1", type: "adres", label: "Dorpsstraat 1, Ergens" }] } }));
  await page.route("**/api/locatie?id=**", (r) => r.fulfill({ json: { id: "adr-1", type: "adres", label: "Dorpsstraat 1, Ergens", lat: 52.1234, lng: 5.1234 } }));
  // Oude opslag (versie 3): wordt de eerste reis
  await store(page, "vrijstaan:reis", { v: 3, stops: picked.map((p) => ({ slug: p.slug, nights: 1 })) });
  await page.goto("/mijn-reis");
  await expect(page.getByTestId("trip-name")).toHaveText("Mijn reis");
  await expect(page.getByTestId("trip-stop")).toHaveCount(2);

  // Nieuwe reis
  await page.getByRole("button", { name: "Reizen" }).click();
  await page.getByRole("button", { name: "Nieuwe reis" }).click();
  await page.getByLabel("Naam van de nieuwe reis").fill("Ardennen");
  await page.getByRole("button", { name: "Reis maken" }).click();
  await expect(page.getByTestId("trip-name")).toHaveText("Ardennen");
  await expect(page.getByRole("heading", { name: "Je reis is nog leeg" })).toBeVisible();

  // Eigen punt via een adres, met eigen naam
  await page.getByRole("button", { name: "Eigen punt toevoegen" }).click();
  const add = page.getByTestId("add-point");
  await add.getByRole("button", { name: "Adres zoeken" }).click();
  await add.getByLabel("Adres, postcode of plaats").fill("Dorps");
  await add.getByRole("button", { name: "Dorpsstraat 1, Ergens" }).click();
  await expect(add.getByLabel("Naam")).toHaveValue("Ergens");
  await add.getByLabel("Naam").fill("Oma");
  await add.getByRole("button", { name: "Toevoegen aan je reis" }).click();
  const stops = page.getByTestId("trip-stop");
  await expect(stops).toHaveCount(1);
  await expect(stops.first()).toContainText("Oma");
  // Duidelijk anders: geen link naar een plekpagina, wel "Eigen punt" en geen plekgegevens
  await expect(stops.first().getByTestId("own-point")).toContainText("Eigen punt");
  await expect(stops.first().getByRole("link", { name: "Oma" })).toHaveCount(0);

  // Hernoemen
  await page.getByRole("button", { name: /Reizen/ }).click();
  await page.getByRole("button", { name: "Naam wijzigen" }).click();
  await page.getByLabel("Naam van deze reis").fill("Ardennen 2027");
  await page.getByRole("button", { name: "Bewaren" }).click();
  await expect(page.getByTestId("trip-name")).toHaveText("Ardennen 2027");

  // Wisselen naar de eerste reis
  await page.getByTestId("trip-list").getByRole("button", { name: /^Mijn reis/ }).click();
  await expect(page.getByTestId("trip-name")).toHaveText("Mijn reis");
  await expect(stops).toHaveCount(2);

  // Verwijderen met ongedaan maken
  await page.getByRole("button", { name: "Reis verwijderen" }).click();
  await expect(page.getByTestId("trip-name")).toHaveText("Ardennen 2027");
  await expect(page.getByTestId("undo-toast")).toContainText("Mijn reis is verwijderd.");
  await page.getByTestId("undo-toast").getByRole("button", { name: "Ongedaan maken" }).click();
  await expect(page.getByTestId("trip-name")).toHaveText("Mijn reis");
  await expect(stops).toHaveCount(2);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vrijstaan:reis")!));
  expect(saved.v).toBe(4);
  expect(saved.trips.map((t: { name: string }) => t.name)).toEqual(["Mijn reis", "Ardennen 2027"]);
  expect(saved.trips[1].stops[0]).toMatchObject({ nights: 0, point: { name: "Oma", lat: 52.1234, lng: 5.1234, kind: "adres" } });
});

test("eigen punt gaat alleen afgerond naar de routeplanner", async ({ page, request }) => {
  const { picked } = await setup(page, request, 1);
  await store(page, "vrijstaan:reis", {
    v: 4,
    active: "reis-1",
    trips: [{ id: "reis-1", name: "Mijn reis", stops: [{ slug: picked[0].slug, nights: 1 }, { slug: "eigen-oma", nights: 1, point: { name: "Oma", lat: 52.12345, lng: 5.12345, kind: "kaart" } }] }],
  });
  const routeCalls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/route?") && routeCalls.push(r.url()));
  await page.goto("/mijn-reis");
  await expect(page.getByTestId("leg-times")).toHaveCount(1);
  expect(routeCalls.at(-1)).toMatch(/;52\.12,5\.12$/);
  // Overnachten bij een eigen punt telt niet mee in de kosten, en dat staat erbij
  await expect(page.getByTestId("own-nights")).toHaveText("1 eigen punt telt niet mee");
});
