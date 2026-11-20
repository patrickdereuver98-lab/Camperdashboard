# VrijStaan: plan voor meer plekken en meer vertrektijden (20 november 2026)

> Opdracht Patrick (20 november 2026): "Er moet een optie zijn om meer data te vergaren en meer vertrektijden, meer
> plaatsen te vinden. Er zijn meer camperplaatsen en campings dan wij hebben nu in Nederland." Alles komt van het
> openbare internet.

Dit plan gaat over **dekking**: plekken die we nog niet kennen, en vertrektijden die we nog niet hebben. Het
[dataplan van 20 november](docs/dataplan-2026-11.md) gaat over **juistheid** en blijft voorgaan: een nieuwe bron
mag de juistheid van het kernfeit niet omlaag halen. Waar beide plannen hetzelfde werk noemen, staat hier een
verwijzing in plaats van een tweede taak.

Het vorige `plan.md` (basisversie, 23 oktober) staat nu in
[`docs/archief/plan-2026-10-23.md`](docs/archief/plan-2026-10-23.md). Verwijzingen als "`plan.md` P13, K1–K3, E5, §4b"
in de specs gaan over dat archiefstuk.

**Hoe dit plan tot stand kwam.** Twee onafhankelijke onderzoeken naar bronnen en aantallen, op dezelfde vraag:

- een onderzoek door Gemini, aangeleverd door Patrick;
- een onderzoek in deze sessie, met eigen metingen: taginfo voor OSM in Nederland, Overture-release 2026-11-18.0 via
  DuckDB, de WFS-dienst van Zeeland en een steekproef van 145 sites uit onze eigen database.

Daarnaast zijn de live cijfers uit de database gelezen, alleen met SELECT. Patrick vroeg om het onderzoek met Fable te
doen, maar Fable gaf in deze sessie de foutmelding "requires usage credits". Het onderzoek is daarom op Opus gedaan
(zie README 140).

**Hoe je de cijfers leest.** Waar de twee onderzoeken verschillen, geldt het gemeten cijfer. Een cijfer zonder meting
is een hypothese en staat zo in de tabel (§3).

Status: ✅ klaar · 🔄 bezig · ⬜ open · 👤 alleen Patrick.

---

## 1. De kern in vijf punten

1. **Het gat is echt, maar kleiner bij campings dan bij camperplaatsen.** Het CBS telt 2.682 kampeerterreinen. Wij
   hebben 2.723 campings plus boerderijen in de database, maar daar zitten ook concepten en dubbelingen tussen. Bij
   camperplaatsen is het gat groot: wij hebben er 364, terwijl schattingen uitkomen op 500 tot 1.800. Bij jachthavens
   met camperplekken hebben we er 45, tegenover een schatting van 50 tot 250.
2. **OpenStreetMap is bijna leeg gehaald.** Er komen hoogstens 50 tot 150 plekken bij. De nieuwe plekken komen uit
   Overture Places (±1.015 kandidaten, waarvan 764 met een website), uit provinciale open data (Zeeland alleen al 94)
   en uit gemeentebesluiten over camperplaatsen.
3. **Meer vertrektijden komen vooral uit dieper lezen van de eigen site.** Denk aan reserveren, tarieven,
   huisregels, voorwaarden en pdf's. Vaste gegevens leveren weinig op: `checkoutTime` in JSON-LD staat op ±1–2% van de
   sites.
4. **Het boekingssysteem van een camping is een nieuwe en serieuze route.** Tommy Booking Support draait op ±20% van
   de sites in onze steekproef. Wat een camping op zijn eigen site toont, mag de lezer lezen (tier 2). Bulk ophalen
   bij de leverancier doen we alleen met een afspraak.
5. **Gemeenten zijn de bron voor camperplaatsen.** Het aanwijzingsbesluit en de APV noemen de plek, het aantal campers
   en de maximale verblijfsduur. Gemeenten zijn al tier 1 (README 138).

## 2. Waar we staan (live, 20 november 2026)

