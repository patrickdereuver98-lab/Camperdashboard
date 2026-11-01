# VrijStaan: de zes basisdocumenten

Deze zes documenten beschrijven wat VrijStaan is en hoe het gebouwd wordt. Ze zijn het vaste referentiepunt voor
iedereen die aan de site werkt, mens of AI-agent. Bij twijfel of tegenstrijdigheid gaan deze documenten voor; past de
code niet bij de documenten, dan is dat een open punt (zie onder).

| # | Document | Waarvoor |
|---|---|---|
| 1 | [Product Requirements Document](01-PRD.md) | Wat het product moet doen en hoe we succes meten |
| 2 | [Technical Requirements Document](02-TRD.md) | Techniek, diensten, architectuur, beveiliging |
| 3 | [App Flow](03-app-flow.md) | Elk scherm, elk pad, wat elke tik doet |
| 4 | [UI en UX Design Brief](04-ui-ux-brief.md) | Wat er op welk scherm staat, componenten, toegankelijkheid; uiterlijk in de [stijlgids](../stijlgids.md) |
| 5 | [Backend Schema](05-backend-schema.md) | Tabellen, relaties, rechten, bewaartermijnen |
| 6 | [Implementatieplan](06-implementatieplan.md) | Mijlpalen en taken met status |

Verwante documenten: `docs/HANDLEIDING.md` (draaien, online zetten, beheren), `docs/design.md` (ontwerpdetails),
`docs/onderzoek.md` (vooronderzoek), `docs/review-2026-10.md` (review en wijzigingsplan, oktober 2026),
`docs/audit-2026-10.md` (audit 12 oktober), `docs/review/` (feature review), `docs/samenwerking.md` (hoe de PR's van
oktober zijn samengevoegd), `docs/stijlgids.md` (uiterlijk), `docs/draaiboek.md` (terugdraaien, back-up, bewaking) en
[`plan.md`](../../plan.md) (wat nog openstaat).

