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

test("JSON-LD checkoutTime van een camping telt als vaste vertrektijd, van een hotel niet", () => {
  const ld = (type: string) => `<script type="application/ld+json">{"@type":"${type}","checkoutTime":"11:00:00","checkinTime":"T13:00"}</script><p>Welkom</p>`;
  const r = page(ld("Campground"));
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "11:00");
  assert.equal(r.checkin_from, "13:00");
  assert.equal(page(ld("Hotel")).departure, undefined);
});

test("FAQ: tijd in het antwoord op de vraag, bij de kampeerplek en niet bij verhuur (gevonden met inspect)", () => {
  const a = page("<h3>Hoe laat moet ik uitchecken?</h3><p>Voor kampeerplekken is dat 11:00 uur, voor de glampingtent 10:00 uur.</p>");
  assert.equal(a.checkout_until, "11:00");
  const b = page("<h3>Hoe laat moet ik vertrekken?</h3><p>Kampeerplaatsen verlaat je voor 12:00 uur, het appartement voor 10:00 uur.</p>");
  assert.equal(b.checkout_until, "12:00");
  const c = page("<p>uitchecken camping 12.00 uur, uitchecken accomodaties 11.00 uur</p>");
  assert.equal(c.checkout_until, "12:00");
});

test("openingstijden van de receptie na een vertrekwoord zijn geen vertrektijd", () => {
  assert.equal(page("<p>Bij vertrek graag de sleutel inleveren. De receptie van de camping is open van 9.00 tot 17.00 uur.</p>").departure, undefined);
  assert.equal(page("<p>Hoe laat moet ik vertrekken? De camping is geopend van 8.00 uur.</p>").departure, undefined);
});

test("selfservice checkin/checkout 24/7 bij camperplaatsen wordt 'vrij'", () => {
  assert.equal(page("<p>28 ruime camperplaatsen. Selfservice checkin/checkout (24/7). Hele jaar open.</p>").departure, "vrij");
});

test("tweede controlesteekproef: 'is' als verbinding, '12 uur' bij de camping, kopje boven de tijd", () => {
  assert.equal(page("<p>De vertrektijd is 12.00 uur.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Vertrek van de camping moet voor 12 uur ( Accommodatie, 11 uur).</p>").checkout_until, "12:00");
  const kop = page("<h2>Inchecken</h2><p>Vanaf 14:00 uur.</p><h2>Uitchecken</h2><p>Tot 11:00 uur.</p>");
  assert.equal(kop.checkout_until, "11:00");
  assert.equal(kop.checkin_from, "14:00");
});

test("termijnen en betalingen ('2 werkdagen voor vertrek uiterlijk 12.00 uur') zijn geen vertrektijd", () => {
  assert.equal(page("<p>Vermindering van het aantal deelnemers kan tot 2 werkdagen voor vertrek uiterlijk 12.00 uur.</p>").departure, undefined);
  assert.equal(page("<p>Het restbedrag dient uiterlijk 14 dagen voor aankomst voldaan te zijn.</p>").departure, undefined);
});

test("derde steekproef (volledige run): nachtregel, kampeerplaats boven algemene tijd, 'uiterlijk' hoort bij vertrek", () => {
  assert.equal(page("<p>Wenst u te vertrekken tussen 23:00 en 7:00 dan dient u uw vervoermiddel buiten het park te parkeren.</p>").departure, undefined);
  const r = page(
    "<p>Inchecken kan vanaf 16.00 uur en uitchecken tot 10.00 uur. Bij kampeerplaatsen kun je vanaf 13.00 uur inchecken en uiterlijk 11.00 uur uitchecken.</p>",
  );
  assert.equal(r.checkout_until, "11:00");
  assert.equal(r.checkin_from, "13:00");
});

test("'vertrekken wanneer u wilt' naast een vaste tijd is tegenstrijdig: niets invullen", () => {
  const r = page("<p>Met de camper kunt u aankomen en vertrekken wanneer u wilt.</p><p>Aankomst vanaf 13.00 uur en vertrek vóór 12.00 uur.</p>");
  assert.equal(r.departure, undefined);
});

