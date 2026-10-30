// Wat de site toont (datareview 18 oktober 2026, stap 4: W2, W3, W5 tot W8).
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cardPrice, departureHeadline, markerLabel, departureLong, departureSentence, departureShort, markerPrice } from "../src/lib/format.ts";
import { perPersonPrice, stopSurcharges } from "../src/lib/trip-extras.ts";
import { applyFilters, confirmedFirst, DEFAULT_FILTERS, departureKind, priceRank, timeToMinutes } from "../src/lib/search.ts";
import { knownFacts } from "../src/lib/place-facts.ts";
import type { PlaceSummary } from "../src/lib/types.ts";

const pp = (unit?: string, amount = 7.5) => [{ label: "Per persoon", amount, ...(unit ? { unit } : {}) }];

// ── W2: één prijsregel ──────────────────────────────────────────────────────

test("W2: 'Per persoon' met 'per nacht' is een bekende prijs per persoon per nacht (was 'Prijs onbekend')", () => {
  const c = cardPrice({ priceExtras: pp("per nacht") });
  assert.equal(c?.value, "€\u00a07,50 p.p.");
  assert.equal(c?.perNight, true);
  assert.equal(c?.perPerson, true);
});

test("W2: per persoon per nacht en per persoon tonen we; per persoon zonder nacht telt niet als nachtprijs", () => {
  assert.equal(cardPrice({ priceExtras: pp("per persoon per nacht") })?.perNight, true);
  const c = cardPrice({ priceExtras: pp("per persoon") });
  assert.equal(c?.value, "€\u00a07,50 p.p.");
  assert.equal(c?.perNight, false);
});

test("W2: zonder eenheid, per keer of €0 verzinnen we geen prijs", () => {
  assert.equal(cardPrice({ priceExtras: pp() }), undefined);
  assert.equal(cardPrice({ priceExtras: pp("per keer") }), undefined);
  assert.equal(cardPrice({ priceExtras: pp("per nacht", 0) }), undefined);
  assert.equal(cardPrice({ priceExtras: [{ label: "Hond", amount: 2, unit: "per nacht" }] }), undefined);
  assert.equal(cardPrice({}), undefined);
});

test("W2: een basisprijs gaat voor; per persoon is dan geen prijs voor de kaart", () => {
  const c = cardPrice({ priceEur: 20, priceExtras: pp("per nacht") });
  assert.equal(c?.value, "€\u00a020");
  assert.equal(c?.perPerson, false);
  assert.equal(c?.extras, true);
  assert.equal(cardPrice({ priceEur: 0 })?.perNight, false);
});

test("W2: '+ toeslagen' alleen als er naast de prijs per persoon nog iets anders bekend is", () => {
  assert.equal(cardPrice({ priceExtras: pp("per nacht") })?.extras, false);
  assert.equal(cardPrice({ priceExtras: [...pp("per nacht"), { label: "Hond", amount: 2 }] })?.extras, true);
});

test("W2: kaart en Mijn reis gebruiken dezelfde regel", () => {
  for (const unit of [undefined, "per nacht", "per persoon", "per persoon per nacht", "per keer"]) {
    const place = { priceExtras: pp(unit) };
    const rule = perPersonPrice(place);
    assert.equal(cardPrice(place) !== undefined, rule !== undefined, `kaart, eenheid ${unit}`);
    // Mijn reis rekent alleen met een bedrag per nacht
    assert.equal(stopSurcharges({ nights: 2, place }, 2).stayFromPerPerson !== undefined, rule?.perNight === true, `reis, eenheid ${unit}`);
  }
});

test("W2: de kaartmarker toont dezelfde prijs", () => {
  assert.equal(markerPrice({ priceExtras: pp("per nacht") }), "€\u00a07,50 p.p.");
  assert.equal(markerPrice({ priceEur: 15, priceFrom: true }), "€\u00a015+");
  assert.equal(markerPrice({ priceEur: 0 }), "Gratis");
  assert.equal(markerPrice({ priceExtras: pp() }), "");
});

