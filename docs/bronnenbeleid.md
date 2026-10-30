# Bronnenbeleid: hoe VrijStaan gegevens verzamelt

> Vastgesteld 18 oktober 2026 (dataplan Fase 0, taak W0.2), bijgewerkt 25 oktober 2026 (stealth-lezer, §3a: beveiliging omzeilen mag). Geldt voor elke sessie, agent en workflow die gegevens
> over plekken ophaalt. Bij twijfel: niet doen en het op het [samenwerkingsbord](samenwerking.md) zetten.

We verzamelen **feiten** uit openbare bronnen en bewaren bij elk feit de bron, de datum en een letterlijk citaat.
We slaan geen teksten, databanken of persoonsgegevens van anderen op. De vaste regel van het project blijft leidend:
nooit data verzinnen, onbekend blijft leeg.

## 1. Wat wel en wat niet

| Onderwerp | Wel | Niet |
|---|---|---|
| Feiten (vertrekregel, tijden, prijs, voorzieningen, coördinaten) | Overnemen als claim met bron, datum en letterlijk citaat | Hele pagina's, beschrijvingen of foto's kopiëren |
| Directories (Campercontact, park4night, ACSI, ANWB e.d.) | Losse pagina's lezen als aanwijzing en tweede mening | Lijsten in bulk overnemen (Databankenwet); hun teksten of foto's gebruiken |
| Fora en reviews | Openbare pagina's lezen; het feit met datum en een postnummer of review-id als `mention_ref` | Reviewteksten (buiten het korte citaat), gebruikersnamen of profielen opslaan |
| Google | Openbare Google Maps-pagina's lezen met de stealth-lezer (§3a) voor feiten; de Places API als Patrick een sleutel instelt (W4.4) | Reviewteksten, namen of profielen van reviewers opslaan |
| Facebook, Instagram en andere pagina's achter een inlog | Openbare pagina's die zonder inlog te zien zijn (stealth-lezer); groepen alleen met toestemming van de beheerders | Inloggen, accounts aanmaken of inlogmuren omzeilen; groepen leegtrekken |
| Beveiliging van sites | De stealth-lezer (§3a) mag alle botbeveiliging omzeilen: Cloudflare, captcha's, 403, `robots.txt`, browser-vermomming en wisselende proxy's | Inlog- en betaalmuren omzeilen; een site overbelasten; doorgaan als de eigenaar vraagt te stoppen |
| Eigenaren | Bevestiging via de site (link op de plekpagina, Doe mee) | E-mailen of bellen (besluit 18 oktober 2026) |

## 2. Tiers en wanneer een feit telt

Elke bron heeft een tier in `bron.sources`. De beslisregel (`bron.decisions`) gebruikt alleen vermeldingen van de
laatste 24 maanden.

| Tier | Bron | Wanneer telt een feit |
|---|---|---|
| 1 | Open data en overheid (OSM, PDOK, gemeente- en provinciesites) | Eén bron is genoeg |
| 2 | Eigen website van de plek (domein gelijk aan `places.website`) en de eigenaar zelf | Eén bron is genoeg |
| 3 | Directories | Twee losse vermeldingen met dezelfde waarde |
| 4 | Fora en openbare community | Twee losse vermeldingen met dezelfde waarde |
| 5 | Reviews | Twee losse vermeldingen met dezelfde waarde |

- **Twee losse vermeldingen** (besluit 18 oktober 2026): twee verschillende reviews, posts of sites, elk met een
  eigen citaat. Twee reviews op één pagina tellen als twee als ze elk een eigen `mention_ref` én een ander citaat
  hebben; dezelfde pagina onder een ander adres telt één keer.
- **Het citaat onderbouwt de waarde:** minstens 15 tekens, en bij tijden, bedragen en aantallen staat het getal in
  het citaat zelf.
- **Datum verplicht bij fora en reviews:** zonder `observed_on` (of een datum van de pagina) wordt de claim geweigerd,
  zodat een oude post niet als nieuw telt.