test("HTML-entiteiten: 'v&oacute;&oacute;r 11:00 uur' wordt herkend", () => {
  const r = page("<p>In- &amp; uitchecken Inchecken: vanaf 12:00 uur Uitchecken: v&oacute;&oacute;r 11:00 uur</p>");
  assert.equal(r.checkout_until, "11:00");
  assert.match(String(r.times_note), /vóór 11:00/);
  assert.equal(page("<p>Vertrek v&#243;&#243;r 10.30 uur.</p>").checkout_until, "10:30");
});

test("tijd direct na het vertrekwoord, zonder 'voor' of 'om'; een datum telt niet", () => {
  const r = page("<p>Inclusief toeristenbelasting Aankomsttijd op dag van aankomst 14:00 uur Vertrektijd op dag van vertrek 12:00 uur</p>");
  assert.equal(r.checkout_until, "12:00");
  assert.equal(r.checkin_from, "14:00");
  assert.equal(page("<p>Aankomst 14 uur, vertrek 12 uur.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Aankomst 05.07.2026, vertrek 12.07.2026.</p>").departure, undefined);
  assert.equal(page("<p>Vertrek 2 personen per kampeerplaats.</p>").departure, undefined);
});

test("'vanaf' is nooit een vertrektijd, ook niet in de zin na het vertrekwoord", () => {
  const r = page("<p>Indien u een kampeerplaats heeft, moet u om 11:00 uur de plaats verlaten. Als u een kampeerplaats heeft geboekt, dan kunt u vanaf 14:00 uur inchecken.</p>");
  assert.equal(r.checkout_until, "11:00");
  assert.equal(r.checkin_from, "14:00");
});

test("vierde steekproef (bestaande bronzinnen): uit te checken, woorden tussen tijd en werkwoord, leeg te zijn, tijdsbestek", () => {
  assert.equal(page("<p>Voor op de camping kunt u om 14:00 inchecken en dient u uiterlijk om 12:00 uit te checken.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Op de camping dient u voor 10:00 uur uw tentplaats te verlaten.</p>").checkout_until, "10:00");
  assert.equal(page("<p>De huur van de standplaats eindigt om 12.00 op de dag van vertrek.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Kampeerplaatsen verlaat je voor 12:00 uur, het appartement voor 10:00 uur.</p>").checkout_until, "12:00");
  assert.equal(page("<p>De kampeerplaatsen dienen voor 11.30 uur leeg te zijn.</p>").checkout_until, "11:30");
  assert.equal(page("<p>Op de dag van vertrek kunt u vanaf 8:00 tot 12:00 uur uitchecken.</p>").checkout_until, "12:00");
});

test("formuleringen uit de zoekagentenronde: vòòr, ten laatste, verlaat, vrij te maken, opgeleverd, laatste dag, Engels", () => {
  assert.equal(page("<p>Op de vertrekdag, dient u de kampeerplaats vòòr 12.00 uur te verlaten.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Voor kampeerders geldt aankomst vanaf 13.30 uur en vertrek ten laatste 11.30 uur.</p>").checkout_until, "11:30");
  assert.equal(page("<p>Voor 12.00 uur verlaat u de plaats op uw vertrekdag.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Het verzoek is om de plaats vóór 11.30 uur vrij te maken op de vertrekdag, de lodges vóór 10.00 uur.</p>").checkout_until, "11:30");
  assert.equal(page("<p>Op de dag van vertrek zien wij graag dat de plaats voor 12.00 uur weer wordt opgeleverd.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Op de laatste dag van uw verblijf kunt u tot 11:30 uur van uw kampeerplek genieten.</p>").checkout_until, "11:30");
  assert.equal(page("<p>Check-out is at 12:00 at the latest.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Het vertrekuur is 11u.</p>").checkout_until, "11:00");
});

test("'De overnachting is per 24 uur' en 'tarieven per 24 uur' zijn per24 (zonder vaste vertrektijd)", () => {
  assert.equal(page("<p>Camperplaats aan het water. De overnachting is per 24 uur.</p>").departure, "per24");
  assert.equal(page("<p>Onze tarieven zijn per 24 uur, inclusief stroom.</p>").departure, "per24");
  assert.equal(page("<p>De overnachting is per 24 uur. Vertrek voor 12:00 uur.</p>").departure, "vast");
  assert.equal(page("<p>Chalet: de overnachting is per 24 uur.</p>").departure, undefined);
});

