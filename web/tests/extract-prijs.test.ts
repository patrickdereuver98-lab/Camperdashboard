// Prijs per nacht: bedragen die geen nachtprijs voor de plek zijn. Elke zin komt van een site uit de nacontrole van
// 8 november 2026 (R19, R47); daar las de extractor deze bedragen als nachtprijs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extract, isDirectorySite } from "../supabase/functions/pipeline/extract";

const base = new URL("https://camping.example.nl/");
const price = (html: string, url = base) => (extract([html], url) as Record<string, unknown>).price_eur;
const note = (html: string) => (extract([html], base) as Record<string, unknown>).price_note;
const rows = (...r: string[][]) => `<table>${r.map((c) => `<tr>${c.map((x) => `<td>${x}</td>`).join("")}</tr>`).join("")}</table>`;

// ── 1. Geen nachtprijs voor de plek ─────────────────────────────────────────

test("logé is geen nachtprijs (Molecaten)", () => {
  assert.equal(price("<p>Meld je logé altijd aan bij de receptie. Voor een logé op een kampeerplaats betaal je € 5,00 per nacht, exclusief toeristenbelasting.</p>"), undefined);
  assert.equal(price("<p>Familie en/of vrienden die overnachten betalen € 7,50 per nacht (exclusief toeristenbelasting)</p>"), undefined);
  assert.equal(price("<p>For a guest on a camping pitch you pay €5.00 per night, excluding tourist tax.</p>"), undefined);
});

test("logé in een tarievenlijst laat de plaatsprijs staan (Nieuw Duinoord)", () => {
  const html = "<p>1 september t/m 3 oktober € 30.- per nacht</p><p>Extra persoon € 6,50- per nacht</p><p>Logé € 7,50 per nacht</p>";
  assert.equal(price(html), 30);
});

test("bijzettent(je) is geen nachtprijs", () => {
  assert.equal(price("<p>Moet er een bijzettentje bij komen? Geen probleem, u mag maximaal twee plaatsen bij uw kampeermiddel hebben (€7,00 per nacht).</p>"), undefined);
  assert.equal(price("<p>Het eerste bijzettentje is gratis, voor een eventuele tweede bijzettentje betaal je € 6,50 per nacht.</p>"), undefined);
  assert.equal(price("<p>Camperplaats - Laagseizoen (Hoogseizoen) € 8,50 (€ 9,50)</p><p>Bijzettentje op de camper- of kampeerplaats € 5,50</p>"), 8.5);
  assert.equal(price("<p>Slaaptent bij kampeerplek max.6 m2 max. 1 € 5,00 per nacht</p>"), undefined);
});

test("lege, onbewoonde of onbemande caravan is geen nachtprijs", () => {
  assert.equal(price("<p>Even naar huis tijdens uw verblijf? Caravan leeg zonder stroom €2,50 per nacht, met stroom €5,50 per nacht.</p>"), undefined);
  assert.equal(price("<p>Caravan onbewoond 5.00 euro per dag. Niet in (hoogseizoen) juli en augustus.</p>"), undefined);
  assert.equal(price("<p>Wilt u uw kampeermiddel gedurende bepaalde tijd onbemand achterlaten dan bedragen de kosten daarvoor 5,00 euro per dag.</p>"), undefined);
  assert.equal(price("<p>Kampeerplaats onbeheerd zonder elektra laagseizoen €5,75,-</p>"), undefined);
  assert.equal(
    price(rows(["Leegstaande caravan of tent", "Zonder gebruik van elektra", "€5,- per nacht"])),
    undefined,
  );
});

test("kachel is geen nachtprijs", () => {
  assert.equal(price("<p>Wist u ook dat u een heuse houtkachel kunt huren voor € 7,50 per dag? Het hout krijgt u er van ons kosteloos bij.</p>"), undefined);
  assert.equal(price("<p>Een kacheltje in de trekkershut is te huur voor € 5 per nacht.</p>"), undefined);
});

test("parkeren is geen nachtprijs", () => {
  assert.equal(price("<p>Wanneer je liever óp het park parkeert dan betaal je hier € 6,50 per dag per auto voor.</p>"), undefined);
  assert.equal(price("<p>Op het terrein zijn extra betaald parkeerplaatsen. Deze zijn bij te boeken voor € 5,00 per dag per auto.</p>"), undefined);
});