const place = (slug: string, extra: Partial<PlaceSummary> = {}): PlaceSummary =>
  ({ id: slug, slug, name: slug, town: "X", province: "Utrecht", lat: 52, lng: 5, ratingCount: 0, completeness: 0.5, ...extra }) as PlaceSummary;

test("W2: sorteren op prijs met dezelfde regel: nachtprijs, dan prijs per persoon, dan onbekend", () => {
  const places = [
    place("onbekend"),
    place("pp-zonder-eenheid", { priceExtras: pp() }),
    place("pp", { priceExtras: pp("per nacht", 6) }),
    place("twintig", { priceEur: 20 }),
    place("gratis", { priceEur: 0 }),
  ];
  const order = applyFilters(places, { ...DEFAULT_FILTERS, sort: "prijs" }).map((r) => r.place.slug);
  assert.deepEqual(order.slice(0, 3), ["gratis", "twintig", "pp"]);
  assert.deepEqual(priceRank(places[1]), [2, 0]);
  assert.deepEqual(priceRank(places[2]), [1, 6]);
});

// ── W3: "per 24 uur" blijft staan ───────────────────────────────────────────

test("W3: het label 'per 24 uur' verdwijnt niet bij een niet-bevestigde plek", () => {
  assert.match(departureShort({ departure: "per24" })!, /per 24 uur/i);
  assert.match(departureShort({ departure: "per24", departureCheck: "voorwaardelijk" })!, /per 24 uur/i);
  assert.match(departureShort({ departure: "per24", departureCheck: "bevestigd" })!, /per 24 uur/i);
  assert.match(departureLong({ departure: "per24" }), /per 24 uur/i);
  assert.match(departureLong({ departure: "per24", departureCheck: "voorwaardelijk" }), /per 24 uur/i);
  assert.match(departureLong({ departure: "per24", departureCheck: "bevestigd" }), /per 24 uur/i);
});

test("W3: afgewezen en onbekend blijven onbekend; vrij ongewijzigd", () => {
  assert.equal(departureShort({ departure: "per24", departureCheck: "afgewezen" }), undefined);
  assert.equal(departureLong({ departure: "per24", departureCheck: "afgewezen" }), "Onbekend");
  assert.equal(departureLong({}), "Onbekend");
  assert.equal(departureShort({ departure: "vrij" }), "Geen vaste vertrektijd");
  assert.equal(departureLong({ departure: "vrij" }), "Geen vaste vertrektijd");
  assert.equal(departureLong({ departure: "vast", checkoutUntil: "11:00" }), "Uiterlijk 11:00");
});

test("geen gedachtestreepjes in de vertrekregels", () => {
  const facts = [{}, { departure: "vrij" }, { departure: "per24" }, { departure: "vast" }, { departure: "vast", checkoutUntil: "12:00" }] as const;
  for (const f of facts)
    for (const check of [undefined, "bevestigd", "voorwaardelijk"] as const) {
      const p = { ...f, departureCheck: check };
      assert.doesNotMatch(`${departureShort(p) ?? ""} ${departureLong(p)}`, /[—–]/);
    }
});

// ── W6: bevestigd eerst in elke sortering ───────────────────────────────────

test("W6: bij gelijke prijs staat bevestigd 'geen vaste vertrektijd' eerst; de prijs blijft voorgaan", () => {
  const places = [
    place("kandidaat", { priceEur: 10, departure: "vrij" }),
    place("bevestigd", { priceEur: 10, departure: "vrij", departureCheck: "bevestigd" }),
    place("goedkoper", { priceEur: 5, departure: "vast", checkoutUntil: "11:00" }),
  ];
  const order = applyFilters(places, { ...DEFAULT_FILTERS, sort: "prijs" }).map((r) => r.place.slug);
  assert.deepEqual(order, ["goedkoper", "bevestigd", "kandidaat"]);
});

test("W6: bij gelijke afstand staat bevestigd eerst", () => {
  const places = [place("kandidaat", { departure: "per24" }), place("bevestigd", { departure: "per24", departureCheck: "bevestigd" })];
  const order = applyFilters(places, { ...DEFAULT_FILTERS, center: { lat: 52, lng: 5 }, sort: "afstand" }).map((r) => r.place.slug);
  assert.deepEqual(order, ["bevestigd", "kandidaat"]);
});

