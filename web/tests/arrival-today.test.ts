// "Nog x uur om vandaag aan te komen" op de plekpagina (UX-audit november)
import { test } from "node:test";
import assert from "node:assert/strict";
import { arrivalToday } from "../src/lib/arrival-today";

const at = (h: number, m = 0) => h * 60 + m;

test("binnen 4 uur: hoeveel tijd je nog hebt", () => {
  assert.deepEqual(arrivalToday({ checkinFrom: "14:00", checkinUntil: "22:00" }, at(19, 50)), { text: "Nog 2 uur en 10 minuten om vandaag aan te komen (tot 22:00)", closed: false });
  assert.equal(arrivalToday({ checkinUntil: "22:00" }, at(21, 59))?.text, "Nog 1 minuut om vandaag aan te komen (tot 22:00)");
  assert.equal(arrivalToday({ checkinUntil: "22:00" }, at(19))?.text, "Nog 3 uur om vandaag aan te komen (tot 22:00)");
});

test("ruim de tijd: niets; voor de aankomsttijd: vanaf", () => {
  assert.equal(arrivalToday({ checkinFrom: "14:00", checkinUntil: "22:00" }, at(15)), undefined);
  assert.equal(arrivalToday({ checkinFrom: "14:00", checkinUntil: "22:00" }, at(9))?.text, "Aankomen kan vandaag vanaf 14:00");
});

test("voorbij: niet meer aankomen", () => {
  assert.deepEqual(arrivalToday({ checkinUntil: "20:00" }, at(20, 30)), { text: "Vandaag kun je hier niet meer aankomen (tot 20:00)", closed: true });
});

test("tot na middernacht", () => {
  assert.equal(arrivalToday({ checkinFrom: "14:00", checkinUntil: "01:00" }, at(23))?.text, "Nog 2 uur om vandaag aan te komen (tot 01:00)");
  assert.equal(arrivalToday({ checkinFrom: "14:00", checkinUntil: "01:00" }, at(0, 30))?.text, "Nog 30 minuten om vandaag aan te komen (tot 01:00)");
});

test("onbekend of dag en nacht open: niets", () => {
  assert.equal(arrivalToday({}, at(21)), undefined);
  assert.equal(arrivalToday({ checkinUntil: "22:00", access24h: true }, at(21)), undefined);
});