test("vijfde steekproef (vertrek na 13:00): kopje 'aankomst en vertrek', 'na het uitchecken', 'vertrek na'", () => {
  assert.equal(page("<p>Aankomst en vertrek Kampeerders zijn van harte welkom tussen 14:00 uur en de sluitingstijd van de receptie.</p>").checkout_until, undefined);
  assert.equal(page("<p>Uitchecken voor 11:00 uur. U mag na het uitchecken nog tot 14:00 uur gebruik maken van al onze faciliteiten.</p>").checkout_until, "11:00");
  assert.equal(page("<p>Aankomst vanaf 15.00 u. Vertrek na 14.00 u.</p>").checkout_until, undefined);
  assert.equal(page("<p>Aankomst- en vertrektijden: aankomst vanaf 14:00 uur, vertrek voor 11:00 uur.</p>").checkout_until, "11:00");
  assert.equal(page("<p>Aankomst- en vertrektijden: aankomst vanaf 14:00 uur, vertrek voor 11:00 uur.</p>").checkin_from, "14:00");
});

test("'vertrek na 12 uur € 10' (toeslag) is vertrektijd 12:00; 'na 08.00 en voor 12:00' is 12:00", () => {
  assert.equal(page("<p>Vertrek na 12:00 uur € 10,00</p>").checkout_until, "12:00");
  assert.equal(page("<p>Bij vertrek na 12.00 uur wordt er een halve dag extra in rekening gebracht.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Vertrekt u na 12.00 uur, dan wordt er een extra nacht in rekening gebracht.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Vertrek na 08.00 uur en voor 12:00 uur. Aankomst na 13:00 uur en voor 17:30 uur.</p>").checkout_until, "12:00");
});

test("'vanaf 14:00 uur inchecken en uitchecken is om 12:00 uur' is geen kopje", () => {
  assert.equal(page("<p>Als je een kampeerplek hebt gereserveerd, kun je vanaf 14:00 uur inchecken en uitchecken is om 12:00 uur.</p>").checkout_until, "12:00");
  assert.equal(page("<p>Bij vertrek na 12:00 ( In overleg )</p>").checkout_until, "12:00");
});

test("veldensteekproef: honden uit de tarieflijst, 'mits aangelijnd', maximaal 1 hond; 'geen honden' gaat voor", () => {
  assert.equal(page("<p>Kampeerplaats € 9,50 Elektriciteit € 2,00 Persoon € 4,50 Hond € 1,00</p>").dogs, true);
  assert.equal(page("<p>Huisdier: € 1,50 Per overnachting</p>").dogs, true);
  assert.equal(page("<p>€ 2,00 per hond</p>").dogs, true);
  assert.equal(page("<p>Hond Gratis Auto Gratis</p>").dogs, true);
  assert.equal(page("<p>Ja, huisdieren zijn -mits aangelijnd- op het terrein toegestaan.</p>").dogs, true);
  assert.equal(page("<p>Maximaal 1 hond per plaats.</p>").dogs, true);
  assert.equal(page("<p>Honden &amp; gezinnen welkom</p>").dogs, true);
  assert.equal(page("<p>Geen honden toegestaan. Extra persoon € 4,50.</p>").dogs, false);
});

test("veldensteekproef: water op de plaats, watertap, water inbegrepen", () => {
  assert.equal(page("<p>Water op de plaats of binnen 50 meter.</p>").water, true);
  assert.equal(page("<p>Comfortplaats met prive watertap.</p>").water, true);
  assert.equal(page("<p>Electra Inbegrepen in de prijs. Water inbegrepen in de prijs.</p>").water, true);
  assert.equal(page("<p>Ontdek het gebied vanaf het water.</p>").water, undefined);
});

test("veldensteekproef: reserveren", () => {
  assert.equal(page("<p>Reserveer je plek!</p>").reservation, true);
  assert.equal(page("<p>Zoek &amp; Boek</p>").reservation, true);
  assert.equal(page("<p>Reserveren kan telefonisch, via WhatsApp of via e-mail.</p>").reservation, true);
  assert.equal(page("<p>Wilt u een plek reserveren? Dat kan maar is niet noodzakelijk.</p>").reservation, false);
});

test("veldensteekproef: aantal plekken als losse teller en 'kampeerplekken'", () => {
  assert.equal(page("<div>25</div><div>Kampeerplaatsen</div><div>5</div><div>Speeltoestellen</div>").capacity, 25);
  assert.equal(page("<p>Een rustige camping met 10 kampeerplekken.</p>").capacity, 10);
});

