# Datareview en verbeterplan (18 oktober 2026)

> Drie alleen-lezen reviews, elk door een eigen agent uit `.claude/agents/`, daarna samengevoegd:
> **D** data in de live database (database-reviewer), **W** wat de site toont (code-explorer),
> **F** stille fouten in de pipeline (silent-failure-hunter). Stand na scraperrun v35, met 1.924 gepubliceerde plekken.

## Kernwaarde: halen we hem?

Deels. We tonen vaak een vertrektijd, maar we kunnen nog niet garanderen dat die klopt.

| Meetpunt | Doel (PRD) | Nu | Oordeel |
|---|---|---|---|
| Gepubliceerde plekken met vertrekregel | 40% | 62,5% | Gehaald |
| Bij camperplaatsen | | 43,6% (163 van 289 zonder) | Zwak, terwijl dit het belangrijkste type is |
| Bij jachthavens | | 29,0% | Zwak |
| Door een mens bevestigd | | 0 | Niet gehaald: `departure_check` is overal leeg |
| Zonder vertrektijd (vrij en per24) | 150 | 32, waarvan 6 tot 8 twijfelachtig of dubbel | Niet gehaald |
| Twijfelachtige vaste tijden | 0 | Geschat 5 tot 10% (FAQ-zinnen, OSM-openingstijden, voorwaarden) | Niet gehaald |
| Prijs | 75% | 55,8% (campings 47,6%) | Niet gehaald |

De pagina Zonder vertrektijd belooft "eerst bevestigde plekken" (`search-app.tsx:277`), maar er is er nog geen een.
De fouten zijn bovendien zichtbaar. Een voorbeeld: drie plekken staan op "uiterlijk 08:00" omdat in een FAQ de vraag
"Ik wil vóór 08:00 vertrekken, kan dat?" staat. Twee andere hebben 17:00 en 22:00 uit OpenStreetMap, en dat zijn
openingstijden.

## Wat we tonen en wat er misgaat (W)

| # | Ernst | Bevinding | Waar |
|---|---|---|---|
| W1 | Hoog | Foute vertrektijden zichtbaar: per24 op basis van een tarief bij de trailerhelling (`wsv-almere-haven`), per24 terwijl er "tot 12.00 uur" staat (`d-n-mastendol-dongen`), 08:00 uit FAQ-vragen, 17:00 en 22:00 uit OSM | Data, zie D2 en D4 |
| W2 | Hoog | 231 plekken tonen "Prijs onbekend" terwijl een prijs per persoon bekend is: `cardPrice` neemt alleen "per persoon" in de toeslagen mee. Zoeken en sorteren doen het net anders | `format.ts:245`, `trip-extras.ts:5`, `search.ts:263,272` |
| W3 | Middel | Bij niet-bevestigde plekken verdwijnt het label "per 24 uur" | `format.ts:229`, plekpagina `page.tsx:333,346` |
| W4 | Middel | Toeslagen zonder eenheid (2.254) en tegenstrijdige toeristenbelasting (71 plekken); de hints verschillen per scherm | `place-ui.tsx:381`, `page.tsx:239,267` |
| W5 | Middel | De kaartpopup toont geen vertrektijd, en alle markers zijn bosgroen | `place-map.tsx:208` |
| W6 | Middel | "Bevestigd eerst" werkt alleen bij de sortering Aanbevolen. Dichtbij heeft geen filter op voertuiglengte | `search.ts:245`, `nearby-app.tsx:64,97` |
| W7 | Laag | De teller "x van 12 bekend" klopt niet; legenda- en filterteksten lopen uiteen; het label "Dag en nacht open" | Plekpagina, filters |
| W8 | Laag | Het hele Place-object, inclusief `timesNote`, gaat naar de browser. Vertrektijden worden als tekst vergeleken | `page.tsx:294`, `search.ts:51` |
| W9 | Laag | `snapshot.json` (de terugval) heeft 680 plekken en loopt dus ver achter | `web/src/data/snapshot.json` |

## Wat de data mist (D)