| | Online | Concept | Verborgen |
|---|---|---|---|
| Camping | 1.663 | 731 | 24 |
| Camperplaats | 296 | 64 | 4 |
| Boerderij | 218 | 84 | 3 |
| Jachthaven | 36 | 8 | 1 |
| Parkeerplaats | 0 | 3 | 1 |
| **Totaal** | **2.213** | **891** | **33** |

- **Vertrektijd.** 1.476 van de 2.213 online plekken hebben er een. 737 missen hem; bij 638 daarvan staat een
  e-mailadres van de plek.
- **OSM in staging.** De laatste OSM-rondes leverden 3.558 unieke objecten op (`osm_staging`). 466 daarvan staan niet
  in `places`:
  - 311 campings, 71 camperplaatsen, 41 boerderijen, 11 parkeerplaatsen en 7 jachthavens;
  - 149 hebben een website, 47 hebben geen naam;
  - een deel is bewust opgeruimd (121 als "onbereikbaar" in `geo_master`).
- **Tweede bronnen.** `geo_master` heeft 1.630 kandidaten met "één bron uit tier 3–5" geweigerd, waarvan 1.355 van
  Archies (geblokkeerd, README 138). Er staan dus geen nieuwe open bronnen klaar die nog gepromoveerd moeten worden.

## 3. Wat de twee onderzoeken zeggen, en wat we aannemen

| Vraag | Onderzoek in deze sessie (gemeten) | Gemini (niet gemeten) | Wat we aannemen |
|---|---|---|---|
| Aantal kampeerterreinen | CBS 82062NED: **2.682** (september 2026, vanaf 4 standplaatsen); KvK SBI 5530: 2.360 | 1.350–1.550 ("vanaf ±10 standplaatsen") | **2.682** als meetlat. Het Gemini-cijfer past niet bij de CBS-tabel |
| Camperplaatsen | Geen officiële telling. Campercontact noemde 1.755 in 2019; OSM `caravan_site` 503 | 1.300–1.650 | **500–1.800**, lage zekerheid. Het gat zit hier |
| Boerderij- en minicampings | SVR ±2.000 in Nederland en buitenland samen; geen ledental VeKaBo | 1.200–1.500 | Onbekend; zit in de 2.682 van het CBS |
| Jachthavens met camperplek | CBS 84133NED: 400 particuliere havens, 23% verhuurt plaatsen (±90) | 150–250 | **50–150** |
| Extra uit andere OSM-tags | taginfo: parkeren met `motorhome` ±58, `camp_site=basic` 10 | +400 tot +900 | **+50 tot +150**. Gemini schat te hoog |
| Wikidata | 17 campings (SPARQL) | 300–600 | Niet de moeite |
| Overture Places | 4.668 `campground` + 346 `rv_park`; ±1.015 meer dan 300 m van een plek van ons, 764 met website | 3.500–5.000 relevant | **±1.015 kandidaten, veel ruis**; per plek nakijken |
| Provinciale open data | Zeeland (CC0): 551 objecten, 94 niet bij ons; Overijssel, Zuid-Holland en Utrecht bestaan | Genoemd, niet geteld | Hoge waarde, tier 1 |
| `checkoutTime` in JSON-LD | 2 van 145 sites (±1–2%) | 10–20% | **±1–2%**. Goedkoop, weinig opbrengst |
| Vertrektijd in de tekst bij dieper lezen | 28 van 144 sites, met de homepage en ≤ 3 pagina's voor reserveren of tarieven | +150 tot +250 | Grootste route |
| Boekingssystemen | Tommy ±20% (29/144), Booking Experts 4, Camping.care 2, Recranet 2. De API van Booking Experts werkt alleen met een sleutel | Booking Experts en Camping.care hebben "publieke JSON-endpoints met check-out" | **Eerst nagaan per systeem** (taak B2.1). Gemini noemt Tommy niet, terwijl dat het grootste systeem in de steekproef is |
| Gemeentebesluiten | Niet onderzocht | SRU-API Officiële Bekendmakingen (1.942 treffers op "camperplaats") en APV via lokaleregelgeving.overheid.nl | Goed idee, tier 1, eerst een proef (A5) |
| Betaalzuilen (Aanuit.net, i-Marina) | Niet onderzocht | Aanwijzing voor afrekenen per 24 uur | Alleen als **aanwijzing** voor Beheer, nooit vanzelf `24h` (§7) |
| Google Places | Alleen `place_id` mag je blijvend opslaan | Zelfde | Niet als bron |
| KvK | Open set heeft geen naam en geen volledig adres; selecties uit het Handelsregister zijn betaald | Betaald, AVG-beperkt | Niet |