test("veldensteekproef: seizoen met weekdag en jaartal", () => {
  const r = page("<p>Wij zijn geopend! De camping is geopend van woensdag 25 maart 2026 tot donderdag 15 oktober 2026.</p>");
  assert.equal(r.season, "25 maart – 15 oktober");
  assert.equal(r.open_all_year, false);
});

test("veldensteekproef: prijzen in tarieftabellen", () => {
  assert.equal(
    page("<p>Tarieven minicamping Caravan/tent/camper, inclusief 2 personen, 1 auto, elec (6 amp), wifi, warm water voor douche, en afwas, gebruik koelkast en diepvries, per nacht: Hoogseizoen € 26,50 Voor– en naseizoen* € 23,50</p>").price_eur,
    26.5,
  );
  assert.equal(page("<p>Per persoon per nacht € 6,90 Per caravan per nacht € 12,50</p>").price_eur, 12.5);
  assert.equal(page("<p>Een overnachting op de camperplaats kost 7,50 euro.</p>").price_eur, 7.5);
  assert.equal(page("<p>Extra auto per nacht € 2,00</p>").price_eur, undefined);
});

test("teller in losse blokken alleen als het echt een teller is (geen menunummer)", () => {
  assert.equal(page("<ul><li>2</li><li>Kampeerplaatsen</li></ul><p>Onze camping heeft 241 kampeerplaatsen.</p>").capacity, 241);
  assert.equal(page("<div>1</div><div>Kampeerplaatsen</div>").capacity, undefined);
});

test("seizoen: 'gesloten van 1 november tot 19 maart' is geen openingsseizoen", () => {
  assert.equal(page("<p>Openingstijden: gesloten van 1 november tot 19 maart.</p>").season, undefined);
  assert.equal(page("<p>De camping is geopend van 20 maart tot 31 oktober.</p>").season, "20 maart – 31 oktober");
});

// Datareview 18 oktober: gemiste en foute vertrektijden uit de live bronzinnen
const out = (html: string) => {
  const r = page(html);
  return r.departure === "vast" ? `vast ${r.checkout_until}` : (r.departure as string | undefined);
};

test("datareview: woorden in losse letters ('v ertrek', 'v ó ór')", () => {
  assert.equal(out("<p>Aankomst vanaf 14.00 en v ertrek voor 11.00</p>"), "vast 11:00");
  assert.equal(out("<p>Aankomst na 15:00 en vertrek v ó ór 11:00</p>"), "vast 11:00");
  assert.equal(out("<p>Bij vol geboekte camping: aankomst vanaf 14:00uur en v ertrektijden 12:00uur</p>"), "vast 12:00");
});

test("datareview: 'tot 12:00 uur op de dag van vertrek', 'rond 11.00u', 'vertrek tijd 12:00'", () => {
  assert.equal(out("<p>Passantenplaatsen zijn beschikbaar vanaf 14:00 uur op de dag van aankomst tot 12:00 uur op de dag van vertrek</p>"), "vast 12:00");
  assert.equal(out("<p>Aankomst is vanaf 14.00u, wij vragen u op de dag van vertrek rond 11.00u de kampeerplaats weer te verlaten</p>"), "vast 11:00");
  assert.equal(out("<p>De aankomst tijd voor kamperen is 13:00 uur en vertrek tijd 12:00 uur</p>"), "vast 12:00");
  assert.equal(out("<p>Inchecken vanaf 15.00 uur, uitchecken rond 11.00 uur</p>"), "vast 11:00");
});

test("datareview: 15:00 als heel uur mag, later niet", () => {
  assert.equal(out("<p>Inchecken vanaf 12:00 uur, uitchecken 15:00 uur</p>"), "vast 15:00");
  assert.equal(out("<p>Inchecken kan vanaf 12:00, graag willen we dat u uitcheckt voor 15:00</p>"), "vast 15:00");
  assert.equal(out("<p>Uitchecken voor 15:30 uur</p>"), undefined);
});

test("datareview: een uitzondering voor safaritenten na de tijd telt niet als verhuur", () => {
  assert.equal(out("<p>Aankomst is tussen 14.00 uur en 19.00 uur en vertrek is voor 12.00 uur (bij safaritenten is dit 11:00 uur)</p>"), "vast 12:00");
  assert.equal(out("<p>Vertrek voor 10:00 uur (chalets)</p>"), undefined);
  assert.equal(out("<p>Accommodaties en safaritenten: uiterlijk om 10.00 uur. Kampeerplaatsen: uiterlijk om 11.00 uur vertrekken</p>"), "vast 11:00");
});