| # | Ernst | Bevinding | Aantal |
|---|---|---|---|
| D1 | Hoog | Geen enkele vertrektijd is door een mens bevestigd | 0 van 3.582 |
| D2 | Hoog | Twijfelachtige vrij/per24-waarden: een zin over toegang (24/7) of alleen aankomst, een tweede zin die de regel tegenspreekt (`camping-gideonse`, `eurocamping-vessem-middelbeers`, `camping-halfweg-wisch`), per24 uit een prijszin ("€ 10 per 24 uur") | 6 tot 8 van 32 |
| D3 | Hoog | Camperplaatsen zonder vertrekregel | 163 van 289 |
| D4 | Hoog | Foute vaste tijden: FAQ-vraag of parkeerregel (08:00, 3 plekken), OSM na 14:00 (2). Daarnaast: 33 bronzinnen beginnen met rommel, 7 bevatten een vraag, 14 hebben als bron alleen "Volgens OpenStreetMap" | 5 fout, 54 te controleren |
| D5 | Middel | Vaste tijd die eigenlijk voorwaardelijk is (zondag, feestdagen, bij drukte). Tijd uit een tabel voor huuraccommodatie (`cassandria-bad`). Inchecktijd vóór of gelijk aan de vertrektijd (`fort-everdingen` kopieert 14:00) | 92, 31 en 71 plekken |
| D6 | Middel | Bronzin met vertrektijd maar geen vertrekregel. De meeste komen door losse letters ("v ertrek", "v ó ór"); ook "dag en nacht aankomen en vertrekken" wordt niet herkend | 15 direct te winnen |
| D7 | Hoog | Prijs: 514 plekken met toeslagen maar zonder basisprijs. Bij 419 is onbekend of toeristenbelasting is inbegrepen. 186 plekken hebben "niet inbegrepen" zonder bedrag | Prijs 55,8% |
| D8 | Middel | Dubbele plekken: 5 met dezelfde naam binnen 600 m, 13 met een lijkende naam of dezelfde website. `camperplek-duurswoldje-slochteren` telt dubbel mee in de 32 | 18 paren |
| D9 | Middel | Capaciteit "2" (waarschijnlijk 2 personen). Camperplaatsen met meer dan 100 plekken. Soort past niet bij de naam | 24, 3 en 16 plekken |
| D10 | Middel | Maximale lengte is bij 91% onbekend (camperplaatsen: 257 van 289). Verder onbekend: honden (713), seizoen bij 141 camperplaatsen, slagboomtijden (bekend bij 73), ondergrond (bekend bij 4,5%) | |
| D11 | Middel | 1.661 concepten. 312 hebben geen contact, waarvan 32 camperplaatsen met wel 2 kernfeiten (vaak gemeentelijk, zonder website). Standaarddrempel is 0,7 in de trigger en 0,8 in `publish_threshold()`. `apply-threshold` telt de verplichte velden niet mee | |
| D12 | Laag | €0 zonder bron (11 plekken), 132 plekken zonder foto, `name_is_generic` bijna nooit gezet, `place_completeness` telt `photos` niet mee | |
| D13 | Laag | Twee inzendingen staan nog op "nieuw". `camping-alkmaar` is al verwerkt. `minicamping-st-jan-nieuwvliet` komt van Campercontact: niet overnemen zonder bevestiging van de eigenaar | 2 |

## Stille fouten in de pipeline (F)

| # | Ernst | Bevinding | Waar |
|---|---|---|---|
| F1 | Hoog | Fouten van de rpc `apply_scrape` worden niet gecontroleerd. Rijen kunnen voor altijd blijven hangen (attempts ≥ 3, `done_at` leeg; nu 221). `enqueue_stale_scrape` slaat plekken met lege `last_scraped_at` over. Een afgebroken achtergrondtaak laat geen spoor na | `index.ts:422,425`, `enqueue_stale_scrape` |
| F2 | Hoog | Twee OSM-runs staan sinds 10 oktober op "running" (NL-FL en NL-LI) | `ingest_runs` 5 en 9 |
| F3 | Middel | `verified_at` wordt ook gezet als er niets gevonden is. Gewone velden worden nog gewist als de subpagina's mislukken | `apply_scrape` |
| F4 | Middel | De AI-lezer draait nooit (`ANTHROPIC_API_KEY` ontbreekt). Fouten van de API worden ingeslikt en bij een rate limit wordt niet opnieuw geprobeerd | `index.ts:352`, `ai.ts` |
| F5 | Middel | `discover` slaat een netwerkfout op als blijvend "geen website" (340 keer "none" tegen 41 gevonden) | `index.ts` discover |
| F6 | Middel | 198 dode websites (11 bij gepubliceerde plekken) geven geen signaal in beheer, en `last_scraped_at` wordt ook bij een fout gezet | `runScrape` |
| F7 | Middel | `ingest_osm` overschrijft telefoon, e-mail en adres zonder te kijken naar beheer of naar wat de website gaf | migratie `ingest_osm` |
| F8 | Middel | De controle op beheer in `verifyFinding` doet niets: `sources.beheer` is een lijst, dus er moet `.includes("departure")` staan | `index.ts` verifyFinding |
| F9 | Laag | Fouten van enqueue en van `log()` worden niet gecontroleerd. De timer van 45 s stopt het werk niet (gebruik `AbortController`). Een 5xx bij robots.txt telt als toegestaan. `osm_response` verbergt de statuscode | `index.ts` |

## Plan

Elke stap volgt dezelfde lus: eerst een test (skill `tdd-workflow`, agent **tdd-guide**), dan bouwen, dan
`verification-loop` (check, test, build, regressietoets op de bronzinnen), dan een review door **code-reviewer** plus
de vakreviewer. Edge functions rollen we uit zonder te vragen; migraties gaan via **database-reviewer**.

### Stap 1: vangnet in de pipeline (F1 tot F3, F6, F8)
Eerst dit, zodat elke volgende run eerlijk meet.
- Controleer `{ error }` bij `apply_scrape` en enqueue en log de fout. Voeg een cron toe die hangende rijen
  terugzet of afsluit, en neem lege `last_scraped_at` mee in `enqueue_stale_scrape`.