- **De eigen site van plek A zegt niets over plek B:** claims uit een eigen-site-document gelden alleen voor die plek.
- **Tegenspraak:** zegt een nieuwere vermelding iets anders, dan wordt het een conflict en beslist een mens.
- **Controle:** steunt een besluit alleen op tekst die een sessie zelf instuurde (`tekst_insturen`), dan kijkt een mens
  mee. Pagina's die de server zelf ophaalt, zijn tegen de echte pagina gecontroleerd.
- **Een sessie kan zichzelf geen tier 1 of 2 geven.** Een onbekend domein krijgt de tier van het soort dat de sessie
  opgeeft (3, 4 of 5). Ook een domein met "gemeente" in de naam wordt niet automatisch tier 1, want iedereen kan zo'n
  domein registreren; de server zet er een notitie bij en een mens zet echte overheidsdomeinen in `bron.sources` op
  `kind = 'overheid'`, tier 1. Tier 2 krijgt alleen het domein (bij Facebook, Wix en dergelijke: het pad) uit
  `places.website` van de opgegeven plek.
- **De vertrekregel blijft het kernfeit.** De bevestiging op de site (`departure_check`) blijft bij beheer en de
  eigenaar; claims maken kandidaten, geen bevestiging.

## 3. Tempo en techniek

- User-agent: `VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)`, dezelfde als de pipeline.
- Wachttijd per host uit `bron.sources.min_delay_s`: 5 s voor eigen sites, 15 s voor directories, 20 s voor fora.
  De MCP-server dwingt dit af (`bron_fetch_slot`).
- `robots.txt` volgens RFC 9309: de groep voor VrijStaanBot gaat voor, anders `*`. Is robots.txt onbereikbaar (5xx),
  dan wachten we. Sluit een site alle bots uit, dan gaat de bron op geblokkeerd (bij een subdomein
  alleen dat subdomein).
- Alleen openbare http(s)-adressen; geen IP-adressen of interne namen, en de hostnaam moet via DNS naar een openbaar
  adres wijzen. Een doorverwijzing naar een andere site volgt de server niet: die site heeft een eigen bron, tier,
  `robots.txt` en wachttijd.
- Dit hoofdstuk geldt voor de gewone lezer (pipeline, `bronnen-mcp`). Bij 403 of een captcha stopt die en zet de
  pagina klaar voor de stealth-lezer (§3a), die zijn eigen regels heeft. Bij 429 of een inlogmuur: stoppen en de bron melden met `bron_blokkeren`. Openzetten doet een mens.
- Opgehaalde tekst blijft 30 dagen staan; daarna bewaren we alleen de citaten (`bron.prune`, cron `bron-opschonen`).

## 3a. Stealth-lezer (besluit eigenaar, 25 oktober 2026)

