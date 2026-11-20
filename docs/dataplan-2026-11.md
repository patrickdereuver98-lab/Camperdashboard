# Dataplan: maximaal en relevant (20 november 2026)

> Opdracht Patrick (20 november 2026, na versie 0.9.2): "volledig richten op onze data; zoek uit hoe het nu werkt en
> zorg dat de data die we verzamelen en kunnen hebben maximaal en relevant is." Bouwt voort op de
> [review van 16 november](review-2026-11-16.md) (R56 tot en met R91) en het [statusbord](LANCERING.md). Alle cijfers
> komen uit de live database op 20 november 2026, ±07:40 UTC, en zijn alleen gelezen (SELECT).

## Stand van uitvoering (20 november 2026, na akkoord van Patrick op alle vier besluiten)

| Stap | Stand |
|---|---|
| Besluiten (§6) | Vastgelegd in README 138. Archies live geblokkeerd en uit de repo. Mail aan eigenaren besloten, maar technisch nog niet mogelijk (geen `outreach_key`, geen Resend-domein, site achter de Vercel-login) |
| 1.1 Gouden set | ✅ 23 pagina's (5 andere waren niet bruikbaar: JavaScript of 404). Vooraf vertrek 16/23, prijs 11/20; met parser 46 alles goed |
| 1.2 Voorstellen | ✅ Live afgehandeld: 3 vertrekregels overgenomen (Roland, Resort Eindhoven, De Bronckhorst uit een gids), 10 afgewezen (verhuur, aankomst); 2 prijzen overgenomen (De Victorie uit de steekproef, 't Deppert van de eigenaar), 33 prijsvoorstellen van parser 45 afgewezen. Zonder vertrektijd volledig nagekeken: 22 bevestigd, 6 voorwaardelijk, 2 eraf (Landgraaf, Bodelaeke). `health()` telt voorstellen ouder dan 7 dagen (na samenvoegen) |
| 1.3 Extractor | ✅ Parser 46 (zie CHANGELOG) |
| 1.4 Herlezing | ⬜ Na samenvoegen en uitrollen van de pipeline |
| 1.5 Constraints | ✅ In migratie `20261120100000`, droog getest op live (0 schendingen) |
| 2.1 tot en met 2.3 OSM | ✅ Ruwe tags, hoogte, gewicht, betaalwijze, controledatum, servicepunten; vult zich bij de volgende OSM-ronde na samenvoegen. Tonen op de site volgt als de kolommen live staan |
| 2.4 en 2.5 Lezer | ✅ Maximaal aantal nachten, ruimere lengte, "check out" in linkteksten, één niveau hoger bij een 404 |
| 3.1 Mail | Volgorde camperplaatsen zonder vertrekregel eerst (na samenvoegen); aanzetten wacht op de drie technische stappen |

## 1. Wat "maximaal en relevant" hier betekent

**Relevant** is een gegeven als het helpt bij de vraag van de camperaar: *waar sta ik vannacht, hoe laat moet ik weg,
wat kost het, en past mijn camper?* Daaruit volgt een vaste volgorde:

| Laag | Velden | Waarom |
|---|---|---|
| Kernfeit | Vertrekregel en vertrektijd; nachtprijs met toeslagen | De belofte van VrijStaan (PRD) |
| Beslisfeit | Open of seizoen, laatste aankomst, past mijn camper (lengte, hoogte, gewicht), stroom, water, lozen, honden, reserveren nodig, betaalwijze | Bepaalt of je erheen rijdt |
| Comfort | Toilet, douche, wifi, ondergrond, aantal plaatsen | Helpt kiezen tussen twee plekken |
| Niet verzamelen | Lange beschrijvingen van andermans site, contactgegevens in bulk, alles van een bron zonder toestemming | Weinig waarde, wel juridisch risico (R75, R80, R81) |

**Maximaal** betekent: elke bron die we mogen gebruiken wordt benut, er gaat niets stil verloren, en elk feit heeft een
bron en een datum. Verzinnen blijft verboden: onbekend blijft leeg.

## 2. Hoe het nu werkt

### 2.1 De keten

Ongewijzigd ten opzichte van [review 16 november §4.1](review-2026-11-16.md#41-de-keten-van-bron-tot-scherm), met de
fixes uit 0.9.1 erbij (beheerslot, veldlog, geschiedenis per plek, niets meer weggooien, stealth-lezer weer aan):

1. **OpenStreetMap** per provincie (Overpass, elke 7 dagen) → `osm_staging` → `ingest_osm` → `places`. Daarnaast een
   aparte query voor los- en waterpunten (`ingest_osm_points`).
2. **Website zoeken** voor plekken zonder website (`discover`).
3. **Adres** uit PDOK.
4. **Website lezen**: gewone lezer (edge `pipeline`, `extract.ts`) en stealth-lezer (GitHub Actions, `lezer.py`), beide
   via `apply_scrape`. Elke wijziging aan een kernveld gaat naar `private.field_log` en `place_history`.
5. **Tweede bronnen** (`run_pipeline.py`: OSM, Archies, PDOK Zuid-Holland) → `geo_master` → `promote_geo_master`.
6. **Mensen**: Doe mee, eigenaar, beheer → `submissions` en `updates_queue` → beheer.
7. **Publiceren**: drempel 0,45 in `places_before_write`.

### 2.2 Stand op 20 november

**Plekken.** 3.137 in totaal: 2.168 gepubliceerd, 936 concept, 33 verborgen.

**Vulgraad van de gepubliceerde plekken** (procent met een waarde):

| Veld | Alle (2.168) | Camping (1.641) | Camperplaats (281) | Boerderij (210) | Jachthaven (36) |
|---|---|---|---|---|---|
| Vertrekregel | **69** | 73 | **49** | 72 | 39 |
| Nachtprijs | **50** | 41 | 91 | 55 | 75 |
| Toeslagen | 69 | 70 | 57 | 77 | 47 |
| Seizoen of jaarrond | 62 | 63 | 57 | 61 | 64 |
| Aankomst vanaf | 53 | 57 | 27 | 63 | 22 |
| Laatste aankomst | **9** | 10 | 8 | 10 | 6 |
| Stroom | 94 | 93 | 99 | 94 | 94 |
| Water | 56 | 52 | 83 | 49 | 83 |
| Lozen | 44 | 36 | 87 | 40 | 72 |
| Honden | 67 | 68 | 68 | 67 | 53 |
| Reserveren | 58 | 59 | 61 | 51 | 61 |
| Maximale lengte | **9** | 8 | 12 | 8 | 14 |
| Ondergrond | 4 | 0 | 23 | 4 | 22 |
| Maximaal aantal nachten | 2 | 0 | 12 | 0 | 8 |
| Toegang (24/7 of uren) | 4 | 3 | 12 | 3 | 11 |
| Adres | 84 | 85 | 78 | 84 | 61 |
| Vertrekregel door een mens bevestigd | 1 | 1 | 5 | 1 | 0 |

**Herkomst.** Alle gepubliceerde plekken hebben OSM; 2.155 een gelezen website, 1.521 via de stealth-lezer, 1.015 PDOK,
125 een beheerslot. 26 vertrekregels zijn door een mens bevestigd, waarvan de 20 plus 3 op Zonder vertrektijd (A.4).

**Parser.** 804 gepubliceerde plekken zijn gelezen met parser 45, 1.337 nog met parser 43, 27 met 38 of onbekend. Van
de 670 plekken zonder vertrekregel staan er nog maar 7 op parser 43: de herlezing heeft de lege plekken grotendeels
gehad. Wat overblijft op 43 zijn juist plekken mét een vertrekregel, en daar zitten de oude fouten (R56, R57, R63).

**Wat de keten de afgelopen 24 uur deed** (`field_log`, parser 45):

| Veld | Gevuld | Veranderd | Gewist |
|---|---|---|---|
| Vertrekregel | 61 | 0 | 4 |
| Vertrektijd | 59 | 1 | 4 |
| Nachtprijs | 18 | 36 | **66** |
| Toeslagen | 19 | 58 | 38 |
| Seizoen | 15 | 17 | 27 |
| Jaarrond | 17 | 3 | 31 |

De vertrekregel groeit (+57 netto). De prijs krimpt (−48 netto): parser 45 is strenger, maar in de steekproef van
gewiste prijzen zitten ook camperplaatsen met € 10 tot € 25, en dat zijn juist plausibele prijzen. Zonder gouden set
(R69) weten we niet of dit verbetering of verlies is.

**Blijft liggen.**

- `updates_queue`: 64 voorstellen van de pipeline staan op *pending* (een nieuwe lezing die botst met een beheerslot:
  34 prijs, 30 vertrek), plus 4 van Doe mee en 1 van een eigenaar. Niemand handelt ze af.
- `manual_review`: 17 plekken die ook de stealth-lezer niet kan lezen.
- Stealth-wachtrij: 36 open, de oudste sinds 25 oktober.

**Concepten.** 936, waarvan 909 met website en 908 al door de stealth-lezer gelezen. 399 halen een volledigheid van
0,40 of meer, maar slechts 14 hebben een vertrekregel. De eigen site zegt bij deze plekken weinig: meer lezen levert
hier weinig op, mensen wel.

**Tweede bronnen.** `geo_master` heeft 5.539 kandidaten: 3.769 gekoppeld, 1.767 geweigerd. Daarvan 1.630 omdat er maar
één bron uit tier 3 tot 5 is (vooral Archies: 1.355 vermeldingen), 121 omdat ze eerder zijn opgeruimd en 16 zonder
bruikbare naam.

**OSM.** De pipeline zet OSM-tags om naar onze velden en bewaart de ruwe tags niet. Niet gebruikt worden onder meer
`maxheight`, `maxweight`, `fee`, `payment:*`, `check_date` en `opening_hours` anders dan 24/7. Los- en waterpunten verder
dan 150 m van een plek worden weggegooid (`ingest_osm_points`), terwijl een losplek in de buurt juist nuttig is.

**Bezoekers.** 168 gebeurtenissen in totaal (131 paginaweergaven, 1 doorklik), 0 reviews, 4 correcties, 1
drukte-melding. Er zijn nog geen echte bezoekers (site achter de Vercel-login, R1).

**Eigenaren.** 590 van de 670 gepubliceerde plekken zonder vertrekregel hebben een e-mailadres. De mail naar eigenaren
(PR #165) staat live, maar verzenden staat uit (besluit 4 op het statusbord).

### 2.3 Wat dat betekent

1. **Juistheid gaat vóór dekking.** De review vond 75% juiste vertrekregels en 39% juiste prijzen. 1.337 plekken staan
   nog op de oude parser. Meer velden vullen met een lezer die een kwart fout doet, maakt de gids slechter.
2. **De eigen website is bijna uitgeput** voor het kernfeit: de lege plekken zijn herlezen en bij ±60% zegt de site
   niets (review §4.4). De groei moet komen van eigenaren, gemeenten en bezoekers.
3. **Er liggen gratis gegevens op de plank**: OSM-tags die we weggooien, los- en waterpunten, en velden die de lezer al
   tegenkomt maar niet vastlegt (laatste aankomst, betaalwijze, lengte).
4. **Het menselijke deel staat stil**: 69 voorstellen wachten, en geen eigenaar is gemaild.
5. **"Past mijn camper" is grotendeels onbekend** (lengte 9%, hoogte en gewicht 0%), terwijl de routeplanner en het
   camperprofiel daarop rekenen.

## 3. Het plan

Vijf sporen. Spoor 1 gaat voor; spoor 2 en 3 lopen ernaast. Alles valt onder R41 (kernbelofte), behalve waar "na de
livegang" staat.

### Spoor 1: wat er staat, klopt (week 1 en 2)

| # | Werk | Levert op | Omvang | Punten |
|---|---|---|---|---|
| 1.1 | **Gouden set**: 30 echte pagina's (eerst de 15 fouten uit de steekproef en 10 van de 66 gewiste prijzen) met de verwachte uitkomst in `web/tests/golden/`; lezer en `test_merge.ts` in CI | Een meetlat: elke parserwijziging laat zien wat beter en slechter wordt | M | R69, B.2 |
| 1.2 | **Voorstellen afhandelen**: eerst de 7 nieuwe plekken op Zonder vertrektijd zonder bevestiging (binnengekomen met de herlezing) naast de eigen site leggen. Dan de 64 pipelinevoorstellen per plek naast de eigen site leggen en een advies geven in Beheer; Patrick of agent beslist. Daarna een vaste regel: een voorstel ouder dan 7 dagen komt in `health()` | Correcties komen echt aan; de belofte "binnen twee werkdagen" klopt weer | S | R86 |
| 1.3 | **Extractor met context**: alle tijden per site verzamelen en de camper- of kampeertijd kiezen; bij twee tijden leeg en naar Beheer; onderwerpcontrole (bus, sanitair, chalet, B&B, aankomst); "check out" met spatie; `verify()` op de hele zin; prijs met vaste etiketten (basis, extra persoon, bezoek, toeristenbelasting, stroom, huur) | Minder valse kernfeiten; Mijn reis telt geen verkeerde toeslagen | M tot L | R63, R60, B.3 |
| 1.4 | **Herlezing van de 1.337 plekken op parser 43**, in porties van 200, met per portie een vergelijking (gevuld, veranderd, gewist) en stoppen bij meer dan 5% gewiste kernfeiten | De bekende parserfouten uit de live data | M | R58, R62, B.4 |
| 1.5 | **Constraints op het kernfeit** (`checkout_until` als echte tijd, `vast` alleen met tijd, `lat`/`lng` binnen Nederland) met `NOT VALID` en daarna `VALIDATE` | Een foute waarde kan niet meer binnenkomen | S | R79 |

Doel na spoor 1: in de gouden set vertrek ≥ 90% juist en prijs ≥ 80% juist; Zonder vertrektijd 100% bevestigd.

### Spoor 2: gratis data die we nu laten liggen (week 1 tot en met 3)

| # | Werk | Levert op | Omvang |
|---|---|---|---|
| 2.1 | **Ruwe OSM-tags bewaren** in `sources.osm.tags` (alleen de tags van het object, geen geometrie), zodat een nieuw veld geen nieuwe ophaalronde nodig heeft | Toekomstvast; elk later veld is een query in plaats van een import | S |
| 2.2 | **Nieuwe OSM-velden**: `maxheight` en `maxweight` (nieuwe kolommen `max_height_m`, `max_weight_t`), `fee=yes/no` (betaald of gratis, zonder bedrag), `payment:*` (nieuwe kolom `payment`), `check_date` en `survey:date` als datum van het OSM-feit, `capacity:motorhome` voor het aantal camperplaatsen | "Past mijn camper" en betaalwijze krijgen een eerste vulling; OSM-feiten krijgen een leeftijd | M |
| 2.3 | **Los- en waterpunten als eigen laag**: tabel `service_points` (soort, plek, bron, OSM-id) in plaats van weggooien na 150 m; op de plekpagina "Dichtstbijzijnde losplek: 2,3 km" | Kans 9 uit de review; bruikbaar bij de 56% plekken zonder lozen | M |
| 2.4 | **De lezer legt meer vast** wat hij al ziet: laatste aankomst, slagboom of toegangstijden, betaalwijze (automaat, pin, contant, app), maximale lengte en maximaal aantal nachten. Alleen letterlijk uit de tekst, met citaat in `website_fields`. Gaat mee in de herlezing van 1.4 | Laatste aankomst (nu 9%) en lengte (nu 9%) omhoog | M |
| 2.5 | **Pagina's die de lezer mist**: FAQ, huisregels, reglement (ook PDF), tarieven; terugvallen op de startpagina bij een 404 (review §4.4 patroon 3) | De ±220 plekken waar de site de tijd wel noemt | M |

### Spoor 3: mensen als bron (vanaf week 2, na besluit)

| # | Werk | Levert op | Omvang |
|---|---|---|---|
| 3.1 | **Eigenaren mailen** (PR #165, staat klaar): eerst de 143 camperplaatsen zonder vertrekregel, daarna de rest van de 590 met e-mailadres. Eén link, opt-out, één herinnering | De enige route naar 90%; antwoord wordt een bevestigd feit met bron "eigenaar" | S om aan te zetten |
| 3.2 | **Gemeenten als bron voor camperplaatsen**: APV en gemeentepagina's noemen de maximale verblijfsduur en of je mag overnachten. Een zoekagent met letterlijk citaat, tier 1 in het bronnenbeleid | Camperplaatsen (vertrek nu 49%) krijgen een regel en een maximum aantal nachten | M |
| 3.3 | **Concepten die bijna online zijn**: per concept laten zien welk feit ontbreekt, en die lijst als Doe mee-opdracht per provincie aanbieden | Snelste weg van 399 bijna-plekken naar online | S |
| 3.4 | **Plekpuls** na een bewaarde nacht ("Moest je om 12:00 weg?"), meetellen pas na meerdere meldingen | Bevestigingen door camperaars | M, na de livegang |

### Spoor 4: bron en datum per feit (na de livegang, januari)

`place_history` en `field_log` bestaan sinds 0.9.1. Daarop bouwen we de datum en bron per kernveld (R87, README 128),
zonder het niet-live schema `bron` uit `20261108100000` op te tuigen:

- Een view `place_fact_dates` die per plek en kernveld de laatste bron en datum geeft uit `place_history`.
- Op de plekpagina "Vertrektijd: website, 3 december" in plaats van één "Laatste update".
- "Mogelijk verouderd" per kernveld na 12 maanden (het PRD-criterium gaat nu nooit af).

### Spoor 5: meten wat we hebben (week 2)

- **Datategel in Mission Control**: vulgraad per veld en per soort plek, met de week ervoor; gevuld, veranderd en gewist
  per dag uit `field_log`; open voorstellen en hun leeftijd. Dezelfde query als §2.2, als functie `data_kwaliteit()`.
- **Maandelijkse steekproef** van 30 plekken met de gouden-setwerkwijze; het cijfer is de juistheid, niet de dekking.
- **Zoekopdrachten zonder resultaat** meten (met toestemming, R86): laat zien welke plekken en velden bezoekers missen.

### Bewust niet of minder verzamelen

- **Archies** (1.355 kandidaten): niets promoveren tot er schriftelijke toestemming is; bestand uit de openbare repo
  (R81, besluit Patrick).
- **Beschrijving van de website**: niet in JSON-LD; op de pagina vervangen door een korte samenvatting uit onze eigen
  velden (R80, besluit Patrick).
- **Contactgegevens**: niet in bulk leesbaar voor `anon` (R75).
- **Statistieken**: alleen met toestemming, alleen geaggregeerd. Geen nieuwe meetpunten zonder doel.

## 4. Volgorde

| Week | Spoor 1 | Spoor 2 | Spoor 3 en 5 |
|---|---|---|---|
| 20 tot en met 26 november | 1.1 gouden set, 1.2 voorstellen | 2.1 ruwe tags, 2.2 OSM-velden | 5 datategel |
| 27 november tot en met 3 december | 1.3 extractor | 2.3 servicepunten, 2.4 extra velden | 3.1 mail aan (als besloten), 3.3 bijna-concepten |
| 4 tot en met 10 december | 1.4 herlezing, 1.5 constraints | 2.5 gemiste pagina's | 3.2 gemeenten |
| 11 tot en met 18 december | Herlezing afronden, tweede steekproef (D.1) | | |
| Vanaf 19 december | Bevriezen (fase 3) | | |
| Januari | | | Spoor 4, 3.4 |

Elke stap: eerst een test (gouden set of SQL-test), migratie in `web/supabase/migrations/`, pas live na samenvoegen,
en het statusbord bijwerken in dezelfde commit.

## 5. Doelen voor 1 januari 2027

| Maat | 20 november | Doel 1 januari |
|---|---|---|
| Zonder vertrektijd juist en bevestigd | 20 bevestigd en 3 voorwaardelijk van 30; 7 nieuw sinds de herlezing en nog niet nagekeken | 100% |
| Vertrekregel juist (steekproef) | 75% (16 november) | ≥ 90% |
| Prijs juist (steekproef) | 39% (16 november) | ≥ 80% |
| Gepubliceerd met vertrekregel | 69% | ≥ 75% zonder mail; ≥ 85% met mail aan eigenaren |
| Camperplaatsen met vertrekregel | 49% | ≥ 70% (gemeenten en eigenaren) |
| Maximale lengte of hoogte bekend | 9% | ≥ 25% (OSM en lezer) |
| Laatste aankomst bekend | 9% | ≥ 25% |
| Open voorstellen ouder dan 7 dagen | 69 | 0 |

## 6. Besluiten voor Patrick

1. **Eigenaren mailen** (3.1): aanzetten, te beginnen met de 143 camperplaatsen? *Advies:* ja, zodra domein en SMTP er
   zijn. Zonder dit blijft de vertrekregel rond 75%.
2. **Gemeenten als tier-1-bron** (3.2) in het bronnenbeleid. *Advies:* ja; overheidsinformatie, laag risico.
3. **Archies** (R81). *Advies:* blokkeren tot er toestemming is.
4. **Nieuwe kolommen** `max_height_m`, `max_weight_t`, `payment` en tabel `service_points` (2.2, 2.3). Dit is nieuw
   schema tijdens de bevriezing; het dient de kernvraag "past mijn camper". *Advies:* ja.

## 7. Welke plekken tonen (besluit voor Patrick, 20 november 2026)

**Hoe het nu werkt.** Een plek staat online als hij twee poorten haalt (trigger `places_before_write`):

1. *Harde eisen* (`place_meets_must_haves`): een contact (website, telefoon, e-mail of beheerder) en minstens 2 punten
   uit vertrekregel (telt 2), seizoen, stroom en prijs.
2. *Score* (`place_completeness`) van minstens 0,45: een weging van 14 velden (vertrekregel 4, seizoen 3, prijs 2, stroom
   2, contact 2, foto 1,5, water, lozen, toilet en honden elk 1, enzovoort, gedeeld door 20).

**Stand.** 2.168 online: 1.499 met vertrekregel, 669 grijs (zonder). Grijs per soort: camping 446 (waarvan 236 ook
zonder prijs), camperplaats 143, boerderij 58, jachthaven 22. Bij camperplaatsen is de helft grijs. 936 concepten:
46 halen de harde eisen maar niet de score, en daarvan hebben er **14 een vertrekregel**. Die zijn verborgen, terwijl de
PRD zegt dat een plek met vertrekregel "volledig" is. 21 concepten hebben geen enkel contact.

**Advies.**

- *Grijze plekken blijven tonen.* Verbergen halveert de camperplaatsen (281 naar 138), juist het aanbod waar de
  doelgroep 's avonds naar zoekt. Een grijze plek met "vertrektijd onbekend" en een oproep is eerlijk. Een plek die
  ontbreekt, vindt de camperaar gewoon bij de concurrent.
- *De score is geen goede poort.* Hij beloont foto, water en toilet, en houdt daardoor 14 plekken met het kernfeit
  verborgen. Voorstel: de score alleen gebruiken voor de volgorde, en publiceren op regels:
  - **volledig** (gewoon tonen): vertrekregel bekend en contact;
  - **onvolledig** (grijs, lager in de lijst, niet op de drie vertrekpagina's): geen vertrekregel, wel contact en minstens
    2 van prijs, seizoen en stroom;
  - **verborgen**: de rest.
  Effect: 46 plekken erbij (15 camperplaatsen, 14 met vertrekregel), er gaat er geen af.
- *Grijze plekpagina's niet laten indexeren* (`noindex, follow`) tot de vertrekregel bekend is. Een dunne pagina zonder
  het kernfeit helpt de vindbaarheid niet en kan haar schaden. In zoeken en op de kaart blijven ze wel staan.
- *Campings zonder vertrekregel én zonder prijs* (236) zijn de zwakste groep. Die tonen we wel, maar zij gaan als eerste
  in de mail aan eigenaren en in Doe mee. Lukt het daar niet binnen 3 maanden na de livegang, dan kijken we opnieuw.