- Zet de twee hangende OSM-runs op "failed". Repareer `verifyFinding` (`.includes`). Zet `verified_at` alleen als er
  iets gevonden is. Wis gewone velden niet als subpagina's mislukken (`_pages_failed`).
- Dode websites: aparte status (`site_dead` met HTTP-code) en een lijst in Beheer.
- Agents: **silent-failure-hunter** (aanwijzen en nacontrole), **tdd-guide**, **typescript-reviewer**,
  **database-reviewer** (migratie).

### Stap 2: vertrektijd juist (D2, D4 tot D6, W1)
De kernwaarde: liever leeg dan fout.
- Parser:
  - zinnen met "?", "kan dat" of "hoe laat" weigeren;
  - losse letters samenvoegen ("v ertrek");
  - zinnen over chalets, safaritenten en lodges negeren;
  - een voorwaarde (zondag, feestdag, bij drukte) wordt `voorwaardelijk`;
  - per24 alleen uit een zin over verblijfsduur, niet uit een tarief;
  - inchecktijd nooit gelijk aan of vóór de vertrektijd;
  - "dag en nacht aankomen en vertrekken" wordt vrij.
- OSM: alleen een tijd tussen 08:00 en 14:00 als vaste vertrektijd; anders `voorwaardelijk`.
- Spreekt een tweede bronzin de regel tegen, dan komt de plek automatisch in de controlelijst.
- Herstel de 5 foute tijden en de 6 tot 8 twijfelgevallen, en leeg de rommel aan het begin van bronzinnen.
- Agents en skills: skill **data-scraper-agent** met de regressietoets op 1.156 bronzinnen, **tdd-guide** en
  **code-reviewer**.

### Stap 3: bevestigen en aanvullen (D1, D3, D13)
- Eerste bevestigingsronde in Beheer → Vertrektijden:
  - de 32 plekken vrij of per24;
  - de 92 voorwaardelijke;
  - een steekproef van 50 vaste tijden.

  Hiervoor is een beheeraccount nodig (open punt 12).
- Zoekagenten ronde 2 (actie `verify`) voor de 163 camperplaatsen en 22 jachthavens zonder vertrekregel, in kleine
  batches. Alleen letterlijke zinnen; andere bronnen worden een inzending.
- Sluit de twee open inzendingen af.
- Agents en skills: **planner** (batches), `team-agent-orchestration` en `search-first` voor de zoekagenten,
  **security-reviewer** (inzendingen zijn invoer van buiten).

### Stap 4: wat de site toont (W2 tot W9)
- Prijs:
  - `cardPrice` gebruikt dezelfde regel als `trip-extras.ts`;
  - een totaalprijs alleen als elke toeslag een eenheid heeft.
- Vertrektijd:
  - het label "per 24 uur" blijft staan;
  - de kaartpopup toont de vertrektijd, met een markerkleur per soort regel;
  - "Bevestigd eerst" werkt in elke sortering;
  - Dichtbij krijgt het lengtefilter.
- Opschonen:
  - de teller "x van 12" corrigeren;
  - `timesNote` alleen naar de browser sturen als besluit B-bronzin dat toestaat;
  - vertrektijden als minuten vergelijken;
  - een nieuwe snapshot maken.
- Agents: **react-reviewer**, **a11y-architect** (markerkleuren en contrast), **e2e-runner** (Playwright op
  Zoeken, Plek en Zonder vertrektijd), **performance-optimizer** (minder props naar de browser).

### Stap 5: dekking (D7 tot D12)
- Prijs:
  - zoek het basistarief op de pagina's waar al toeslagen staan (514 plekken);
  - neem de eenheid van een toeslag verplicht mee;
  - toeristenbelasting telt mee in `place_completeness`.
- Nieuwe velden: `max_length_m` en `access_hours` in de scraper en in het correctieformulier.
- Capaciteit 2 of lager uit de websitescrape laten we leeg.
- Dubbele plekken: zet de 18 paren in de dubbelenlijst.
- Overal `private.publish_threshold()` gebruiken. Probeer de 198 dode sites opnieuw met een langere time-out.
- Agents en skills: **database-reviewer** met de skills `postgres-patterns` en `database-migrations`,
  **data-scraper-agent** en **architect** (wijziging van de publicatieregel).

### Stap 6: opschalen (optie 2, later)
Pas als stap 1 tot en met 3 staan: nieuwe bronnen voorbij OSM, met dezelfde scraper. Agents: **architect** en
**planner**.

### Besluiten voor Patrick
1. **Bronzin op de site.** De PRD zegt dat de bronzin alleen in beheer staat, maar de plekpagina toont "Volgens de
   website…". Mag dat blijven? (open punt 36)
2. **Contactvereiste.** Mag bij camperplaatsen ook e-mail of de OSM-beheerder als contact gelden? Dat levert tot 32
   extra camperplaatsen op.
3. **AI-lezer.** Zonder `ANTHROPIC_API_KEY` blijft deze uit. Zetten of schrappen?
4. **Beheeraccount.** Er is een account nodig voor de bevestigingsronde van stap 3.