De eigenaar heeft besloten dat we [Scrapling](https://github.com/D4Vinci/Scrapling) gebruiken waar het sterk in is:
beveiliging omzeilen en zoveel mogelijk openbare bronnen lezen. De stealth-lezer mag:

- **Alle botbeveiliging omzeilen:** Cloudflare en vergelijkbare diensten, captcha's, een 403, en zich met een echte
  browser als gewone bezoeker voordoen (browser-user-agent en vingerafdruk).
- **`robots.txt` negeren.** We lezen het wel en leggen vast wat erin staat, zodat we later kunnen zien welke sites
  ons niet wilden.
- **Wisselende proxy's gebruiken** als een site ons IP blokkeert.
- **Alles zoeken wat openbaar is:** eigen sites, gemeenten, directories, fora, reviewsites, openbare Google
  Maps-pagina's en openbare Facebook- en Instagram-pagina's die zonder inlog te zien zijn.
- **Als eerste lezer werken** waar de gewone lezer weinig oplevert, niet alleen als tweede poging.

Wat blijft, omdat het een wettelijke grens is of andere sites schaadt (niet aan de eigenaar om weg te strepen):

- **Geen inlog- of betaalmuren omzeilen**, geen accounts aanmaken, geen wachtwoorden of sessies van anderen. Een
  afgeschermd systeem binnendringen is computervredebreuk (art. 138ab Sr).
- **Geen databank in bulk overnemen** (Databankenwet): van een directory lezen we losse pagina's voor losse feiten,
  we kopiëren hun lijst niet. Teksten en foto's van anderen nemen we niet over.
- **Geen persoonsgegevens opslaan** (AVG): geen namen, profielen of reviewteksten buiten het korte citaat.
- **Niemand overbelasten:** hoogstens één verzoek per 5 seconden per host (plus willekeurige spreiding) en 15 pagina's per
  site per ronde (was 7; besluit eigenaar 30 oktober 2026, Master Database). Bij 429
  of een trage site gaan we langzamer, niet sneller.
- **Stoppen als een eigenaar of site daarom vraagt** (mail, klacht, juridische brief): de bron gaat op geblokkeerd
  voor elke lezer en de coördinator legt het voor aan de eigenaar.
- **Wat we bewaren verandert niet:** feiten met bron, datum en letterlijk citaat; 30 dagen bewaartermijn.
- **Herkenbaar in de gegevens:** wat de stealth-lezer op de eigen site van een plek vond, staat in
  `places.sources.stealth`, zodat we het kunnen terugvinden en wissen. Voor de bronnenlaag (andere bronnen dan de
  eigen site) volgt `fetched_by = 'stealth'` op de documenten.

Risico, bewust geaccepteerd door de eigenaar: sites kunnen ons blokkeren, een klacht of sommatie sturen, en de
voorwaarden van sites (Google, Meta, directories) verbieden dit vaak, wat tot een claim kan leiden. VrijStaan
verschijnt dan als bron van het verkeer, ook al gebruikt de lezer een browser-user-agent.

## 4. Werken als sessie

Gebruik de MCP-server **vrijstaan-bronnen** (edge function `bronnen-mcp`) of, zonder MCP, dezelfde functies via de
Supabase-MCP (`select public.bron_…`). De volgorde:

1. Werk pakken met `volgend_werk` (lease van een uur), of een plek kiezen met `plekken_zoeken`.
2. Pagina laten ophalen met `pagina_ophalen`; alleen als de server een openbare pagina niet kan lezen `tekst_insturen`.
3. Feiten leveren met `claims_insturen`. Elk citaat moet letterlijk in het document staan, anders weigert de database.
4. Nieuwe plekken leveren met `kandidaten_insturen`; de server koppelt ze aan bestaande plekken.
5. Afronden met `werk_afronden` en wat je vond in de notitie.

Velden die een claim mag hebben: `departure` (`vrij`, `per24`, `vast`), `checkout_until`, `checkin_from` (`uu:mm`),
`access_hours` (`uu:mm–uu:mm`), `max_stay_nights`, `capacity`, `price_eur`, `max_length_m`, `power`, `water`,
`dump_station`, `toilet`, `shower`, `wifi`, `dogs`, `open_all_year`, `reservation`, `access_24h`,
`tourist_tax_included`, `season`, `phone`, `website` en `gesloten`.

## 5. Bronnenregister

Het register staat in `bron.sources`. Startstand (18 oktober 2026):

| Bron | Tier | Status | Opmerking |
|---|---|---|---|
| OpenStreetMap, PDOK | 1 | toegestaan | Open data |
| Eigen site van de plek, eigenaar | 2 | toegestaan | Eigen site alleen als het domein klopt |
| Campercontact, park4night, ACSI/Eurocampings, ANWB, Camping.info | 3 | toegestaan | `robots.txt` wordt bij het eerste gebruik gecontroleerd en vastgelegd |
| Reddit | 4 | toegestaan | Geen gebruikersnamen |
| Zoover | 5 | toegestaan | Alleen afgeleide feiten |
| Facebook, Instagram | 4 | alleen openbaar, stealth | Alleen pagina's zonder inlog; groepen alleen met toestemming van de beheerders |
| Google Maps | 5 | alleen openbaar, stealth | Feiten van openbare pagina's; geen reviewteksten of namen. Places API blijft mogelijk |

Nieuwe domeinen registreert de server automatisch bij het eerste gebruik (`auto_registered`); de coördinator loopt
die wekelijks na.