**Gemini noemt ook dingen die niet bestaan.** Het rapport heeft het over een "besluit 6.4" met tabellen `url_cache`
en `discovery_candidates`. Het dataplan heeft vier besluiten (§6), en geen van die tabellen bestaat. De tabel
`service_points` bestaat al. Voor kandidaten gebruiken we de bestaande `geo_master`.

## 4. Spoor A: meer plekken

Elke nieuwe plek komt binnen als kandidaat in `geo_master`. Pas met een bron die telt (bronnenbeleid §2) wordt het een
concept, en hij gaat pas online volgens de publicatieregels van README 139. Er komt geen nieuwe publicatieroute.

| # | Werk | Levert op | Bron en tier | Omvang |
|---|---|---|---|---|
| A1 | **De 466 OSM-objecten die nooit in `places` landden** per reden indelen: opgeruimd, geen naam, dubbel, nooit verwerkt. Wat ten onrechte ontbreekt alsnog verwerken. Daarna de query uitbreiden met `amenity=parking` met `motorhome`, `leisure=marina` met `motorhome`, `camp_site=basic`, en `tents=only` alleen als `motorhome=yes` er ook staat | +50 tot +150 plekken, vooral camperplaatsen | OSM, tier 1 | S |
| A2 | **Provinciale open data**: Zeeland (CC0), Overijssel (CC0), Zuid-Holland (staat al in `bronnen.json`) en Utrecht als laag in `run_pipeline.py`. Met `zoek_ckan.py` op data.overheid.nl zoeken naar de andere acht provincies | Zeeland +94 (gemeten); alle vier samen naar schatting tot +250 | Overheid, tier 1. De datasets noemen zichzelf "indicatief": een kandidaat zonder bereikbare website of zonder tweede bron gaat naar Beheer | S tot M |
| A3 | **Overture Places** (`campground`, `rv_park`, `marina`, alleen confidence ≥ 0,7) als kandidatenlaag in `geo_master`. Koppelen op afstand en domein. Een kandidaat telt pas als de eigen site hem bevestigt: de lezer haalt naam, adres en "camper" of "kampeer" van de eigen site. Eerst de 764 met website | +300 tot +700 plekken (schatting, veel ruis: stacaravanparken, gesloten, dubbel) | CDLA-Permissive-2.0 en Apache-2.0. Overture is een verzamelbron en krijgt **tier 3**: aanwijzing, geen bewijs. Eigen site tier 2 bevestigt | M |
| A4 | **Jachthavens**: OSM `leisure=marina` met website (1.198 objecten) door de lezer halen op "camper", "kampeerauto", "passanten" en "havenreglement". Alleen met een citaat over campers wordt het een kandidaat | +20 tot +60 jachthavens, vaak met `24h` of `vrij` | OSM tier 1 voor de plek, eigen site tier 2 voor het feit | M |
| A5 | **Gemeentelijke camperplaatsen.** Proef met de SRU-API van Officiële Bekendmakingen ("aanwijzingsbesluit" en "camperplaats") en met APV-artikelen op lokaleregelgeving.overheid.nl. Per besluit: gemeente, locatie, aantal campers, maximale verblijfsduur (`max_stay_nights`) en een letterlijk citaat. Eerst 30 besluiten met de hand nakijken, dan pas automatisch | +100 tot +250 camperplaatsen (schatting Gemini, nog niet gemeten) plus de verblijfsregel | Overheid, tier 1 (README 138) | M |