test("datareview: een vraag uit de FAQ is geen vertrektijd", () => {
  assert.equal(out("<p>Ik wil vóór 08:00 uur vertrekken, kan dat?</p>"), undefined);
  assert.equal(out("<p>Ik wil vóór 08.00 vertrekken, kan dat? Voor kampeerders is aankomst vanaf 12:00 uur en vertrek voor 11:00 uur</p>"), "vast 11:00");
  // Kopje als vraag, antwoord in de volgende zin
  assert.equal(out("<h3>Hoe laat moet ik uitchecken?</h3><p>Voor kampeerplekken is dat 11:00 uur.</p>"), "vast 11:00");
});

test("datareview: voorwaarde vóór de tijd maakt hem voorwaardelijk, erna niet", () => {
  assert.equal(out("<p>Tijdens drukke weekenden (Pinksteren, Pasen en Hemelvaart) is het vertrek voor 12:00 uur</p>"), undefined);
  assert.equal(out("<p>Uitchecken: vóór 10:00 uur (op zondag tot 13:00 uur)</p>"), "vast 10:00");
});

test("datareview: 'dag en nacht aankomen en vertrekken' is vrij", () => {
  assert.equal(out("<p>Bij ons kunt u met de camper dag en nacht aankomen en vertrekken</p>"), "vrij");
});

test("datareview: per 24 uur van een trailerhelling telt niet", () => {
  assert.equal(out("<p>Camperplaats en trailerhelling: € 10 per 24 uur voor de trailerhelling</p>"), undefined);
  assert.equal(out("<p>Camperplaats: € 10 per 24 uur</p>"), "per24");
});

test("datareview: aankomsttijd gelijk aan vertrektijd wordt niet overgenomen", () => {
  const r = page("<p>Wisseltijd: vertrek voor 14:00 uur, aankomst vanaf 14:00 uur</p>");
  assert.equal(r.checkout_until, "14:00");
  assert.equal(r.checkin_from, undefined);
});

test("codereview: verhuurtijd vóór het verhuurwoord, 'openingstijd' en 'open van … tot'", () => {
  assert.equal(out("<p>Vertrek voor 10:00 uur bij de chalets, kampeerplaatsen vertrekken voor 11:00 uur</p>"), "vast 11:00");
  assert.equal(out("<p>Vertrek voor 10:00 uur voor de chalets.</p>"), undefined);
  assert.equal(out("<p>Uitchecken voor 10:00 uur bij de huurtenten</p>"), undefined);
  assert.equal(out("<p>Vertrek is mogelijk tijdens openingstijd 9:00 uur</p>"), undefined);
  assert.equal(out("<p>Open van 9.00 tot 12.00 uur voor vertrek en aankomst</p>"), undefined);
  assert.equal(out("<p>De plaatsen zijn beschikbaar tot 11.00 uur op de vertrekdag</p>"), "vast 11:00");
});

test("run v36: steekproef op nieuwe vertrektijden", () => {
  // tarief van de trailerhelling, ook in de hoofdregel voor per 24 uur
  assert.equal(out("<p>Camperplaats. Parkeren bij gebruik trailerhelling (minimum tarief per 24 uur) € 5,00</p>"), undefined);
  // bijzin met een voorwaarde
  assert.equal(out("<p>Kom je aan na 22.00 uur of vertrek je voor 8.00 uur, dan dien je de auto te parkeren buiten het kampeerterrein</p>"), undefined);
  assert.equal(out("<p>Hier kan men gebruik van maken wanneer men vanaf 17.00u arriveert en voor 10.00u de volgende ochtend weer uitcheckt</p>"), undefined);
  // recreatiewoning en huurders
  assert.equal(out("<p>Indien het een recreatiewoning betreft geldt het tarief per overnachting tot 10.00 uur op de dag van vertrek</p>"), undefined);
  assert.equal(out("<p>Huurders kunnen het terrein gebruiken van 14.00 uur op de aankomstdag tot 13.00 uur op de dag van vertrek</p>"), undefined);
  // tijd vóór het verhuurwoord zonder haakjes hoort bij de accommodaties (de tweede tijd in de zin pakken we nog niet: liever leeg dan fout)
  assert.equal(out("<p>Vertrek graag voor 10:00 uur bij de accommodaties en voor 11:00 uur bij de kampeerplaatsen</p>"), undefined);
  // huuraccommodatie vroeg in een lange zin
  assert.equal(out("<p>Voor de huuraccommodaties van De Schatberg, Eurocamp en Roan geldt dat je vanaf 16:00 uur kunt inchecken en om 10:00 uiterlijk dient uit te checken</p>"), undefined);
  // laat vertrek tegen betaling of als keuze
  assert.equal(out("<p>Vertrek tussen 13.00 - 15.00 uur (in voor- en naseizoen) € 12,50</p>"), undefined);
  assert.equal(out("<p>Dan kun je kiezen uit vertrek om 15:00 uur of 20:00 uur</p>"), undefined);
  // zondagen
  assert.equal(out("<p>Uitchecken: zondagen voor 15.00 uur, op andere dagen voor 11.00 uur</p>"), undefined);
  // alleen aankomsttijden is geen vrij vertrek
  assert.equal(out("<p>Geen vaste aankomsttijden, geen verplichtingen voor de camper</p>"), undefined);
});

