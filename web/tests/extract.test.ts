// Extractor van de pipeline: alleen wat letterlijk op de website staat, niets afleiden.
import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalDeparture, extract } from "../supabase/functions/pipeline/extract";

const base = new URL("https://camper.example.nl/");
const page = (html: string) => extract([html], base) as Record<string, unknown>;

test("geen vaste vertrektijd wordt 'vrij'", () => {
  const r = page("<p>Er is geen vaste vertrektijd, je vertrekt wanneer je wilt.</p>");
  assert.equal(r.departure, "vrij");
  assert.equal(r.checkout_until, undefined);
});

test("betalen per 24 uur wordt 'per24'", () => {
  assert.equal(page("<p>Je betaalt per 24 uur vanaf aankomst.</p>").departure, "per24");
});

test("vaste vertrektijd met punt als scheiding", () => {
  const r = page("<p>Uitchecken voor 12.00 uur.</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "12:00");
});

test("aankomst en vertrek in één tekst", () => {
  const r = arrivalDeparture("aankomst vanaf 14.00 uur. vertrek voor 11.00 uur.", "Aankomst vanaf 14.00 uur. Vertrek voor 11.00 uur.");
  assert.equal(r.checkin_from, "14:00");
  assert.equal(r.checkout_until, "11:00");
});

test("bij 'tussen 9.00 en 11.00' telt het eind als vertrektijd", () => {
  assert.equal(arrivalDeparture("vertrek tussen 9.00 en 11.00 uur", "vertrek tussen 9.00 en 11.00 uur").checkout_until, "11:00");
});

test("zonder vermelding blijft de vertrektijd leeg", () => {
  const r = page("<p>Mooie plek aan het water met stroom.</p>");
  assert.equal(r.departure, undefined);
  assert.equal(r.checkout_until, undefined);
});

test("ontkenning gaat voor: 'honden niet toegestaan'", () => {
  const r = page("<p>Honden zijn niet toegestaan.</p><p>Stroom aanwezig.</p>");
  assert.equal(r.dogs, false);
  assert.equal(r.power, true);
});

test("seizoen uit 'van 1 april tot 31 oktober'", () => {
  const r = page("<p>Geopend van 1 april tot 31 oktober.</p>");
  assert.equal(r.open_all_year, false);
  assert.equal(r.season, "1 april – 31 oktober");
});

test("camperplaats met automaat: prijs per 24 uur wordt 'per24'", () => {
  assert.equal(page("<p>Camperplaats aan de haven. Tarief: € 12,50 per 24 uur, te betalen bij de automaat.</p>").departure, "per24");
  assert.equal(page("<p>Stellplatz am Hafen: 10 Euro pro 24 Stunden für Wohnmobile.</p>").departure, "per24");
});

test("per 24 uur zonder campers, of met een vaste vertrektijd, telt niet", () => {
  assert.equal(page("<p>Parkeergarage centrum: € 15 per 24 uur.</p>").departure, undefined);
  const r = page("<p>Camperplaats: € 12 per 24 uur. Vertrek voor 11.00 uur.</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "11:00");
});

test("opsomming 'Vrije vertrek- en aankomsttijden' wordt 'vrij' (gevonden bij Camping Zandman)", () => {
  assert.equal(page("<ul><li>Wifi gratis</li><li>Vrije vertrek- en aankomsttijden</li></ul>").departure, "vrij");
  assert.equal(page("<p>Vrije aankomst- en vertrektijden voor campers.</p>").departure, "vrij");
});

test("Duitse FAQ: 'spätestens um 12 Uhr' na de vraag over auschecken (gevonden bij De Lepelaar)", () => {
  const r = page("<h3>Bis wann muss ich spätestens auschecken?</h3><p>Am Abreisetag bitten wir Sie, den Stellplatz spätestens um 12:00 Uhr zu verlassen.</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "12:00");
});

test("'of in overleg' maakt een vaste vertrektijd niet onzeker (gevonden met inspect)", () => {
  const a = page("<p>Onze huisregels Aankomst ná 13:00 uur en vertrek vóór 11:00 uur of in overleg.</p>");
  assert.equal(a.departure, "vast");
  assert.equal(a.checkout_until, "11:00");
  const b = page("<p>Bijzettentje €3,- per nacht (altijd in overleg) Aankomst en vertrek: De aankomsttijd is na 13:00, het vertrek voor 12:00.</p>");
  assert.equal(b.departure, "vast");
  assert.equal(b.checkout_until, "12:00");
});

test("een punt na een tijd sluit de zin af: 'later vertrekken' in de volgende zin telt niet mee", () => {
  const r = page("<p>De aankomsttijd is na 13:00, het vertrek voor 12:00. Wil je eerder aankomen of later vertrekken? Neem dan contact met ons op.</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "12:00");
});