test("W6: bij gelijke score staat bevestigd eerst", () => {
  const places = [place("kandidaat", { departure: "vrij" }), place("bevestigd", { departure: "vrij", departureCheck: "bevestigd" })];
  assert.deepEqual(applyFilters(places, { ...DEFAULT_FILTERS, sort: "score" }).map((r) => r.place.slug), ["bevestigd", "kandidaat"]);
});

test("W6: confirmedFirst is alleen een tweede sleutel", () => {
  assert.ok(confirmedFirst({ departure: "vrij", departureCheck: "bevestigd" }, { departure: "vrij" }) < 0);
  assert.equal(confirmedFirst({ departure: "vrij" }, { departure: "vast", checkoutUntil: "12:00" }), 0);
  assert.equal(confirmedFirst({ departure: "vrij", departureCheck: "voorwaardelijk" }, {}), 0);
});

test("W6: het lengtefilter laat plekken met onbekende lengte staan", () => {
  const places = [place("kort", { maxLengthM: 6 }), place("lang", { maxLengthM: 9 }), place("onbekend")];
  const slugs = applyFilters(places, { ...DEFAULT_FILTERS, minLength: 7.4 }).map((r) => r.place.slug).sort();
  assert.deepEqual(slugs, ["lang", "onbekend"]);
});

// ── W8: vertrektijden als minuten ───────────────────────────────────────────

test("W8: tijden als minuten, niet als tekst", () => {
  assert.equal(timeToMinutes("11:30"), 690);
  assert.equal(timeToMinutes("9.00"), 540);
  assert.equal(timeToMinutes("25:00"), undefined);
  assert.equal(timeToMinutes("morgen"), undefined);
  assert.equal(timeToMinutes(undefined), undefined);
  // Als tekst is "9:00" groter dan "12:00"; als minuten is het vroeg
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "9:00" }), "vroeg");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "9:30" }), "vroeg");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "12.00" }), "uitslapers");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "onbekend" }), "onbekend");
});

// ── W7: de teller klopt met wat de pagina toont ─────────────────────────────

const fact = (p: Parameters<typeof knownFacts>[0], label: string) => knownFacts(p).find((f) => f.label === label)!.known;

test("W7: de teller telt 12 gegevens", () => {
  assert.equal(knownFacts({}).length, 12);
  assert.equal(knownFacts({}).filter((f) => f.known).length, 0);
});

test("W7: een afgewezen vertrekregel staat als 'Onbekend' op de pagina en telt dus niet als bekend", () => {
  assert.equal(fact({ departure: "vrij", departureCheck: "afgewezen" }, "vertrektijd"), false);
  assert.equal(fact({ departure: "per24" }, "vertrektijd"), true);
  assert.equal(fact({ departure: "vast" }, "vertrektijd"), true);
});

test("W7: toeristenbelasting is alleen bekend als de pagina er iets over zegt", () => {
  assert.equal(fact({ priceExtras: [{ label: "Hond", amount: 2 }] }, "toeristenbelasting"), false);
  assert.equal(fact({ priceExtras: [{ label: "Toeristenbelasting", amount: 1.2 }] }, "toeristenbelasting"), true);
  assert.equal(fact({ touristTaxIncluded: false }, "toeristenbelasting"), true);
});

test("W7: prijs volgt dezelfde regel als de kaart", () => {
  assert.equal(fact({ priceExtras: pp() }, "prijs"), false);
  assert.equal(fact({ priceExtras: pp("per nacht") }, "prijs"), true);
  assert.equal(fact({ priceEur: 0 }, "prijs"), true);
});

// ── Na review (react-reviewer) ──────────────────────────────────────────────

test("een prijs per nacht gaat voor 'per persoon' zonder nacht, ook als die eerst staat", () => {
  const r = perPersonPrice({ priceExtras: [{ label: "Per persoon", amount: 4, unit: "per persoon" }, { label: "Per persoon", amount: 6, unit: "per nacht" }] });
  assert.equal(r?.amount, 6);
  assert.equal(r?.perNight, true);
});