**Ontdubbelen** geldt voor elke laag: `merge_master.ts` met naam, afstand en domein. Een kandidaat binnen 150 m van
een bestaande plek met een gelijk domein is dezelfde plek en voegt alleen feiten toe. Bij twijfel beslist Beheer, en
nooit maakt het systeem vanzelf een tweede plek.

## 5. Spoor B: meer vertrektijden

| # | Werk | Levert op | Omvang |
|---|---|---|---|
| B1 | **JSON-LD en OSM.** De lezer leest `checkoutTime` en `checkinTime` uit JSON-LD van het type `Campground` of `LodgingBusiness`. De OSM-ingest leest `check_out` (75 objecten). Allebei met citaat, bron tier 2 of tier 1 | +30 tot +75 vertrektijden | S |
| B2 | **Boekingssystemen.** (1) *Onderzoek eerst*: per systeem (Tommy, Booking Experts, Camping.care/Starfish, Recranet) bij 5 echte campings nagaan wat de openbare widget op de eigen site toont: vertrektijd, tarief, toeslagen. Geen sleutels, geen inlog. (2) *Herkennen*: de lezer legt per plek vast welk systeem de site gebruikt (`website_fields.boekingssysteem`), op scriptnaam of iframe. (3) *Lezen*: alleen bij een systeem waar stap 1 een vaste plek voor de vertrektijd vond, en alleen de widget van die ene camping. Valt onder tier 2. (4) Bulk bij de leverancier ophalen alleen met een schriftelijke afspraak 👤 | Bij ±20% van de sites mogelijk een vaste bron voor vertrektijd en prijs (onzeker tot stap 1 klaar is) | M |
| B3 | **Dieper lezen.** Uitbreiding van dataplan 2.5: `sitemap.xml` gebruiken om pagina's te kiezen, linkteksten en paden wegen (reserveren, tarieven, prijzen, huisregels, reglement, voorwaarden, FAQ, aankomst en vertrek) en pdf's lezen. Eerst de 737 online plekken zonder vertrektijd, dan de 891 concepten. Elke parserwijziging eerst langs de gouden set (dataplan 1.1) | +300 tot +600 vertrektijden (schatting op basis van 28 uit 144) | M |
| B4 | **Betaalzuil of app als aanwijzing.** Noemt de site Aanuit.net, i-Marina of een betaalautomaat, dan zet de lezer een aanwijzing in Beheer: "mogelijk per 24 uur". Nooit vanzelf `24h`; daarvoor is een citaat over de verblijfsregel nodig | Snellere afhandeling van camperplaatsen en jachthavens in Beheer | S |
| B5 | **Eigenaren mailen**: dataplan 3.1 (README 135 en 138). Wacht op `outreach_key`, het Resend-domein en een site zonder Vercel-login 👤 | De enige route naar 85% of meer | S om aan te zetten |

## 6. Spoor C: meten of het werkt

- **Dekking per provincie en soort.** Wij tegenover het CBS (82062NED per provincie) voor campings, en tegenover OSM
  plus Overture plus provincie voor camperplaatsen. Komt als regel in de datategel (dataplan spoor 5), zodat zichtbaar
  is waar het gat zit.
- **Per nieuwe laag**: kandidaten, bevestigd door de eigen site, gepromoveerd, online, dubbel en afgewezen. Een laag
  waar meer dan 30% van de bevestigde plekken achteraf dubbel of gesloten blijkt, stopt tot hij is bijgesteld.
- **Steekproef.** Van elke nieuwe laag 30 plekken met de hand nakijken voordat de rest promoveert.

## 7. Spelregels voor dit plan

- Er gaan geen nieuwe bronnen boven de regels van het [bronnenbeleid](docs/bronnenbeleid.md). Overture is tier 3
  (§4, A3); provincies en gemeenten zijn tier 1.