test("prijs: 'Campingplaats 2 pers (excl. toeristenbelasting) € 22,50' en 'toeristenplaats'", () => {
  assert.equal(page("<p>Campingplaats 2 pers** (excl. toeristenbelasting) € 22,50 Extra volwassene € 4,00 Huisdier € 2,50</p>").price_eur, 22.5);
  assert.equal(page("<p>Toeristenplaats met stroom € 26,50</p>").price_eur, 26.5);
  // een toeslag blijft een toeslag
  assert.equal(page("<p>Toeristenbelasting (excl. btw) € 1,50 per persoon</p>").price_eur, undefined);
});

test("prijs: 'Late check out kampeerplek kosten €12,50' is een toeslag", () => {
  assert.equal(page("<p>Late check out kampeerplek kosten €12,50. Late check out voor de accommodaties €20</p>").price_eur, undefined);
  assert.equal(page("<p>Kampeerplek (klein/groot) € 6,- of 9,- per dag</p>").price_eur, 6);
});

test("aantal plekken: 2 is te weinig om op te vertrouwen (boeking of groep), 3 of meer wel", () => {
  assert.equal(page("<p>Per boeking maximaal 2 kampeerplaatsen.</p>").capacity, undefined);
  assert.equal(page("<p>Wij hebben 3 kampeerplaatsen.</p>").capacity, 3);
});

// ── Steekproef 23 oktober 2026: zinnen die de scraper miste ──────────────────

test("wisseltijd: 'AANKOMST/VERTREK 11.00 uur wisselen' is vertrek uiterlijk 11:00", () => {
  const r = page("<p>2e auto € 1,00 AANKOMST/VERTREK 11.00 uur &#8217;s morgens wisselen uitzonderingen in overleg</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "11:00");
});

test("wisseltijd onder een kopje (de tijd staat in de lijst eronder)", () => {
  const r = page(`<p><strong>AANKOMST/VERTREK </strong></p><ul><li>11.00 uur &#8217;s morgens wisselen</li><li>uitzonderingen in overleg</li></ul>`);
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "11:00");
});

test("zonder 'wissel' blijft 'aankomst/vertrek 11.00' onbekend", () => {
  assert.equal(page("<p>Aankomst/vertrek 11.00 uur</p>").departure, undefined);
});

test("vertrekvenster met toeslag: tot het begin is vertrekken gratis", () => {
  const r = page("<p>Bij vertrek tussen 12.00 uur en 18.00 uur wordt € 8,00 extra in rekening gebracht.</p>");
  assert.equal(r.departure, "vast");
  assert.equal(r.checkout_until, "12:00");
});

test("'iedere 24 uur wordt er een nieuwe nacht in rekening gebracht' is per 24 uur", () => {
  assert.equal(page("<p>Camperplaats aan het wad. Let op: iedere 24 uur wordt er een nieuwe nacht in rekening gebracht.</p>").departure, "per24");
});

test("'je kunt maximaal 3 x 24 uur verblijven' is geen per 24 uur", () => {
  assert.equal(page("<p>Je kunt maximaal 3 x 24 uur op de camperplaats verblijven.</p>").departure, undefined);
});