test("een onleesbare vertrektijd tonen we als vaste vertrektijd zonder tijd, net als departureKind", () => {
  const p = { departure: "vast" as const, checkoutUntil: "na de lunch" };
  assert.equal(departureShort(p), "Vaste vertrektijd");
  assert.equal(departureLong(p), "Vaste vertrektijd");
  assert.equal(departureKind(p), "onbekend");
  assert.equal(departureShort({ departure: "vast", checkoutUntil: "10:30" }), "Vertrek uiterlijk 10:30");
});

// ── Besluit eigenaar 18 oktober 2026: een bron is genoeg bevestiging ────────

test("geen label 'nog niet bevestigd' meer: een regel uit de bron ziet eruit als een bevestigde", () => {
  for (const departure of ["vrij", "per24"] as const) {
    assert.equal(departureShort({ departure }), departureShort({ departure, departureCheck: "bevestigd" }));
    assert.equal(departureLong({ departure }), departureLong({ departure, departureCheck: "bevestigd" }));
    assert.doesNotMatch(`${departureShort({ departure })} ${departureLong({ departure })}`, /bevestigd/i);
  }
  assert.equal(departureShort({ departure: "per24" }), "Per 24 uur, geen vaste tijd");
});

test("afgewezen blijft onbekend; voorwaardelijk houdt zijn eigen regel", () => {
  assert.equal(departureShort({ departure: "vrij", departureCheck: "afgewezen" }), undefined);
  assert.equal(departureLong({ departure: "per24", departureCheck: "afgewezen" }), "Onbekend");
  assert.equal(departureShort({ departure: "vrij", departureCheck: "voorwaardelijk" }), "Meestal geen vaste vertrektijd");
  assert.equal(departureKind({ departure: "vrij" }), "vrij");
  assert.equal(departureKind({ departure: "vrij", departureCheck: "voorwaardelijk" }), "onbekend");
});


test("B7: vertrekregel als kop van de kaart en als zin op de plekpagina; onbekend blijft leeg", () => {
  assert.equal(departureHeadline({ departure: "vrij" }), "Weg wanneer je wilt");
  assert.equal(departureHeadline({ departure: "per24" }), "Per 24 uur, geen vaste tijd");
  assert.equal(departureHeadline({ departure: "vast", checkoutUntil: "11:30" }), "Uiterlijk 11:30 weg");
  assert.equal(departureHeadline({ departure: "vast" }), "Vaste vertrektijd");
  assert.equal(departureHeadline({ departure: "vrij", departureCheck: "voorwaardelijk" }), "Meestal geen vaste vertrektijd");
  assert.equal(departureHeadline({ departure: "vrij", departureCheck: "afgewezen" }), undefined);
  assert.equal(departureHeadline({}), undefined);
  assert.equal(departureSentence({ departure: "vrij" }), "Je mag blijven tot je zelf weg wilt.");
  assert.equal(departureSentence({ departure: "per24" }), "Geen vaste vertrektijd. Je betaalt per 24 uur.");
  assert.equal(departureSentence({ departure: "vast", checkoutUntil: "11:30" }), "Je moet uiterlijk om 11:30 weg.");
  assert.equal(departureSentence({ departure: "vast" }), "Er is een vaste vertrektijd. Welke weten we nog niet.");
  assert.equal(departureSentence({ departure: "per24", departureCheck: "voorwaardelijk" }), "Meestal per 24 uur.");
  assert.equal(departureSentence({}), undefined);
});

test("kaartlabel: tijd en prijs op twee regels; onbekend blijft weg", () => {
  assert.equal(markerLabel({ departure: "vast", checkoutUntil: "12:00", priceEur: 10 }), "12:00\n€\u00a010");
  assert.equal(markerLabel({ departure: "vrij" }), "Vrij");
  assert.equal(markerLabel({ departure: "per24", priceEur: 0 }).split("\n")[0], "24 uur");
  assert.equal(markerLabel({ priceEur: 8 }).includes("\n"), false);
  assert.equal(markerLabel({ departure: "vrij", departureCheck: "afgewezen" }), "");
});
