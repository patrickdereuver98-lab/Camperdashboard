# Versies

Elke versie is een stand van `main` met een tag (`v0.9.1`). Wat live in Supabase staat, staat erbij.

## 0.9.1 (19 november 2026)

Eerste genummerde versie. Alles wat op 19 november af was, uit twaalf losse branches samengevoegd via `acceptatie`.

**Voor bezoekers**
- Plekpagina en kaartpaneel zoals een kaart-app, in eigen kleuren: actierij onder de naam, springlinks die blijven
  plakken, één brede routeknop, vegen op het kaartpaneel (PR #157).
- UX-audit november: terug sluit de sheet, tik op het actieve tabblad brengt je naar boven of in het zoekvak, "Toon
  meer" wordt onthouden, slimmere zoekbalk (PR #152).
- Eerlijke beloftes op start en FAQ, en geen standaardvertrektijd meer in formulieren (R66, R83; PR #153).
- Dieper bosgroen voor knoppen en links (PR #146).

**Data en dataketen**
- Correcties van beheer overleven de volgende lezing (R61; PR #151).
- Veldlog voor kernfeiten en bewaking per kanaal in `health()` (R62, R64; PR #155).
- Geschiedenis per plek: oud, nieuw en bron per veld, met terugzetten door beheer (PR #159).
- De keten gooit geen plekken of gegevens meer stil weg (R68, R71, R73; PR #156).
- Stealth-lezer start weer en stopt na drie mislukte runs (R58, R72; PR #150).
- OSM per deel en na elkaar ophalen (PR #158).

**Techniek**
- Next.js 16.4.6 tegen twee cachelekken (PR #154) en negen kleine pakketupdates (PR #148).
- Review 16 november (data en scraping, steekproef van 60 plekken) en het statusbord bijgewerkt (PR #149).
- Orchestratie: model en effort per agent vastgelegd (PR #160), de installatie van 16 november daarmee gelijkgetrokken.

**Migraties** (live toe te passen na samenvoegen, in deze volgorde)
`20261118100000_beheerslot`, `20261118120000_osm_ophalen_per_deel` (stond al live), `20261118200000_wislog_en_kanalen`,
`20261118300000_niets_weggooien`, `20261118400000_plekgeschiedenis` (hernummerd: botste met `beheerslot`).
`20261108100000_bronnen_en_claims` blijft bewust uit (R41).

**Niet in deze versie**
- PR #141 (mail naar eigenaren): wacht op het besluit over mailen en een juridische toets (LANCERING besluit 4) en
  botst inmiddels met `owner-inbox.ts`.
- Het nieuwe beginscherm van Mijn reis (routeplanner): nog in aanbouw.