test("borg en huur per dag en week zijn geen nachtprijs", () => {
  assert.equal(price("<p>U kunt hiervoor bij de receptie een sleutelkaart verkrijgen tegen een borg van €5,- per dag.</p>"), undefined);
  assert.equal(price("<p>BMX-helm: €5 per dag en €35 per week.</p>"), undefined);
  assert.equal(price("<p>Campingbedje compleet met beddengoed € 35,00 per week en € 7,00 per dag</p>"), undefined);
});

test("ligplaats voor een boot is geen nachtprijs", () => {
  assert.equal(price("<p>Neem je een boot mee? Geen probleem, dan kan je een ligplaats reserveren voor €7,- per nacht.</p>"), undefined);
  assert.equal(price("<p>Ligplaats haven dagtarief € 5,00 per dag per boot</p>"), undefined);
  assert.equal(price("<p>(Wacht)schepen/ boten 12 meter en langer, tarief per nacht € 7,50</p>"), undefined);
});

test("verhuur is geen nachtprijs", () => {
  assert.equal(price("<p>Fietsverhuur</p><p>Fietsen € 15,00 per dag</p>"), undefined);
  assert.equal(price("<h3>Pipowagen De Kers</h3><p>Prijs per nacht €60,- (inclusief toeristenbelasting)</p>"), undefined);
  assert.equal(price("<p>DRAAGBAAR TOILET TE HUUR € 5,00 per nacht (toiletemmerzak € 2,00 per zak)</p>"), undefined);
  assert.equal(price("<p>5e persoon € 5,90 per nacht excl. toeristenbelasting (zelf slaapplaats verzorgen)</p>"), undefined);
});

test("voorkeursboeking en laat vertrek zijn geen nachtprijs", () => {
  assert.equal(
    price("<p>Wij brengen kosten in rekening voor voorkeursboekingen:</p><p>Voor kampeerplaatsen: €7,50</p><p>Voor verhuuraccommodaties: €15</p>"),
    undefined,
  );
  assert.equal(price("<p>Kosten voor laat vertrek:</p><p>Camperplaats € 10</p><p>Tentplaats, comfortplaats XL € 15</p>"), undefined);
  assert.equal(price("<p>Bij een camperplaats: € 5,- voor 3 nachten of korter</p>"), undefined);
});

test("stroomvoorschot, ampère en andere toeslagen zijn geen nachtprijs", () => {
  assert.equal(price("<p>U betaalt een voorschot van € 6,00 per nacht aan het gebruik van elektriciteit (1 kWh = € 0,60 ).</p>"), undefined);
  assert.equal(price("<p>Bij een reservering met elektriciteit is standaard 6 ampère aanwezig (€ 5,00 per dag).</p>"), undefined);
  assert.equal(price("<p>Plaats zonder overnachting (laagseizoen)* €7,50</p>"), undefined);
  assert.equal(price("<p>Huisdieren zijn welkom. Hiervoor betaalt u 7,00 euro per nacht, per huisdier.</p>"), undefined);
  assert.equal(price("<p>Honden zijn welkom, hiervoor rekenen we de eerste overnachting €10,- en de volgende €5,- per overnachting.</p>"), undefined);
  assert.equal(price("<p>Voor-/naseizoen : € 24,00 per overnachting van twee personen, € 5,00 + € 1,68 toeristenbelasting per extra persoon per overnachting</p>"), 24);
});

// ── 2. Tent, ook in samenstellingen ─────────────────────────────────────────

test("trekkerstent, tweepersoonstent en tentje zijn geen camperprijs", () => {
  assert.equal(price("<p>Trekkerstent 1 persoon €14,00 per nacht. excl. toeristenbelasting</p>"), undefined);
  assert.equal(price("<p>1 Tweepersoonstent € 5,50 per nacht.</p>"), undefined);
  assert.equal(price("<p>Direct boeken</p><p>€ 14,40 per nacht</p><p>1 persoon</p><p>1 trekkerstent</p>"), undefined);
  assert.equal(price("<p>Fietsers hanteren wij een speciale prijs van € 15 per overnachting voor 1 persoon met tent.</p>"), undefined);
  assert.equal(
    price(rows(["Trekkerstentje: klein (opgooi)tentje voor 1 tot maximaal 2 personen", "€ 5,20 per overnachting", "€ 6,25 per overnachting"])),
    undefined,
  );
});

