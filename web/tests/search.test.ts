// Indeling op vertrektijd: de kern van de site (pagina's Zonder vertrektijd, Uitslapers en Overige).
import { test } from "node:test";
import assert from "node:assert/strict";
import { departureKind, inDepartureGroup, isOpenOn, editDistance } from "../src/lib/search";
import { departureShort } from "../src/lib/format";

test("vrij en per 24 uur vallen alleen onder 'vrij' na bevestiging door een mens (kernbelofte)", () => {
  assert.equal(departureKind({ departure: "vrij", departureCheck: "bevestigd" }), "vrij");
  assert.equal(departureKind({ departure: "per24", departureCheck: "bevestigd" }), "vrij");
  assert.equal(departureKind({ departure: "vrij" }), "onbekend");
  assert.equal(departureKind({ departure: "per24", departureCheck: "voorwaardelijk" }), "onbekend");
  assert.equal(departureKind({ departure: "vrij", departureCheck: "afgewezen" }), "onbekend");
});

test("vaste tijden: uitslapers vanaf 12:00, ruim vanaf 11:00, anders vroeg", () => {
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "12:00" }), "uitslapers");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "14:00" }), "uitslapers");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "11:30" }), "ruim");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "11:00" }), "ruim");
  assert.equal(departureKind({ departure: "vast", checkoutUntil: "10:00" }), "vroeg");
});

test("vast zonder tijd en geen gegevens zijn onbekend", () => {
  assert.equal(departureKind({ departure: "vast" }), "onbekend");
  assert.equal(departureKind({}), "onbekend");
});

test("'overig' bevat ruim, vroeg en onbekend, maar geen vrij of uitslapers", () => {
  assert.ok(inDepartureGroup({ departure: "vast", checkoutUntil: "10:00" }, "overig"));
  assert.ok(inDepartureGroup({}, "overig"));
  assert.ok(!inDepartureGroup({ departure: "vrij", departureCheck: "bevestigd" }, "overig"));
  // Een niet-bevestigde kandidaat staat bij Overige, niet op Zonder vertrektijd
  assert.ok(inDepartureGroup({ departure: "vrij" }, "overig"));
  assert.ok(!inDepartureGroup({ departure: "vrij" }, "vrij"));
  assert.ok(!inDepartureGroup({ departure: "vast", checkoutUntil: "12:00" }, "overig"));
});

test("onbekend wordt nooit ingevuld", () => {
  assert.equal(departureShort({}), undefined);
  assert.equal(departureShort({ departure: "vast" }), "Vaste vertrektijd");
});

test("seizoen: open binnen de periode, dicht erbuiten, onbekend zonder gegevens", () => {
  const p = { season: "1 april – 31 oktober" };
  assert.equal(isOpenOn(p, new Date(2026, 6, 15)), true);
  assert.equal(isOpenOn(p, new Date(2026, 11, 1)), false);
  assert.equal(isOpenOn({}, new Date(2026, 6, 15)), undefined);
  assert.equal(isOpenOn({ openAllYear: true }, new Date(2026, 0, 1)), true);
});

test("seizoen over de jaarwisseling", () => {
  const p = { season: "1 november – 31 maart" };
  assert.equal(isOpenOn(p, new Date(2026, 0, 10)), true);
  assert.equal(isOpenOn(p, new Date(2026, 6, 10)), false);
});

test("spellingsafstand: Giethorn ligt dichter bij Giethoorn dan bij Giethmen", () => {
  assert.equal(editDistance("giethorn", "giethoorn"), 1);
  assert.equal(editDistance("giethorn", "giethmen"), 2);
  assert.equal(editDistance("giethorn", "amsterdam"), Infinity);
});
