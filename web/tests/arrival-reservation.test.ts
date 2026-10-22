// Laatste aankomsttijd en reserveringsregel (review 3.2). De zinnen komen letterlijk van websites van camperplaatsen.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { latestArrival, reservationRule } from "../supabase/functions/pipeline/extract.ts";
import { arrivalClosed } from "../src/lib/search.ts";
import { arrivalText, reservationRuleOf } from "../src/lib/format.ts";

const until = (s: string) => latestArrival(s.toLowerCase(), s).checkin_until;

test("laatste aankomst: 'tot' en 'tussen … en …'", () => {
  assert.equal(until("Vertrek graag voor 12:00 uur. U kunt aankomen tot 22:00 uur."), "22:00");
  assert.equal(until("Vertrek: voor 12:00 · Aankomst tot 22:00"), "22:00");
  assert.equal(until("Uitchecken · Inchecken kan tot 22:00 uur"), "22:00");
  assert.equal(until("Inchecken kan tussen 16:00 en 20:00"), "20:00");
  assert.equal(until("- Aankomst tussen 13.00 - 22.00 uur"), "22:00");
  assert.equal(until("Inchecken is mogelijk tussen 16.00 en 22.00 uur op de dag van aankomst"), "22:00");
  assert.equal(until("Aankomst is tussen 13.00 uur en 17:00"), "17:00");
  assert.equal(until("Aankomsttijd tussen 12.00u en 15.00u"), "15:00");
  assert.equal(until("Vertrek vóór 12.00 uur. Aankomst dagelijks mogelijk tussen 09.00 uur en 21.00 uur"), "21:00");
});

test("twee vensters: de laatste tijd telt", () => {
  assert.equal(until("Aankomst tussen 14:00 – 17:00 uur of tussen 19:00 – 20:00 uur en vertrek voor 12:00 uur"), "20:00");
});

test("valkuilen: geen laatste aankomst", () => {
  // "tot 12:00" hoort bij het vertrek
  assert.equal(until("Passantenplaatsen zijn beschikbaar vanaf 14:00 uur op de dag van aankomst tot 12:00 uur op de dag van vertrek"), undefined);
  assert.equal(until("Voor kampeerders is de aankomsttijd vanaf 14:00 uur en de vertrektijd tot 12:00 uur"), undefined);
  // Alleen op bepaalde dagen
  assert.equal(until("Aankomst is mogelijk op maandag en vrijdag tussen 15.00 en 18.00 uur"), undefined);
  // Verhuur
  assert.equal(until("Chalets: inchecken tussen 15:00 en 18:00 uur"), undefined);
  // Alleen een begintijd
  assert.equal(until("Aankomst vanaf 13:30 uur en vertrek voor 11:00 uur"), undefined);
});

test("de bronzin gaat mee", () => {
  const r = latestArrival("u kunt aankomen tot 22:00 uur.", "U kunt aankomen tot 22:00 uur.");
  assert.equal(r.note, "U kunt aankomen tot 22:00 uur");
});

const rule = (s: string) => reservationRule(s.toLowerCase());

test("reserveren: verplicht, mogelijk of niet nodig", () => {
  assert.equal(rule("Reserveren is verplicht in het hoogseizoen en daarbuiten."), "verplicht");
  assert.equal(rule("Kamperen is alleen op reservering."), "verplicht");
  assert.equal(rule("Reserveren is niet nodig, wie het eerst komt die het eerst maalt."), "niet_nodig");
  assert.equal(rule("Reserveren kan, maar is niet noodzakelijk."), "niet_nodig");
  assert.equal(rule("Vooraf reserveren is niet nodig."), "niet_nodig");
  assert.equal(rule("Reserveer nu je camperplaats online."), "mogelijk");
  assert.equal(rule("U kunt telefonisch reserveren."), "mogelijk");
});

test("reserveren: verhuur telt niet, tegenstrijdig is onbekend", () => {
  assert.equal(rule("Reserveren is verplicht voor de chalets."), undefined);
  assert.equal(rule("Reserveren is verplicht. Reserveren is niet nodig."), undefined);
  assert.equal(rule("Welkom op onze camping."), undefined);
});


test("Nu nog aankomen: alleen dicht als de laatste aankomst bekend en voorbij is", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m);
  assert.equal(arrivalClosed({ checkinUntil: "22:00" }, at(21, 59)), false);
  assert.equal(arrivalClosed({ checkinUntil: "22:00" }, at(22, 1)), true);
  assert.equal(arrivalClosed({ checkinUntil: "22:00", access24h: true }, at(23)), false);
  assert.equal(arrivalClosed({}, at(23)), false);
});

test("aankomst en reserveren in tekst", () => {
  assert.equal(arrivalText({ checkinFrom: "14:00", checkinUntil: "22:00" }), "Aankomen tussen 14:00 en 22:00");
  assert.equal(arrivalText({ checkinUntil: "22:00" }), "Aankomen tot 22:00");
  assert.equal(arrivalText({ checkinFrom: "14:00" }), "Aankomst vanaf 14:00");
  assert.equal(arrivalText({}), undefined);
  assert.equal(reservationRuleOf({ reservationRule: "verplicht", reservation: true }), "verplicht");
  assert.equal(reservationRuleOf({ reservation: false }), "niet_nodig");
  assert.equal(reservationRuleOf({}), undefined);
});