**Lange termijn:** zie het hoofdstuk [VrijStaan 2.0 - Visie, Strategie & Toekomstige Roadmap](#vrijstaan-20---visie-strategie--toekomstige-roadmap) verderop.

## Zo gebruik je ze

1. De **PRD** is leidend. Elke nieuwe functie begint daar: functie, user story, acceptatiecriteria.
2. Werk daarna de andere vijf bij waar nodig (flow, ontwerp, schema, techniek, planning).
3. Geef bij een grotere wijziging alle zes aan de AI-agent, vraag om tegenstrijdigheden te melden en los die op vóór
   er code wordt geschreven.
4. Houd de documenten actueel: een wijziging in code die een document onjuist maakt, past in dezelfde commit ook het
   document aan.

## Vaste spelregels (gelden altijd)

- **Data mag nooit verzonnen worden.** Alleen wat letterlijk in een bron staat; anders blijft het veld leeg en toont de
  site "Onbekend".
- **Vertrektijd is het belangrijkste feit.** De bronzin bewaren we alleen in beheer, niet op de site
  (besluit 23 oktober 2026); verder staat per pagina alleen "Laatste update: datum". Prijs is belangrijk, maar geen faalpunt.
- **Teksten klinken menselijk**: zie `.claude/skills/vrijstaan-stijl/SKILL.md` (geen gedachtestreepjes, geen
  hoofdletterlabels, geen verkooppraat).
- **Prijzen zo transparant mogelijk**: basisprijs plus alle losse toeslagen zoals de website ze noemt.
- **Mobiel eerst** (iPhone-formaat), camperaars van 40+, tikdoelen van minstens 44 px.
- **Kleuren "natuur & vrijheid"** blijven: zandpapier, bosgroen, avondzon, meerblauw, bosachtige donkere modus.
  Lettertype Geist, vormen en beweging volgens `docs/stijlgids.md` (besluit eigenaar 12 oktober 2026).
- **Nederlands eerst**; Engels en Duits later.
- **Geen cookies of tracking van derden**; statistieken alleen met toestemming.

## VrijStaan 2.0 - Visie, Strategie & Toekomstige Roadmap

> Opgesteld 1 november 2026 (opdracht Patrick: "denk 100% out-of-the-box, het ultieme camperplatform"). Dit is de
> leidraad voor de sprints **na de livegang van 1 januari 2027**. Tot die datum gaat alle bouwtijd naar de Must-functies
> uit de PRD. De vaste spelregels hierboven blijven gelden. Waar een idee botst met de PRD of het bronnenbeleid, staat het
> als open punt in de tabel hieronder (nummers 82 tot 86) en wacht het op een besluit van de eigenaar.

### 1. De markt, eerlijk bekeken

Bronnen: App Store-pagina's, eigen pagina's van de aanbieders, prijsoverzichten en camperforum.nl (geraadpleegd
1 november 2026). Prijzen verschillen per land en datum. "Trodbox" uit de opdracht hebben we nergens kunnen vinden.

| Speler | Sterk | Zwak | Onze kans |
|---|---|---|---|
| park4night | Grootste community, veel plekken in heel Europa, gratis basis. Premium ±€ 10 per jaar: filters, offline kaarten, geen advertenties ([App Store](https://apps.apple.com/gb/app/park4night-com/id430946556), [prijzen](https://www.wandernundmehr.at/faq/wie-teuer-ist-park4night)) | Klachten over offline modus en betalen, advertenties ook voor betalers ([reviews](https://appshunter.io/ios/app/430946556/reviews/6)). Reviews zijn "zin en onzin", correcties gaan via de data en niet via de reviews ([camperforum.nl](https://camperforum.nl/viewtopic.php?p=2453439)) | Feiten in plaats van meningen: vertrektijd en prijs als veld, met datum |
| Campercontact (NKC) | Sterk in Nederland, ±50.000 plekken, 800.000 reviews, 70+ filters, routes ([PRO+](https://campercontact.com/en/content/features-pro)) | De filters en alle reviews zitten achter PRO+ (±€ 18 tot 20 per jaar). Oude reviews blijven staan. Forumklachten over de app ([camperforum.nl](https://camperforum.nl/viewtopic.php?p=2320188)) | Alle filters gratis, en het filter dat zij niet hebben: vertrektijd |
| Stellplatz-Radar (Promobil) | Redactioneel gecontroleerd, groot in Duitsland, 250.000 beoordelingen ([App Store](https://apps.apple.com/DE/app/id360686968)) | Offline en filters in Plus, app voelt verouderd, steeds opnieuw inloggen ([overzicht](https://worldsapps.com/de/reviews-stellplatz-radar-von-promobil)) | Snelle webapp zonder installatie |
| iOverlander | Gratis, wereldwijd, alles door reizigers | Sinds versie 2.0 offline achter een betaalmuur, valse tips over vrij kamperen ([Mountain Gazette](https://mountaingazette.com/blogs/mountain-notes/here-there-43-ioverlander), [review](https://www.pilotplans.com/blog/ioverlander-review)) | Niet onze markt (wildkamperen valt buiten scope), wel een les: offline mag geen premium zijn |

**Het patroon:** iedereen verkoopt dezelfde drie dingen achter een betaalmuur (filters, offline, alle reviews). En
iedereen leunt op reviews als bron van waarheid, die verouderen zonder dat de lezer het ziet. Niemand toont hoe oud een
feit is, en niemand heeft vertrektijd als veld.

**Onze voorsprong:** vertrektijd als kernfeit met eigen filter en pagina's, prijs met toeslagen, alles gratis zonder
advertenties of tracking, een snelle webapp, en een dataketen met bron en tier per gegeven (OSM, PDOK/WFS, gemeenten,
websites).

**Onze blinde vlek:** we hebben nog geen gebruikers en geen reviews (live 0 accounts, zie nummer 12). Alles leunt op
scrapers en open data, en voor veel plekken staat de vertrektijd nergens online (nummer 59). Daarnaast zijn we strikt
Nederland, terwijl een camperaar ook over de grens rijdt, en vinden mensen ons niet zonder app store. De concurrent wint
niet op data maar op gewoonte.

### 2. Visie

**De gids die laat zien wat nú klopt.** Elk feit heeft een bron en een leeftijd, en de community houdt die leeftijd
laag. Vertrouwen is het product, en dat geven we niet weg aan advertenties of betaalde plaatsing.

### 3. UX-filosofie

1. **Eén vraag per scherm.** De hoofdvraag is "waar sta ik vannacht, en hoe laat moet ik weg?". Alles wat daar niet bij
   helpt, gaat een laag dieper.
2. **Versheid is zichtbaar.** Bij elk kernfeit staat hoe oud het is en waar het vandaan komt ("bevestigd 3 dagen
   geleden"), rustig en klein. Onbekend blijft onbekend.
3. **De basis is nooit premium.** Filters, kaart, offline en alle reviews zijn gratis. Betalen kan alleen voor iets
   dat ons echt geld kost.
4. **Meedoen kost tien seconden.** Eén vraag, één tik, op het moment dat je er bent. Geen formulieren, geen punten
   najagen.
5. **Offline is de standaard.** Op een dijk in Zeeland zonder bereik werkt de gids gewoon.

### 4. De drie concepten

**A. Plekpuls: versheid door bevestigen (community).**
Na een overnachting stelt de app één vraag: "Klopt het: vertrek uiterlijk 12:00?" met Ja, Nee of Weet ik niet. De
locatie blijft op het toestel; het toestel weet zelf dat je bij een bewaarde plek stond. Een antwoord wordt een claim in
de bronnenlaag (`bron.claims`, zodra die live staat, nummer 71), gewogen met de bestaande vertrouwensscore per gebruiker (nummer 68). Zo krijgt elk feit
een datum en een telling zonder dat iemand een review hoeft te schrijven.
Gamification zonder spam: geen publieke ranglijsten of badges. Wel **Plekhoeders**: wie een plek of gemeente
"adopteert", krijgt een seintje als een feit ouder wordt dan 12 maanden, ziet zijn bijdrage terug ("dankzij jou 41
plekken actueel") en krijgt vroege toegang tot nieuwe functies. Doe mee (per provincie) wordt het vertrekpunt.

**B. Vannacht-motor: offline, met je eigen camper (product).**
De hele Nederlandse dataset staat versleuteld op het toestel (een paar MB) en wordt bijgewerkt zodra er bereik is. Het
camperprofiel (lengte, later hoogte en gewicht uit OSM `maxheight`/`maxweight`) filtert stilletjes mee. Eén knop
"Vannacht" geeft drie plekken op rijtijd, met vertrektijd, prijs en hoe vers de gegevens zijn, plus een automatisch
**plan B** als een plek als vol wordt gemeld. Een **drukteverwachting** per plek en dag rekent alleen met echte meldingen
en seizoen, en staat er altijd als verwachting, met onderbouwing (nummer 84).

**C. VrijStaan voor eigenaren en gemeenten (B2B).**
- **Eigenarenportaal (gratis):** een eigenaar claimt de plek en werkt zelf vertrektijd, prijs en seizoen bij. Dat is
  een tier 1-bron en maakt de data beter voor iedereen. Eigenaren krijgen in ruil inzicht: hoe vaak hun plek is bekeken
  en doorgeklikt (geaggregeerd, alleen met toestemming gemeten).
- **Gemeentedashboard (betaald):** geaggregeerde, anonieme vraag per regio: waar zoeken camperaars en is er geen plek,
  hoe verhouden prijzen zich, wat doet een nieuwe camperplaats met de vraag. Gemeenten en citymarketing beslissen nu op
  gevoel; wij hebben de vraagkant. Aanbod uit PDOK en gemeentelijke WFS staat al in onze keten.
- **VrijStaan Inside (betaald):** een widget of API voor verhuurbedrijven en camperdealers, zodat hun klanten de
  vertrektijd en de echte prijs zien. Geen betaalde ranking: de volgorde in de gids is nooit te koop.

**Wilde ideeën die we bewaren, niet bouwen:** een AI-agent die eigenaren mailt of belt om de vertrektijd te vragen (de
mailronde uit de PRD is de eerste stap), sensoren bij loospunten, AR-pijlen naar het loospunt, een rit-uitleg via de
OBD-poort van de camper.

**Afgewezen:** de databanken van concurrenten overnemen. Dat botst met de Databankenwet en het bronnenbeleid §3a
(nummer 74), en het is ook geen strategie: wie hun data kopieert, kopieert hun verouderde reviews. Onze kracht is dat
wij weten waar elk feit vandaan komt.

### 5. Hoe dit de dataketen aanvult

De WFS/OSM-dataketen (`tools/data-collectors`, `geo_master`, de koppelregels en tiers) blijft de basis en verandert
niet. Er komen bronnen bij, er gaat niets af:

| Laag | Nu | Erbij in 2.0 |
|---|---|---|
| Aanbod | OSM, PDOK/WFS, gemeenten, Archie's (beperkt), websites via scraper en stealth-lezer | Eigenarenportaal als tier 1-bron per plek |
| Feiten | Scraper en zoekagenten, bevestiging in beheer | Plekpuls-claims (gewogen op vertrouwen) als extra bron in `bron.claims` (zodra de bronnenlaag live staat, nummer 71) |
| Versheid | `verified_at`, `departure_checked_at`, "mogelijk verouderd" na 12 maanden | Datum en telling per feit zichtbaar; Plekhoeders krijgen een seintje bij oude feiten |
| Uitgaand | Site en SEO-pagina's | Offline pakket voor de app; geaggregeerde, anonieme views voor B2B; eigen waarnemingen terug naar OSM als de eigenaar dat wil (licentie ODbL eerst nalopen) |

### 6. Verdienmodel

- **Camperaar:** de gids blijft gratis, inclusief filters, offline en reviews.
- **Vriend van VrijStaan (vrijwillig, ±€ 15 per jaar):** extra's die ons geld kosten, zoals routeplanning met
  voertuigafmetingen via een externe dienst, synchronisatie van meerdere reizen en pushmeldingen bij plan B.
- **B2B betaalt de rekening:** gemeentedashboard en VrijStaan Inside. Eerst een gratis pilot met één of twee gemeenten.
- Advertenties en betaalde plaatsing blijven uitgesloten (nummer 22).

### 7. Roadmap

| Horizon | Wanneer | Wat | Klaar als |
|---|---|---|---|
| H0 | Nu tot 1 januari 2027 | Livegang volgens de PRD; niets uit dit hoofdstuk | Lanceervoorwaarden gehaald |
| H1 | Eerste kwartaal 2027 | Versheid zichtbaar per feit; Plekpuls v1 (vraag na bewaarde plek); eigenarenportaal v1; offline pakket v1 | 30% van de bezochte plekken bevestigd in de laatste 90 dagen; 50 eigenaren actief |
| H2 | Tweede en derde kwartaal 2027 | Vannacht-knop met plan B; camperprofiel met hoogte; Engels en Duits; grensstrook België en Duitsland (besluit nodig, nummer 85) | Mediaan van "open app tot doorklik" onder 60 seconden |
| H3 | Vanaf vierde kwartaal 2027 | Gemeentedashboard (pilot); VrijStaan Inside; drukteverwachting | Eén betalende klant; inkomsten dekken Vercel Pro en Supabase |

Succes meten we zoals in de PRD (doorkliks per week), aangevuld met **de mediane leeftijd van een vertrektijd** op de
site. Dat getal moet elk kwartaal dalen.

## Gevonden tegenstrijdigheden en open punten (11 oktober 2026)

| # | Wat | Waar | Voorstel |
|---|---|---|---|
| 1 | Rol `support` bestaat, maar `is_admin()` geeft elke beheerder alle rechten | Schema, TRD | Besluiten wat support niet mag; policies per rol (Implementatieplan M2) |
| 2 | Privacyverklaring belooft bewaartermijnen die nog niet automatisch worden toegepast | Backend Schema, privacy | **Klaar om uit te voeren (15 oktober 2026):** `web/supabase/retention.sql` in de SQL-editor; tickets en contactgegevens zitten er nu in |
| 3 | `web/supabase/schema.sql` en de snapshot lopen achter op de live database | Backend Schema, TRD | Opnieuw genereren na de herscrape |
| 4 | ~~Publicatiedrempel~~ | PRD, site | **Opgelost (12 oktober 2026):** 0,45 na de herscrape. Elke plek heeft contact en 2 van 4 kernfeiten; dat geeft 1.509 plekken (bij 0,55: 1.277). Aantal plekken is de prioriteit van de eigenaar. Aan te passen in Beheer → Instellingen |
| 5 | ~~Hoe streng met vertrektijden~~ | PRD open vraag 1 | **Opgelost:** aparte pagina's Zonder vertrektijd, Uitslapers, Overige; websitefoto's overal aan |
| 6 | Vercel Hobby is niet-commercieel; verdienmodel nog onbekend | TRD, PRD | Bij inkomsten overstappen op Vercel Pro |
| 7 | Bedrijfsgegevens ontbreken op privacy, voorwaarden en disclaimer | Release | Invullen in `web/src/lib/company.ts` |
| 8 | Reviews: formulier belooft nog geen foto's ("binnenkort") | App Flow, PRD | Fase B (Implementatieplan M4). De vertrektijdvraag staat sinds 15 oktober 2026 in het formulier |
| 9 | `/zoeken?waar=<onbekend>` toont het hele land met die plaatsnaam | App Flow | **Opgelost (16 oktober 2026):** kop "in Nederland" met de melding dat de plaats onbekend is |
| 10 | Testtabellen `private.probe` en `private.probe2` staan nog in de database | Backend Schema | Verwijderen |
| 11 | Kop van de startpagina is een tekening; een echte sfeerfoto vraagt een foto met vrije licentie of eigen foto | UI/UX Brief | Foto aanleveren (eigen of Wikimedia Commons, CC BY/CC0) en in `web/public/` zetten met bronvermelding |
| 12 | Implementatieplan noemt beheeraccounts klaar, maar live bestaan 0 gebruikers en 0 beheerders (15 oktober 2026) | Implementatieplan M2, live database | Account aanmaken zodra Vercel gekoppeld is ([review](../review-2026-10.md) 0.7) |
| 13 | Backend Schema noemt `schema.sql` de basis voor een nieuw project, maar het bestand mist alle `REVOKE`s, de controle op `email_confirmed_at` en ongeveer tien live tabellen | Backend Schema, TRD | Overstappen op migraties ([review](../review-2026-10.md) 2.1); tot dan geen nieuw project uit `schema.sql` opzetten |
| 14 | ~~Header volgt de app flow niet~~ | App Flow, `chrome.tsx` | **Opgelost (15 oktober 2026):** code aangepast aan de app flow (+ en Hulp op mobiel, Hulp op desktop) |
| 15 | ~~Stille terugval op de snapshot bij elke Supabase-fout~~ | TRD, `lib/places.ts` | **Deels opgelost (15 oktober 2026):** alleen nog bij netwerk- en serverfouten; een 4xx gaat door. Nog open: zichtbaar maken op de site dat de snapshot wordt getoond |
| 16 | Brief zei basis 17 px; eigenaar vond de telefoonweergave te druk | UI/UX Brief | **Opgelost (12 okt):** 16 px op de telefoon, 17 px vanaf tablet, kleinere koppen, beslisblok |
| 17 | "Over deze plek" is de meta-omschrijving van de website: vaak afgekapt ("Lees meer"), soms Duits of een prijslijst | Backend Schema, scraper | Site en scraper (v17) gebruiken dezelfde regels (`description.ts`); de scraper leest ook de eerste alinea's van de pagina. Nog open: eigenaren hun eigen tekst laten schrijven (claim, M4) |
| 18 | Foto's: 448 plekken met WordPress-miniaturen, keurmerken (SVR, Zoover) als eerste foto | Scraper, UI/UX Brief | **Opgelost (12 okt):** site en scraper (v17) gebruiken `photos.ts`; de site vraagt de grote versie op |
| 19 | Brief en vaardigheden zeiden "thema staat vast, Fraunces + Inter"; eigenaar vond de site "te AI, te kinderlijk, niet professioneel" | UI/UX Brief, `vrijstaan-stijl` | **Opgelost (12 okt):** kleuren blijven, typografie (Geist), hoeken, schaduw, iconen en beweging volgens de nieuwe `docs/stijlgids.md` |
| 20 | Strikte OSM-toelating (alleen `caravan_site` of `motorhome=yes`) zou ~900 gepubliceerde campings zonder die tag niet meer verversen | PRD (aantal plekken), opdracht 12 okt | **Besloten (16 oktober 2026): nee.** Zoveel mogelijk plekken gaat voor; de strikte toelating staat niet live. Was: besluit Patrick vóór het live zetten van de query en de edge function |
| 21 | ~~PRD: geen accounts voor bezoekers~~ | PRD, TRD | **Gewijzigd 12 okt:** accounts optioneel (opdracht Patrick); zonder account werkt alles |
| 22 | Opdracht Fase 6 (advertenties) botst met PRD "geen advertenties en tracking van derden" en het Vercel Hobby-plan | PRD, TRD | **Besloten (16 oktober 2026): geen advertenties.** Was: besluit Patrick vóór Fase 6; alleen advertenties zonder tracking/cookies passen bij de spelregels |
| 23 | Implementatieplan noemde foto-upload via het reviewformulier (max. 5); gebouwd is een losse knop "Foto toevoegen" per plek | Implementatieplan M4 | Reviewformulier later koppelen aan dezelfde `place_photos` |
| 24 | Live drukte is door gebruikers gemeld, geen feit uit een bron | Spelregel "nooit verzinnen" | Altijd tonen als melding met aantal en tijdstip; niets tonen zonder meldingen van de laatste 3 uur |
| 25 | Pushmeldingen lopen via de pushdienst van de browser (Google, Apple, Mozilla) | Spelregel "geen tracking van derden" | Alleen na toestemming, geen inhoud buiten de melding; vermelden in de privacyverklaring |
| 26 | Opdracht: camper-afmetingen "gekoppeld aan auto-filters"; plekken hebben alleen een bekende maximale lengte, geen hoogte of gewicht | Backend Schema | Alleen op lengte filteren; hoogte en gewicht bewaren voor later (bv. als OSM `maxheight`/`maxweight` wordt meegenomen) |
| 27 | Opdracht: "off-grid ratio" in reisstatistieken; plekken kennen geen "off-grid", alleen stroom ja/nee/onbekend | Spelregel "nooit verzinnen" | Getoond als "Zonder stroom": aandeel nachten zonder stroomaansluiting, alleen over nachten waarvan het bekend is; onbekend apart |
| 28 | Toegankelijkheidsverklaring noemt WCAG 2.2, ≥ 17 px tekst en ≥ 44 × 44 tikdoelen; de code heeft 12 px tekst, 36 px chips en ±12 px markers | UI/UX Brief, toegankelijkheid | **Opgelost (16 oktober 2026):** verklaring noemt WCAG 2.1 AA als doel en de bekende beperkingen; de herstelpunten staan in `plan.md` P13. **Afgerond (22 oktober 2026, P13):** geen tekst onder 14 px meer (enige uitzondering: kaartbronvermelding 12 px, stijlgids §4), tikdoelen ≥ 44 × 44 px (chips, scoreknoppen, kaartknoppen; kaartpunten met een onzichtbaar tikvlak van 44 px), axe-test in licht en donker (`web/e2e/a11y.spec.ts`); verklaring klopt weer. Blijft: kaartpunten niet met toetsenbord of schermlezer te kiezen (lijst is het alternatief); de PRD (branch `claude/prd-bijwerken`) noemt nog "12 px tekst, 36 px chips, kleine markers" als bekende beperkingen, dat kan eruit |
| 29 | Startpagina belooft prijzen met alle toeslagen; live staan toeslagen bij ±965 plekken, maar de snapshot heeft ze niet en Mijn reis telt ze niet mee | PRD, home | `plan.md` P7 (nummering volgt het bord in `docs/samenwerking.md`) |
| 33 | Websites worden maar één keer gelezen (`enqueue_scrape(true)` plant alleen plekken zonder `last_scraped_at`), terwijl de handleiding een "volgende controle" belooft | HANDLEIDING §6, pipeline | **Opgelost (16 oktober 2026):** cron `scrape-refresh` leest elke website eens per 30 dagen opnieuw (`migrations/20261016200000_opnieuw_lezen.sql`). Nummer 33: 12 tot en met 32 zijn uitgedeeld op het samenwerkingsbord (PR #9, §5) |
| 34 | Kernbelofte (#12) zette niet-bevestigde plekken bij Overige; live was er nog geen enkele bevestiging, dus Zonder vertrektijd zou leeg zijn | App Flow, `search.ts` | **Gewijzigd (16 oktober 2026, eigenaar):** kandidaten staan op Zonder vertrektijd onder de bevestigde plekken, met het label "nog niet bevestigd"; groen alleen na bevestiging. **Gewijzigd (18 oktober 2026, eigenaar):** een bron is genoeg bevestiging; geen label meer. Vrij en per 24 uur uit website, zoekagent of OSM staan in groen op Zonder vertrektijd; alleen afgewezen is onbekend en voorwaardelijk staat bij Overige |
| 35 | Agents en skills uit Everything Claude Code gaan uit van Engels, Conventional Commits en eigen documenten (CODEMAP) | CLAUDE.md, stijlgids | **Besloten (18 oktober 2026):** naslag; CLAUDE.md, `docs/specs/` en de stijlgids gaan voor (zie `.claude/skills/BRONNEN.md`) |
| 36 | PRD en spelregels: bronzin alleen in beheer; de plekpagina toont "Volgens de website…" met de zin, en `timesNote` gaat naar de browser | PRD, UI/UX Brief, plekpagina | **Besloten (19 oktober 2026, eigenaar):** mag blijven, klein. De plekpagina toont de bronzin in 14 px, gedempt, onder de vertrekregel ("Bron: “…” (website)"); PRD, UI/UX Brief en spelregel bijgewerkt |
| 37 | PRD noemt 1.509 gepubliceerde plekken; live zijn het er 1.924 (18 oktober 2026) | PRD | **Opgelost (18 oktober 2026):** PRD bijgewerkt met de cijfers van 18 oktober |
| 38 | Standaarddrempel als de instelling ontbreekt: 0,7 in de trigger `places_before_write`, 0,8 in `private.publish_threshold()`; `apply-threshold` telt de verplichte velden niet mee | Backend Schema | Overal `publish_threshold()` en `place_meets_must_haves` (datareview stap 5) |
| 39 | Backend Schema noemt de soort `parkeerplaats`, maar alle 15 staan op concept | Backend Schema | Bekijken bij de dekkingsronde; geen wijziging nodig zolang ze niet aan de eisen voldoen |
| 40 | App Flow: op Zonder vertrektijd staan bevestigde plekken "bovenaan". Sinds datareview stap 4 houdt elke sortering de gekozen volgorde voorop; bevestigd is bij Afstand en Prijs alleen de tweede sleutel (bij gelijke stand), dus niet altijd bovenaan | App Flow, `search.ts` | **Vervalt grotendeels (18 oktober 2026):** na het besluit bij nummer 34 is er geen zichtbaar verschil meer tussen bevestigd en bron; "bovenaan" is uit de app flow gehaald. Bevestigd blijft alleen de tweede sorteersleutel. Oorspronkelijk voorstel (bevestigd als eerste sleutel op Zonder vertrektijd) is niet meer nodig |
| 41 | PRD (18 okt): vertrektijden uit reviews en fora elders (park4night, Campercontact, Facebook) gelden als waar als ze recent zijn; de actie `verify` (pipeline v25) neemt nu alleen letterlijke zinnen van de eigen site over en zet andere bronnen als inzending | PRD Databronnen, Implementatieplan M5 | `verify` aanpassen: externe bron met datum ≤ 24 maanden en letterlijke zin wordt kandidaat met bron in de brondatabase; groen volgens #34 (bron met letterlijke zin is genoeg). Juridisch risico (databankrecht, voorwaarden) is bekend en geaccepteerd door Patrick; geen teksten of foto's overnemen |
| 42 | PRD (18 okt): plekken zonder vertrekregel die de drempel halen blijven zichtbaar als "onvolledig" (grijs, met oproep); de site toont ze nu gewoon op Overige | PRD, App Flow, UI/UX Brief | Grijze markering en oproep op kaart en plekpagina bouwen; App Flow en Brief bijwerken als het gebouwd is. Interpretatie agent: plekken onder de drempel blijven verborgen (te bevestigen door Patrick) |
| 43 | PRD (18 okt): doelgroep 40+ in plaats van 55+ | PRD, `vrijstaan-stijl`, stijlgids | Ontwerpregels (16 px, 44 px) blijven. **Opgelost (29 oktober 2026):** skill, stijlgids, brief en `docs/design.md` noemen 40+ |
| 44 | PRD (18 okt): kosten zo dicht mogelijk bij € 0; Implementatieplan M6 noemt eigen SMTP en een jurist | PRD, Implementatieplan M6 | Gratis SMTP-limiet gebruiken (bijvoorbeeld de gratis laag van een mailprovider); jurist optioneel tot er inkomsten zijn |
| 45 | PRD (18 okt): "mogelijk verouderd" na 12 maanden en een brondatabase in beheer bestaan nog niet | PRD, Backend Schema | Bouwen (Implementatieplan M6, livegang); brondatabase als uitbreiding van `places.sources` of een eigen tabel, schema bijwerken bij de bouw |
| 46 | Legenda zei "Groen staat er alleen als we het hebben gecontroleerd bij de plek zelf"; sinds het besluit van 18 oktober is een bron genoeg (nummer 40, PRD) | Legenda, PRD | **Opgelost (22 oktober 2026, branch `claude/onvolledig-verouderd`):** zin vervangen door de uitleg van de grijze plekken. (Nummers 41 t/m 45 staan in de PRD-herziening, branch `claude/prd-bijwerken`.) |
| 47 | PRD: "een gegeven ouder dan 12 maanden krijgt mogelijk verouderd". Er is nog geen datum per gegeven (brondatabase, nummer 45 in de PRD-herziening) | PRD, Backend Schema | **Interpretatie agent (22 oktober 2026):** per plek, op basis van de laatste controle: de jongste van `verified_at` en `departure_checked_at`. "Laatste update" op de plekpagina toont nu ook die datum (was `verified_at`, anders `updated_at`). Per gegeven zodra de brondatabase er is. Te bevestigen door Patrick |
| 48 | De rij "SEO-pagina's per provincie en plaats" (Mijlpaal 6) en de SEO-regels uit de PRD-herziening staan alleen op branch `claude/prd-bijwerken`, nog niet op `acceptatie` | PRD, Implementatieplan | Rij in het implementatieplan op `claude/seo-paginas` alvast toegevoegd (22 oktober 2026); bij het samenvoegen met `claude/prd-bijwerken` één rij overhouden |
| 49 | Een onbekende plek, provincie of plaats geeft de pagina "Niet gevonden" met `noindex`, maar HTTP-status 200 (Partial Prerendering streamt de pagina al voor `notFound()`). Zoekmachines zien dat als zachte 404 | TRD, App Flow | Niet erg zolang er `noindex` op staat; later bekijken of de params vóór de shell kunnen worden gecontroleerd (`proxy.ts` of een lijst bekende slugs) |
| 50 | Opdrachten noemen `npm run test:unit`; dat script bestaat niet. De unit-tests draaien met `npm test` | `web/package.json` | `npm test` gebruiken (of het script als alias toevoegen) |
| 51 | Reviews alleen met account of code per mail (PRD open vraag 6) botst met "zonder account werkt alles" (punt 21) en met de PRD op `acceptatie`, die vraag 6 nog open heeft staan; de herziening staat op `claude/prd-bijwerken` | PRD, App Flow, Backend Schema | **Gebouwd 22 oktober 2026** (branch `claude/reviews-verificatie`): reviews vragen een account; de code per mail maakt er meteen een. De rest van de site werkt zonder account. Migratie `20261022100000_reviews_met_account.sql` moet nog live, samen met de deploy |
| 52 | Drie migraties hebben dezelfde versie `20261022100000` (PR #52 `aankomst_reserveren`, #48 `reviews_met_account`, #45 `user_trust_lijst`); live staat `aankomst_reserveren` al als `20261022092015` | Backend Schema, migraties | **Opgelost (23 oktober 2026):** #52 gesplitst naar de live versies `20261022092015` en `20261022092604`; #48 houdt `20261022100000`; #45 is `20261023080451` (live) |
| 53 | `20261019070000_contact_beheerder.sql` staat in `acceptatie`, maar niet in de live migratielijst (23 oktober 2026) | Backend Schema, live database | **Opgelost (23 oktober 2026):** kolom `operator`, `place_meets_must_haves` en `ingest_osm` staan al live (via SQL gezet, daarom niet in de migratielijst) |
| 54 | PR #45 is gericht op `main`, de rest van het werk op `acceptatie` | Werkwijze (B9) | **Opgelost (23 oktober 2026):** fix en migratie overgenomen in PR #54; de stand van de tien punten staat als §8 in `docs/archief/plan-2026-10-16.md` |
| 55 | De oude `submit_review` (met `p_author_email`, voor anoniem) kon niet verwijderd worden: de Supabase-tool van de agents blokkeert `drop function` en `delete` | Backend Schema, live database | Ingetrokken voor `public`, `anon` en `authenticated` (23 oktober 2026); niemand kan hem aanroepen. Patrick: in de SQL-editor `drop function public.submit_review(uuid, text, text, integer, integer, integer, integer, integer, text, text, text, date);` en `web/supabase/retention.sql` uitvoeren |
| 56 | Besluit 19 oktober (nummer 36): bronzin klein op de plekpagina. Na de designronde vond de eigenaar dat niet nodig | PRD, UI/UX Brief, plekpagina | **Besloten (23 oktober 2026, eigenaar):** de bronzin staat niet meer op de site, alleen in Beheer → Vertrektijden. `timesSourceLine` is weg; nummer 36 vervalt |
| 57 | Bronnenlaag: tier 3 tot 5 (directories, fora, reviews) vraagt twee losse vermeldingen; "een bron is genoeg" (nummer 34) geldt dus voor tier 1 en 2 | [Bronnenbeleid](../bronnenbeleid.md), `bron.decisions` | **Besloten (18 oktober 2026, eigenaar):** twee keer hetzelfde uit reviews of fora telt als bevestigd. Nummers 41 tot en met 45 staan in PR #37 |
| 58 | Gemeentesites krijgen niet automatisch tier 1: een sessie mag zichzelf geen tier 1 geven, en een naam met "gemeente" is vrij te registreren | Bronnenbeleid §2 | Coördinator zet echte overheidsdomeinen na controle in `bron.sources` op tier 1 (`kind = 'overheid'`); tot dan vragen ze twee vermeldingen |
| 59 | Hoofddoel "de plekken zonder vertrektijd": scraper en zoekproef vinden voor de meeste van die plekken niets, omdat de tijd nergens is gepubliceerd | PRD (kernfeit), bronnenbeleid, implementatieplan | **Voorstel aan eigenaar (23 oktober 2026, aangevuld 24 oktober):** een tweede proef (14 plekken) gaf 2 aanwijzingen buiten de eigen site (reviews en boekingssites), dus zoeken loont beperkt (10 tot 15%), maar de uitkomst komt als inzending bij Beheer en er is nog geen beheeraccount (B6). Onbekend blijft onbekend (regel "nooit data verzinnen"). Winst komt uit (1) de eigenaar-aanvulroute (#53) actief aanbieden aan de 1.626 plekken zonder tijd via het e-mailadres op hun site, (2) vertrektijd melden door bezoekers (`verify`), (3) een belronde voor camperplaatsen met telefoonnummer, (4) de 135 plekken met een foute website corrigeren. Geen bulk uit directories (Databankenwet, bronnenbeleid). **Besloten (24 oktober 2026, eigenaar): niet mailen** (zoals op 18 oktober). Punt (1) wordt: de aanvulroute staat in het vertrekblok van elke plek zonder vertrektijd en op `Doe mee`; geen e-mail aan eigenaren |
| 60 | De migratie `20261018233000_bronnen_en_claims.sql` (bronnenlaag) kan niet live via de agents: `apply_migration` geeft drie keer "cancelled", ook toen de eigenaar koos om opnieuw aan te vragen (24 oktober 2026). De goedkeuring komt niet bij hem aan, net als bij nummer 55 | Backend Schema, dataplan | Patrick: het bestand in de SQL-editor van Supabase uitvoeren. Daarna rolt een sessie `bronnen-mcp` uit met de edge-secret `BRONNEN_MCP_KEY` |
| 61 | `places.town` komt uit OSM (`addr:city`) en wijkt bij een deel van de plekken af van de officiële woonplaats (gemeente of groter dorp in plaats van het dorp); dat raakt plaatspagina's, zoeken en de zoektermen die campers gebruiken | Backend Schema (`places.town`), SEO-pagina's per plaats | **Voorstel (24 oktober 2026):** 29 plekken zijn al gecorrigeerd met PDOK (`private.town_correcties_20261024`). Daarna de woonplaats voor alle plekken met PDOK ophalen (reverse, afstand 0) en `town` bijwerken waar die afwijkt, met een logtabel; buiten Nederland (België) niet aanpassen. Slugs blijven ongewijzigd. **Besloten en uitgevoerd (24 oktober 2026, eigenaar: zekerheidsrun op basis van adres):** officiële woonplaats overal; 1.366 plekken aangepast, oud en nieuw in `private.town_correcties_20261024`. Nieuwe OSM-plekken krijgen dezelfde controle als de pipeline ze importeert (open) |
| 62 | Bronnenbeleid stond botbeveiliging omzeilen niet toe; de eigenaar wil Scrapling gebruiken waar het sterk in is (beveiliging omzeilen, alles zoeken) om de database verder aan te vullen | [Bronnenbeleid](../bronnenbeleid.md) §1, §3, §3a; TRD; `bronnen-mcp` | **Besloten (25 oktober 2026, eigenaar, daarna verruimd):** de stealth-lezer mag alle botbeveiliging omzeilen, `robots.txt` negeren, wisselende proxy's gebruiken en alle openbare bronnen lezen (ook Google Maps en openbare Facebook-pagina's). Wettelijke grenzen blijven: geen inlog- of betaalmuren (computervredebreuk), geen bulk uit databanken (Databankenwet), geen persoonsgegevens (AVG), niemand overbelasten, stoppen op verzoek. Meting dezelfde dag (120 plekken zonder prijs): bij 2 tot 9 van de 115 leesbare voorpagina's komt de tekst pas met JavaScript, en 32 van de 229 onleesbare sites geven een 403. Stap 1 gebouwd (25 oktober): de stealth-lezer voor de eigen sites van plekken (`tools/stealth-lezer`). Nog open: `bronnen-mcp` stopt bij 403 en captcha, en andere bronnen via de stealth-lezer (stap 2, implementatieplan) |
| 63 | Voor de officiële livegang ontbreken bedrijfsgegevens (naam, adres, evt. KvK) en een werkend contactadres: `hallo@vrijstaan.nl` bestaat pas als het domein is geregistreerd en een mailbox heeft, en staat op de contactpagina en in de voorwaarden en privacyverklaring | PRD (livegang), `lib/company.ts` | **Beta (25 oktober 2026):** de pagina's tonen een eerlijke hobbyproject-zin en verwijzen naar het contactformulier; het adres blijft staan tot de eigenaar een domein en mailbox heeft. **Vóór livegang:** eigenaar levert naam en adres (of postbus) en registreert het domein |
| 64 | Redesign 29 oktober 2026 (ontwerpcanvas https://claude.ai/artifact/YYDGJMVfn1q9xBa3U8uNgM, drie concepten). Wijkt af van de brief van vóór die dag: (1) gratis plekken kregen op de kaart avondzon, nu is de stipkleur de vertrekregel en is avondzon alleen nog de gekozen plek; (2) de zoekkaart op de start had een keuze Vertrekken, die zit nu alleen in "Hoe wil je staan?" en de hoofdactie is Plekken bij mij in de buurt; (3) landingspagina's toonden rij-kaarten met foto, nu een vergelijkingstabel | UI/UX Brief, stijlgids, App Flow | **Besloten (29 oktober 2026, eigenaar: "ga mee in je advies")**: start en plekpagina volgen concept B, kaart en Dichtbij concept A, landingspagina's concept C. Brief, stijlgids en flow zijn in dezelfde commit bijgewerkt. De tabbalk (Start, Zoeken, Dichtbij, Mijn reis) blijft zoals hij was |
| 65 | De PRD noemt als doelgroep 40+ (besluit 18 oktober 2026), de UI/UX Brief en de skill `vrijstaan-stijl` nog 55+ | PRD, UI/UX Brief, `vrijstaan-stijl` | **Besloten (29 oktober 2026, eigenaar: "doelgroep is 40+, pas dat overal aan"):** 40+ in PRD, brief, stijlgids, `docs/design.md`, skill `vrijstaan-stijl` en de vaste spelregels. De ontwerpregels (16 px tekst, 44 px tikdoelen) blijven getoetst aan de oudere lezer. Gedateerde verslagen (audits en reviews van oktober) blijven zoals ze geschreven zijn |
| 66 | 228 concepten met website staan op één beslisfeit na klaar voor publicatie (25 oktober 2026, gemeten; 29 oktober: 229, waarvan 150 alleen stroom, 45 alleen vertrektijd, 26 alleen seizoen, 8 alleen prijs): ze halen de score (≥ 0,45) maar niet de harde eis "contact en minstens twee van vertrekregel, openingsperiode, stroom, prijs". Van de 228 hebben 151 alleen stroom, 48 alleen een vertrektijd, 22 alleen een openingsperiode en 7 alleen een prijs. Een steekproef met `inspect` (14 sites, velden plekken/honden/water/seizoen) laat zien dat het ontbrekende feit er meestal niet staat; de extractor mist weinig (één site noemt "Geopend in juli en augustus", dat bewust niet als periode wordt gelezen omdat "en" geen bereik is). Patronen zijn dus uitgeput. | Backend Schema, Implementatieplan | **Besloten (29 oktober 2026, eigenaar: "mag online"):** de vertrekregel telt dubbel in de harde eis (migratie `20261029160000_vertrektijd_telt_dubbel.sql`); bij het toepassen gingen 43 concepten met vertrektijd en contact online (de meting van 25 oktober zei 48). De 180 overige blijven concept tot de eigenaar-aanvulroute of Beheer het ontbrekende feit levert |
| 67 | Een stealth-lezing die weinig of niets oplevert (1 tot 5 pagina's, nul velden, bv. een site die alleen met JavaScript tekst toont) wist via `apply_stealth` → `apply_scrape` velden die eerder gevonden waren: 11 prijzen en 22 publicaties gingen verloren (29 oktober 2026, gemeten tegen de baseline van 24 oktober). `emptySite` in `pages.ts` vangt alleen "0 links en 0 velden" | Backend Schema, Implementatieplan | **Deels opgelost:** 11 prijzen/vertrektijden uit de baseline teruggezet (SQL, geen beheerwaarden). **Opgelost (29 oktober 2026, PR #82, pipeline v54):** `stealthMayWipe` zet `_pages_failed` bij een lezing met alleen de startpagina of zonder velden |
| 68 | "Volgens n bezoekers" bij de vertrekregel: inzendingen zijn anoniem en niet gecontroleerd, dus een gewone telling is te vervalsen (tien keer melden = "volgens 10 bezoekers") | PRD (kernbelofte, nooit verzinnen), Backend Schema, plekpagina | **Gebouwd (29 oktober 2026, opdracht eigenaar):** we tellen alleen meldingen van ingelogde accounts (één per account) die dezelfde regel noemen als de plek nu heeft, niet afgewezen door beheer, uit de laatste 2 jaar. Anonieme meldingen blijven inzendingen voor beheer en tellen niet mee. De regel staat alleen bij een plek met een bekende vertrekregel: meldingen van bezoekers maken van zichzelf geen vertrektijd, dat blijft via Beheer → Inzendingen lopen |
| 69 | Opdracht 30 oktober (masterlijst uit partnerdata en open data) gebruikt eigen koppelregels (≤ 100 m en naamgelijkenis), terwijl `bron.candidates` al koppelt op dezelfde website, ≤ 60 m, ≤ 150 m met naam ≥ 30%, of naam ≥ 60% binnen 400 m. Daarnaast vraagt de opdracht een upsert met de Supabase-client, terwijl het schema `bron` bewust niet via de API openstaat | Backend Schema, dataplan W4.1 | **Besloten (30 oktober 2026, eigenaar):** `geo_bronnen` is de enige bron van waarheid voor welke bronnen naar `places` mogen. De koppelregels van `geo_master` (100 m, naam, nummerregel) gelden voor de dataketen; `bron.candidates` wordt niet voor deze keten gebruikt |
| 70 | Opdracht 30 oktober (kaart): clusters "groen bij < 10, oranje bij > 50" en "3.000+ plekken uit `geo_master` op de kaart". De stijlgids reserveert avondzon (oranje) voor de geselecteerde plek en zegt "kleur is betekenis"; `geo_master` is een tussenlaag die niet op de site hoort (open punt 69, nooit verzinnen) | Stijlgids, Backend Schema | **Besloten (30 oktober 2026, eigenaar):** we volgen de stijlgids. Geen oranje groepen; de groene schaling (grootte en tint, `clusterColors`) blijft. De kaart leest alleen `places` |
| 71 | Opdracht 30 oktober: "gevalideerde records uit `geo_master` naar `places` volgens onze bronnenregels". De bronnenlaag (schema `bron`, migratie `20261018233000`) staat níet live (30 oktober 2026 gecontroleerd), dus `bron.sources` en `bron.decisions` bestaan daar niet. Daarnaast: `places` heeft geen veld dat zegt of een plek legaal is; dat kan alleen een mens per bron beoordelen | Backend Schema, dataplan W4.1, PRD (nooit verzinnen) | **Besloten (30 oktober 2026, eigenaar):** `geo_bronnen` is de bronnenlijst (zie 69). Geen grenspolygoon: de controle "rechthoek en ≤ 16 km van `nl_towns`" blijft, een plek net over de grens wordt geaccepteerd. |
| 72 | Opdracht 30 oktober (community, reviews, zoeken): "review met sterren 1–5" en "Dichtbij via PostGIS-RPC binnen een straal". Reviews zijn 1–10 met deelscores (Backend Schema, App Flow) en de site rekent Dichtbij in de browser over de plekken die al geladen zijn | Backend Schema, App Flow, TRD | **Besloten (30 oktober 2026, eigenaar):** reviews houden de schaal 1–10 met deelscores; Dichtbij blijft in de browser rekenen (privacy en snelheid). Geen PostGIS-RPC voor Dichtbij |
| 73 | Implementatieplan meldt "Onbereikbare plekken opgeruimd (457 plekken, 29 okt) en daarna dagelijks (cron `onbereikbaar-opruimen`)", maar live bestaan `private.verwijderde_plekken`, `private.verwijder_onbereikbare_plekken()` en de cron niet; migratie `20261025160000_onbereikbare_plekken.sql` staat niet in de live migratielijst (gecontroleerd 30 oktober 2026) | Implementatieplan, Backend Schema, live database | **Besloten (31 oktober 2026, eigenaar):** de migratie gaat live. `promote_geo_master` maakt geen nieuwe plek op de plaats van een opgeruimde plek (migratie `20261031170000`, zelfde afstands- en naamregel als koppelen). Let op: de opruiming haalt onbereikbare plekken zonder gegevens weg; ze ziet niet of een plek uit een bron verdwijnt. Live sinds 31 oktober 2026; de proef telde 458 plekken |
| 74 | Opdracht 30 oktober: Archiescampings (CSV) en SVR (GPX) als bron "actief" | Bronnenbeleid §1 en §3a (Databankenwet: geen databank in bulk overnemen; "niet aan de eigenaar om weg te strepen") | **Besloten (30 oktober 2026, eigenaar):** Archie's Campings (aangeleverd als GPX van heel Europa) is actief met tier 3 en `toegestaan`; de eigenaar is verantwoordelijk voor toestemming of licentie (Databankenwet). Gefilterd op Nederland (`filter_archies.py`: rechthoek én +31 of geen nummer, 3.068 van 30.817 waypoints). Het bestand staat alleen versleuteld in de openbare repository (`aanlevering/*.enc`, secret `AANLEVERING_SLEUTEL`); platte bestanden nooit committen. SVR en de partnerbestanden blijven geblokkeerd tot ze er zijn |
| 75 | Opdracht 30 oktober (redesign ronde 1, "anti-AI-slop"): geen zachte schaduwen, randen van 1 px, hoeken maximaal `rounded-lg`, hoge dichtheid | Stijlgids §6 (kaarten 12 px) en §7 (diepte met `shadow-low`/`shadow-raised`), UI-brief | **Besloten (30 oktober 2026, eigenaar):** de nieuwe regel gaat voor. Stijlgids §6 en §7 bijgewerkt. Toegepast op de onderdelen van ronde 1 (cookiebalk, plekrij, snelle chips, beslisblok, details, voorzieningenraster, fotostrook). Andere blokken (drukte, reviews, kaartblok, start) volgen in de volgende rondes. Tikdoelen blijven minstens 44 px. Ronde 2 (1 november 2026): resultaten als één lijst met `border-b`, stack-kaart, zijkolom, kaartblok, Praktisch, drukte, reviews, foto toevoegen, lege staat en fouten zonder schaduw; de skill `vrijstaan-stijl` volgt nu dit besluit |
| 76 | Dataketen: alle 3.598 OSM-masters werden geweigerd (tier 4 met één bron) en dus ook niet gekoppeld aan de plekken die al in `places` staan | Bronregels (README 71), W4.1 | **Besloten (31 oktober 2026, eigenaar):** koppelen ook bij één bron. Bestaat de plek al, dan krijgt de master het `place_id` (promotie `gekoppeld`, reden = het bezwaar). Er komt niets nieuws bij en `places` verandert niet. Migratie `20261031170000_koppelen_zonder_promotie.sql` |
| 77 | `geo_bronnen` zet OSM op tier 4 (opdracht 30 oktober), maar het bronnenbeleid §2 noemt open data en overheid (OSM, PDOK, gemeenten) tier 1. Met tier 4 gaat geen enkele OSM-plek zonder tweede bron naar `places`; met tier 1 wel | Bronnenbeleid §2, opdracht 30 oktober | Open: eigenaar kiest. Tot dan blijft OSM tier 4 en zijn de bestaande plekken alleen gekoppeld (punt 76). `gemeenten_nl` stond in `bronnen.json` als tier 1, volgens het bronnenbeleid; sinds 31 oktober tier 2 (punt 78) |
| 78 | Opdracht 31 oktober: PDOK en gemeentelijke open data als bron met **tier 2**. Het bronnenbeleid §2 en §5 noemt PDOK en gemeenten tier 1 | Bronnenbeleid §2 en §5, opdracht 31 oktober | **Besloten (31 oktober 2026, eigenaar):** tier 2 voor `pdok` en `gemeenten_nl` in `bronnen.json` en `geo_bronnen` (migratie `20261031220000`). Voor de promotie maakt het geen verschil: tier 1 en 2 zijn allebei genoeg met één bron. Het bronnenbeleid (de feitenlaag in schema `bron`) blijft ongewijzigd. Ook besloten (31 oktober): `pdok` en `gemeenten_nl` op toegestaan in `geo_bronnen` (migratie `20261031230000`) en `pdok` op actief in `bronnen.json`, nog zonder lagen; de run slaat een actieve bron zonder lagen over met een waarschuwing |
| 79 | Opdracht 31 oktober: de 3.107 masters die "alleen gekoppeld" zijn, "wachten op een tweede bron om naar `places` te promoveren". Die masters horen al bij een bestaande plek in `places` (≤ 60 m, of ≤ 150 m met een lijkende naam): een tweede bron voegt geen plek toe, de koppeling wordt alleen volledig (`promotie_reden` leeg). Wat een tweede bron wel opent, zijn de 1.236 geweigerde masters (geen bestaande plek, één bron uit tier 3–5) | `promote_geo_master` (migratie `20261031170000`), Dataketen run #8 | Gemeld aan de eigenaar 31 oktober. Een PDOK-record telt alleen als `merge_master` het met de OSM- of Archies-record samenvoegt: binnen 100 m met een lijkende naam, of binnen 25 m als één van beide geen naam heeft |
| 80 | Een proefrun van de Dataketen laat de impact van een nieuwe bron niet zien: `merge_master` schrijft bij een proef niets, dus de promotie-proef bekijkt de bestaande masters zonder de nieuwe records. Ook staat `geo_master.promotie` nog op de uitkomst van de laatste echte run (#5, vóór koppelen bij één bron): op 1 november stonden 28 masters op geweigerd die inmiddels gekoppeld zouden worden | `run_pipeline.py`, `merge_master.ts`, Dataketen runs #6–#10 | Deels opgelost: echte run #11 (1 november 2026) zette `geo_master.promotie` weer goed. Open blijft de proef. Impact van een nieuwe bron tot dan narekenen op het live schema (25 m-regel en `geo_promotie_bezwaar`, in een transactie die wordt teruggedraaid), of een echte run draaien. Mogelijke oplossing: de proef van `merge_master` de voorgestelde masters laten teruggeven en `promote` daarop laten rekenen |
| 81 | Overijssel (Recreatieterreinen verblijfsrecreatie, B5.verblijfsrecreatie_polygon) heeft geen openbare download of WFS; de eigenaar vraagt het bestand aan bij kennishub@overijssel.nl. Het wordt een vlakkenbestand in RD (EPSG:28992), maar de bron `gemeenten_nl` (type `bestanden`, `parse_statics.parse_geojson`) neemt alleen punten in WGS84 aan | `tools/data-collectors/parse_statics.py`, `pdok.py` | **TODO:** zodra de Overijssel-GeoJSON binnenkomt via `aanlevering/gemeenten`, de parser uitbreiden met de omrekening van RD naar WGS84 en het zwaartepunt van vlakken (zoals `pdok.map_features`), en zo nodig `filter` op het soort (camping, camperplaats). Daarna `gemeenten_nl` op actief en een echte run |
| 82 | Opdracht 1 november 2026 (visie 2.0): "laat de gidsen, de restricties in `bronnen.json` en de Databankenwet los" | Bronnenbeleid §3a, nummer 74, CLAUDE.md (specs leidend) | **Afgehandeld door agent (1 november 2026):** vrij gebrainstormd, maar de roadmap neemt geen databanken van concurrenten over en verandert niets aan `bronnen.json` of de koppelregels. De visie is een leidraad na de livegang, geen besluit dat de PRD vervangt |
| 83 | Visie 2.0: "Vriend van VrijStaan" en betaalde B2B-diensten (gemeentedashboard, VrijStaan Inside) | PRD Organisatie en geld (versie 1 gratis, eventueel donatie), nummer 6 (Vercel Hobby is niet-commercieel) | Besluit eigenaar na de livegang. Bij de eerste inkomsten eerst KvK, Vercel Pro en de juridische teksten |
| 84 | Visie 2.0: drukteverwachting per plek en dag | Nummer 24 (niets tonen zonder meldingen van de laatste 3 uur), spelregel "nooit verzinnen" | Voorstel: alleen tonen met het label "verwachting" en de onderbouwing (aantal meldingen, seizoen); zonder genoeg meldingen niets. Besluit eigenaar |
| 85 | Visie 2.0: grensstrook België en Duitsland in H2 | PRD Buiten scope ("strikt Nederland", 18 oktober 2026) | Besluit eigenaar vóór H2; de dataketen accepteert nu al plekken tot ±16 km over de grens (nummer 71) |
| 86 | Visie 2.0: Plekpuls stelt een vraag na een overnachting op een bewaarde plek | Spelregel "geen tracking", privacyverklaring | Locatie alleen op het toestel, nooit naar de server; alleen het antwoord gaat mee. Privacyverklaring bijwerken vóór de bouw |
| 87 | Opdracht 1 november 2026: `price_extras` uit de basisdata van `/api/places` halen (alleen nodig op de plekpagina) | Spelregel "prijzen met alle toeslagen"; `cardPrice` ("+ toeslagen"), `nightTotal` (2 pers.), `priceRank` (Laagste prijs) en Mijn reis rekenen in de browser met `priceExtras` | **Afgehandeld door agent (1 november 2026):** `priceExtras` blijft in de payload, anders verdwijnen het totaal voor 2 personen, de juiste prijssortering en de reiskosten. Wel weg: fotobron, `capacity`, `ratingCount` bij 0, lange coördinaten. Vervolg als het kleiner moet: (a) `id` vervangen door `slug` in de vertrektijd-RPC (−7%), (b) de toeslagen als afgeleide velden (totaal, heeft-toeslagen) leveren en Mijn reis de volledige lijst per plek laten ophalen |