test("tentregel laat camper- en kampeerplaatsprijzen staan", () => {
  assert.equal(price("<p>1 Camper t/m 5 meter € 8,50 per nacht. 1 Camper vanaf 5 meter € 9,95 per nacht. 1 Tweepersoonstent € 5,50 per nacht.</p>"), 8.5);
  assert.equal(price("<p>Caravan met voortent € 20 per nacht</p>"), 20);
  assert.equal(price("<p>Kampeerplaats voor tent, caravan of camper € 18,00 per nacht</p>"), 18);
  assert.equal(price("<p>Caravan of tent € 6,00 per nacht</p><p>Camper of busje € 9,50 per nacht</p>"), 9.5);
});

// ── 3. Prijs per persoon in een tarieventabel ───────────────────────────────

test("prijs per persoon in een tarieventabel is geen nachtprijs", () => {
  assert.equal(price("<p>Prijs per persoon per overnachting €5,50</p>"), undefined);
  assert.equal(price("<p>Personen vanaf 13 jaar € 5,00 per nacht incl. € 2,00 toeristenbelasting</p>"), undefined);
  assert.equal(price("<p>Overnachtingstarief van €6,00 per persoon per nacht, plus toeristenbelasting</p>"), undefined);
  assert.equal(price(rows(["Persoon overnachten (alle leeftijden)", "€ 6,00 per dag"])), undefined);
  assert.equal(
    price(rows(["Kampeerplaats per nacht", "€22,50"], ["Prijs per persoon per overnachting", "€5,50"])),
    22.5,
  );
});

test("een opsomming van wat in de prijs zit blijft een nachtprijs", () => {
  assert.equal(price("<p>Voorbeeld prijs camping plek ** : 2 volwassenen, auto, caravan of camper, stroom en toeristenbelasting € 26,35 per overnachting.</p>"), 26.35);
  assert.equal(price(rows(["Per persoon", "€ 5,70"], ["Bijzettent", "€ 2,60"], ["Camper", "€ 6,90"])), 6.9);
  const veldlust = "<h3>Kamperen 1 plaats, 2 personen</h3><p>€ 32,00 per overnachting (2027: € 33,00).</p><p>Bezoekers tarief per dag € 2,10 per persoon incl. parkeerplaats.</p><h3>Kamperen 1 plaats, 3 personen</h3><p>€ 37,00 per overnachting (2027: € 38,00).</p>";
  assert.equal(price(veldlust), 32);
  assert.match(String(note(veldlust)), /€ 38,00/);
});

test("een bedrag midden in een groter getal telt niet", () => {
  assert.equal(price("<p>7 overnachtingen: € 160,--</p>"), undefined);
  assert.equal(price("<p>2 personen: 120 euro per nacht inclusief ontbijt</p>"), undefined);
});

// ── 4. Gids of koepel als website ──────────────────────────────────────────

test("een gids of koepel als website levert geen prijs", () => {
  const svr = "<p>Het tarief bedraagt in het laagseizoen € 22,50 en in het hoogseizoen € 23,50 per nacht.</p>";
  assert.equal(price(svr, new URL("https://svr.nl/")), undefined);
  assert.equal(price("<p>Soortgelijke locaties € 15 /nacht De Buck</p>", new URL("https://www.boerderij-campings.nl/camping/krommenhoeke")), undefined);
  assert.equal(price(svr), 23.5);
});

test("isDirectorySite kent gidsen, niet de eigen site met dezelfde letters", () => {
  assert.equal(isDirectorySite(new URL("https://www.svr.nl/campings/de-bleek")), true);
  assert.equal(isDirectorySite(new URL("https://www.natuurkampeerterreinen.nl/terrein/x")), true);
  assert.equal(isDirectorySite(new URL("https://www.svrcampingboslust.nl")), false);
  assert.equal(isDirectorySite(new URL("https://sites.google.com/view/camping")), false);
});