- **De vertrekregel volgt alleen uit een citaat.** "Maximaal 3 × 24 uur" in een APV is een maximale verblijfsduur
  (`max_stay_nights = 3`). Het zegt niets over hoe laat je weg moet. Zonder een citaat over de vertrektijd blijft de
  vertrekregel leeg; we leiden geen `vrij` of `24h` af. Gemini adviseert hier `vrij`. Dat nemen we niet over: het is
  een afgeleid feit, en nooit verzinnen gaat voor.
- Niet gebruiken: Google Places als bron, KvK, Wikidata, OpenTripMap, en directories in bulk (Campercontact,
  park4night, ACSI, ANWB, SVR, Natuurkampeerterreinen). Directories blijven losse aanwijzingen, zoals nu.
- Elke nieuwe laag krijgt een test in `tools/data-collectors/test_collectors.py` of `web/tests/`, een regel in
  `bronnen.json` met licentie en URL, en een vermelding van de bron op de pagina Bronnen van de site (ODbL, CDLA, CC0).

## 8. Volgorde

De bevriezing begint op 19 december (dataplan §4). Spoor A levert nieuwe concepten op. Die gaan pas online als ze de
regels van README 139 halen.

| Week | Spoor A | Spoor B | Spoor C |
|---|---|---|---|
| 23 tot en met 29 november | A1 OSM-gat, A2 Zeeland | B1 JSON-LD en OSM `check_out`, B2.1 onderzoek boekingssystemen | Dekkingsregel in de datategel |
| 30 november tot en met 6 december | A2 overige provincies, A3 Overture: eerste 100 met de hand | B3 dieper lezen (na gouden set) | Steekproef A1 en A2 |
| 7 tot en met 13 december | A3 de rest van de 764, A4 jachthavens | B2.2 herkennen, B4 aanwijzing | Steekproef A3 |
| 14 tot en met 18 december | A5 proef met 30 gemeentebesluiten | B2.3 alleen als B2.1 een vaste plek vond | Tussenstand naar Patrick |
| Januari | A5 automatisch, A3 zonder website | B5 zodra de mail aan kan | Maandelijkse steekproef |

## 9. Doelen voor 1 februari 2027

| Maat | 20 november | Doel |
|---|---|---|
| Camperplaatsen in de database (alle statussen) | 364 | ≥ 550 |
| Jachthavens met camperplek | 45 | ≥ 70 |
| Campings en boerderijen tegenover het CBS (2.682) | geen meting (dubbel en concept niet uitgesplitst) | Gemeten per provincie; elke provincie ≥ 85% |
| Online plekken met vertrektijd | 1.476 | ≥ 1.900 (zonder mail aan eigenaren) |
| Juistheid vertrekregel (steekproef) | 75% | ≥ 90% (doel van het dataplan, gaat voor) |
| Nieuwe plekken die achteraf dubbel of gesloten zijn | — | ≤ 10% per laag |

## 10. Besluiten voor Patrick 👤

1. **Overture Places als kandidatenbron, tier 3** (A3). Een plek telt pas na bevestiging door de eigen site.
   *Advies:* ja. De licentie is ruim en het is de grootste bron van nieuwe plekken.
2. **Nieuwe kolom of veld voor het boekingssysteem** (`website_fields.boekingssysteem`, B2.2). Dat valt in jsonb, dus
   er is geen nieuw schema nodig. *Advies:* ja.
3. **Contact met Tommy Booking Support of Qenner** over een koppeling, zoals Campercontact die heeft (B2.4).
   *Advies:* pas na B2.1, als blijkt dat de widget de vertrektijd vast toont.
4. **Natuurkampeerterreinen en SVR vragen** om toestemming hun lijst als aanwijzing te gebruiken, met een link terug.
   *Advies:* ja, het kost alleen een mail. Tot er een ja is, verandert er niets.
5. **Mail aan eigenaren** technisch afmaken: Resend-domein, `outreach_key`, site zonder Vercel-login (README 135 en
   138). Dit blijft de grootste hefboom voor vertrektijden.
