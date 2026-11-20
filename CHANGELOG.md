# Versies

Elke versie is een stand van `main` met een tag (bijvoorbeeld `v0.9.1`). Wat live in Supabase staat, staat erbij.

## Volgende versie (in de maak, dataplan november 2026)

**Data en dataketen** ([dataplan](docs/dataplan-2026-11.md))
- Gouden set: 23 echte pagina's als regressietest voor de lezer (R69).
- Parser 46: vaste etiketten voor toeslagen (Extra persoon, Bezoek; logé en wat inbegrepen is tellen niet), tijden
  met context (onderwerp, verbod, doelgroep, verhuurpagina's, twee tijden blijven leeg), check in/out met spatie,
  per 24 uur met kloktijd, maximaal aantal nachten; citaatcontrole op de hele zin (R56, R57, R60, R63).
- OSM: ruwe tags bewaard, hoogte, gewicht, betaalwijze en controledatum, los- en waterpunten als eigen laag.
- Constraints op het kernfeit (R79); `health()` telt wachtende voorstellen.
- Mail aan eigenaren: camperplaatsen zonder vertrekregel eerst (verzenden blijft uit).
- Live gedaan zonder code: Archies geblokkeerd, voorstellenwachtrij leeg, Zonder vertrektijd volledig nagekeken.
- Publiceren op regels: contact plus 2 van 4 kernfeiten (vertrekregel dubbel); de score telt alleen nog voor de
  volgorde (+46 plekken, 14 met vertrekregel). Grijze plekpagina's `noindex, follow` en niet in de sitemap (README 139).

**Migraties** (pas live na samenvoegen, in deze volgorde): `20261120100000_dataplan_osm_en_kernfeit`,
`20261120200000_publicatie_op_regels` (daarna "Regels opnieuw toepassen").
**Edge functions** (na samenvoegen uitrollen): `pipeline` met parser 46.

## 0.9.2 (19 november 2026)

Wat na 0.9.1 af kwam, dezelfde dag.

**Voor bezoekers**
- Websiteknop op de plekpagina: het domein staat klein in de knop "Reserveren via de website", geen losse grijze
  regel meer, en alleen het domein (PR #164). Drie kapotte websiteadressen live hersteld.
- Routeplanner (PR #166): overnachtingen voorstellen bij een te lange dag (hoogstens 3, zonder vaste vertrektijd eerst,
  alleen voorstellen), eigen punten (adres of kaart) en meerdere reizen op het toestel (opslag versie 4), notities
  standaard privé met "Delen met reisgenoten".

**Achter de schermen**
- Mail naar eigenaren (PR #165, vervangt #141): code en migratie `20261119200000_outreach.sql` (live gezet 19 november). Verzenden staat UIT;
  aanzetten is een besluit van Patrick (LANCERING besluit 4, README 136). Review vóór livegang verwerkt: afmelden lukt
  altijd, een klacht blijft meetellen voor de noodrem.

## 0.9.1 (19 november 2026)

Eerste genummerde versie. Alles wat op 19 november af was, uit veertien losse branches samengevoegd via `acceptatie`.

**Voor bezoekers**
- Plekpagina en kaartpaneel zoals een kaart-app, in eigen kleuren: actierij onder de naam, springlinks die blijven
  plakken, één brede routeknop, vegen op het kaartpaneel (PR #157).
- UX-audit november: terug sluit de sheet, tik op het actieve tabblad brengt je naar boven of in het zoekvak, "Toon
  meer" wordt onthouden, slimmere zoekbalk (PR #152).
- Eerlijke beloftes op start en FAQ, en geen standaardvertrektijd meer in formulieren (R66, R83; PR #153).
- Dieper bosgroen voor knoppen en links (PR #146).

**Rest van de UX-audit** ([rapport](docs/audit-ux-2026-11.md), PR #152; geen migraties)
- Zoekvak onthoudt wat je zocht en bekeek (alleen op je toestel), begrijpt filters in gewone taal ("gratis texel met
  stroom") en is overzichtelijker: kopjes, vet, tikfouten bij plekken, `/` op een computer.
- Tabblad Zoeken brengt je terug naar je laatste zoekopdracht met filters; Dichtbij onthoudt zijn keuzes.
- Zoeken: wegschuivende zoekbalk, vanzelf meer laden, zoeken in de lijst, "Ververs" bij gegevens uit de cache.
- Kaart: naar mijn locatie, zoek in dit gebied, opzij vegen naar de vorige of volgende plek.
- Plek: foto's schermvullend, vorige en volgende uit je zoekresultaten, "nog x uur om vandaag aan te komen", delen met
  vertrekregel en prijs, adres kopiëren; snelmenu met lang indrukken op een plek in de lijst.
- Mijn reis: ongedaan maken na weghalen, slepen, als tekst delen, in je agenda zetten, reisdag bovenaan, aantal stops
  op het app-icoon.
- Delen vanuit Google Maps naar VrijStaan (Android), een eenmalige tip voor het beginscherm op de iPhone, duidelijkere
  offlinebalk.

**Routeplanner in Mijn reis** (PR #162; geen migraties, opslag van Mijn reis versie 3)
- Per etappe vertrek en aankomst: vertrek volgens de vertrektijd van de plek of je eigen tijd, pauzes, en een
  waarschuwing bij te laat, te vroeg, te lang rijden op één dag of per 24 uur later weg dan je kwam.
- Begin- en eindpunt (je locatie of een adres, ook terug naar het begin), tussenstop zonder overnachting, notitie per
  stop, omdraaien en ongedaan maken.
- Camper telt mee (hoogte, gewicht, lengte, breedte) en tol, veerponten of snelwegen mijden, via OpenRouteService.
- Slimste volgorde op echte rijtijden; plekken langs de route met toevoegen op de juiste plaats; GPX-bestand.
- Google Maps opent de reis in delen van 10 punten (eerder vielen stops weg); routes werken in heel Europa.

**Data en dataketen**
- Correcties van beheer overleven de volgende lezing (R61; PR #151).
- Veldlog voor kernfeiten en bewaking per kanaal in `health()` (R62, R64; PR #155).
- Geschiedenis per plek: oud, nieuw en bron per veld, met terugzetten door beheer (PR #159).
- De keten gooit geen plekken of gegevens meer stil weg (R68, R71, R73; PR #156).
- Stealth-lezer start weer en stopt na drie mislukte runs (R58, R72; PR #150).
- OSM per deel en na elkaar ophalen (PR #158; pipeline 66 live, docs in PR #161).

**Techniek**
- Next.js 16.4.6 tegen twee cachelekken (PR #154) en negen kleine pakketupdates (PR #148).
- Review 16 november (data en scraping, steekproef van 60 plekken) en het statusbord bijgewerkt (PR #149).
- Orchestratie: model en effort per agent vastgelegd (PR #160), de installatie van 16 november daarmee gelijkgetrokken.

**Migraties** (live gezet op 19 november 2026, in deze volgorde; versies gelijk aan de bestanden)
`20261118100000_beheerslot`, `20261118120000_osm_ophalen_per_deel` (stond al live), `20261118200000_wislog_en_kanalen`,
`20261118300000_niets_weggooien`, `20261118400000_plekgeschiedenis` (hernummerd: botste met `beheerslot`).
`20261108100000_bronnen_en_claims` blijft bewust uit (R41).

**Edge functions**: `pipeline` versie 67 en `discover` versie 2, beide vastgezet op `17a6030`.

**Niet in deze versie**
- PR #141 (mail naar eigenaren): wacht op het besluit over mailen en een juridische toets (LANCERING besluit 4) en
  botst inmiddels met `owner-inbox.ts`.
