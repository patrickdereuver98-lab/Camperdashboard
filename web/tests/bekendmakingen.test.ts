// Officiële bekendmakingen: één echt record (Gemeenteblad 2021, 41975), ingekort tot de velden die we gebruiken.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pageUrl, parsePage, QUERY } from "../supabase/functions/pipeline/bekendmakingen";

const record = (extra = "") => `<sru:record><sru:recordData><gzd:gzd><gzd:originalData><overheidwetgeving:meta><overheidwetgeving:owmskern>
<dcterms:identifier>gmb-2021-41975</dcterms:identifier><dcterms:title>Verleende omgevingsvergunning: Dorpsstraat 11, Vriescheloo, realisatie camperplaats &amp; sanitair</dcterms:title>
<dcterms:type scheme="OVERHEIDop.Gemeenteblad">Beschikkingen | afhandeling</dcterms:type><dcterms:creator scheme="overheid:Gemeente">Westerwolde</dcterms:creator>
</overheidwetgeving:owmskern><overheidwetgeving:owmsmantel><dcterms:available>2021-02-11</dcterms:available></overheidwetgeving:owmsmantel>
<overheidwetgeving:tpmeta><overheidwetgeving:postcodeHuisnummer>9699PA 11</overheidwetgeving:postcodeHuisnummer><overheidwetgeving:straatnaam>Dorpsstraat</overheidwetgeving:straatnaam>
<overheidwetgeving:woonplaats>Vriescheloo</overheidwetgeving:woonplaats><overheidwetgeving:gebiedsmarkering><overheidwetgeving:Punt>
<overheidwetgeving:locatiepunt>53.0931776337648 7.14357567607883</overheidwetgeving:locatiepunt></overheidwetgeving:Punt></overheidwetgeving:gebiedsmarkering>
</overheidwetgeving:tpmeta></overheidwetgeving:meta></gzd:originalData><gzd:enrichedData><gzd:preferredUrl>https://zoek.officielebekendmakingen.nl/gmb-2021-41975.html</gzd:preferredUrl>${extra}
</gzd:enrichedData></gzd:gzd></sru:recordData></sru:record>`;

test("record met adres en coördinaten", () => {
  const xml = `<sru:searchRetrieveResponse><sru:numberOfRecords>758</sru:numberOfRecords><sru:records>${record()}</sru:records><sru:nextRecordPosition>101</sru:nextRecordPosition></sru:searchRetrieveResponse>`;
  const { items, next, total } = parsePage(xml);
  assert.equal(total, 758);
  assert.equal(next, 101);
  assert.deepEqual(items, [
    {
      id: "gmb-2021-41975",
      title: "Verleende omgevingsvergunning: Dorpsstraat 11, Vriescheloo, realisatie camperplaats & sanitair",
      url: "https://zoek.officielebekendmakingen.nl/gmb-2021-41975.html",
      authority: "Westerwolde",
      type: "Beschikkingen | afhandeling",
      street: "Dorpsstraat",
      postcode: "9699PA",
      town: "Vriescheloo",
      date: "2021-02-11",
      lat: 53.0931776337648,
      lng: 7.14357567607883,
    },
  ]);
});

test("laatste pagina heeft geen volgende positie; record zonder geldige link valt weg", () => {
  const bad = record().replace("https://zoek.officielebekendmakingen.nl/gmb-2021-41975.html", "http://elders.nl/x");
  const { items, next } = parsePage(`<sru:numberOfRecords>1</sru:numberOfRecords>${bad}`);
  assert.equal(items.length, 0);
  assert.equal(next, null);
});

test("coördinaten buiten Nederland worden leeg", () => {
  const { items } = parsePage(record().replace("53.0931776337648 7.14357567607883", "48.1 11.5"));
  assert.equal(items[0].lat, null);
  assert.equal(items[0].lng, null);
});

test("zoekvraag noemt de termen en pagineert", () => {
  assert.match(QUERY, /dt\.title="camperplaats" OR dt\.title="camperstandplaats"/);
  assert.match(pageUrl(201), /startRecord=201/);
  assert.match(pageUrl(1), /maximumRecords=100/);
});
