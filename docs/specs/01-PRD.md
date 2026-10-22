# 1. Product Requirements Document (PRD)

> Doel: vastleggen wat VrijStaan moet doen en hoe we meten of het lukt.
> Bijgewerkt: 18 oktober 2026 (vragenronde met Patrick). Houd dit document actueel bij elke wijziging in scope.

## Productnaam en idee in één zin

**VrijStaan**: de camperplaatsengids voor Nederland waarin je per plek ziet of je **zonder vaste vertrektijd** kunt
staan, wat het echt kost (inclusief alle toeslagen) en welke voorzieningen er zijn. Bovenaan elke pagina staat wanneer de gegevens voor het laatst zijn bijgewerkt.

**Volgorde van de belofte (besluit 18 oktober 2026):** vertrektijd eerst, daarna de volledige prijs, daarna actuele
gegevens. Bij elke keuze in bouwen of data gaat de vertrektijd voor.

## Positie

| Wat | VrijStaan | Campercontact, park4night, ACSI |
|---|---|---|
| Vertrektijd | Eigen veld en filter, drie vertrekpagina's | Alleen in vrije tekst of reviews |
| Prijs | Nachtprijs plus alle losse toeslagen | Vaak alleen de basisprijs |
| Kosten voor de camperaar | Gratis, alle filters | Deels betaald |
| Advertenties en tracking | Geen | Wel |

## Doelgroep

| Groep | Wie | Wat ze nodig hebben |
|---|---|---|
| Camperaar onderweg (primair) | Nederlandse camperbezitter, **40+** (besluit 18 oktober 2026, was 55+), op een smartphone, vaak laat op de dag | Vannacht een plek vinden, weten of je vrij kunt aankomen en vertrekken, prijs, stroom/water/lozen, past mijn camper, honden |
| Camperaar die vooruit plant | Zelfde groep, thuis op telefoon of tablet | Plekken bewaren, een reis met stops maken, rijtijden zien |
| Eigenaar van een plek | Camping, camperplaats, boerderij, jachthaven, gemeente | Plek claimen (versie 1), juiste gegevens tonen, later eigen tekst en foto's (fase B) |
| Beheerder | Patrick; later support-medewerkers | Data controleren, meldingen en reviews afhandelen, statistieken zien |

Ontwerpregels blijven getoetst aan de oudere lezer (16 px tekst, tikdoelen van 44 px): wat voor 65-jarigen leesbaar
is, werkt voor iedereen.

## Probleem en huidige oplossing

- **Probleem:** veel plekken hanteren vaste vertrektijden ("vertrek vóór 11:00"), en dat staat zelden duidelijk in
  een gids. Prijzen zijn onvolledig (toeslagen ontbreken) en informatie is vaak verouderd.
- **Wat camperaars nu doen:** Campercontact of park4night (betaald voor alle reviews en filters, tijden alleen in
  vrije tekst), losse websites afzoeken, bellen, of forums doorzoeken naar "camperplaatsen zonder vertrektijden".
- **Bewijs:** NKC-enquête (9.000+ respondenten): camperaars willen "ruimte voor spontaniteit"; 32% klaagt over
  onvolledige informatie. Geen grote concurrent heeft vertrektijd als veld of filter.

## Livegang

**1 januari 2027** (besluit 18 oktober 2026). De belofte bij livegang: de gids is zo volledig mogelijk, en **elke
plek in Nederland zonder vaste vertrektijd staat erin en is bevestigd**.

Lanceervoorwaarden (alle drie verplicht):

1. **Juridisch en beheer:** contactgegevens van de eigenaar (ook als hobby) in privacyverklaring, voorwaarden en
   disclaimer; het beheeraccount van Patrick werkt; bewaartermijnen worden automatisch toegepast.
2. **Kernbelofte:** elke plek op Zonder vertrektijd staat in groen (een bron met letterlijke zin is genoeg, besluit
   18 oktober 2026; zie README #34), en 90% van de gepubliceerde plekken heeft een vertrekregel.
3. **Kwaliteit:** pagina's binnen 2,5 seconden bruikbaar op 4G (Core Web Vitals groen) en WCAG 2.1 AA, inclusief de
   bekende beperkingen (12 px tekst, 36 px chips, kleine markers).

## Doel en succesmaat

**Hoofdmaat:** het aantal keer per week dat een bezoeker doorklikt naar de website of het telefoonnummer van een plek.
Dat laat zien dat VrijStaan helpt kiezen. Alleen gemeten met toestemming.

| Doel | Meetbaar signaal | 11 okt 2026 | Nu (18 okt 2026) | Doel |
|---|---|---|---|---|
| Alle plekken zonder vaste vertrektijd | Plekken met vertrekregel "vrij" of "per 24 uur" | 32 | 32 (26 vrij, 6 per 24 uur) | **Alle** die er in Nederland zijn; geen vast getal |
| Zekerheid over die plekken | Daarvan groen: bron met letterlijke zin of bevestiging in beheer | 0 | wordt geteld na de datareview | **100%** bij livegang |
| Vertrekregel bekend | Gepubliceerde plekken met een vertrekregel | ±800 van 3.596 | 1.220 van 1.928 (63%) | **90%** bij livegang |
| Volledige prijzen | Gepubliceerde plekken met een nachtprijs | ±57% | 1.073 (56%) | **90%** |
| Vertrouwen | Goedgekeurde reviews | 0 | 0 | **200** vóór 1 juli 2027 |
| Gebruik | Doorkliks naar een plek per week (met toestemming) | nog niet live | nog niet live | wordt vastgesteld na de eerste maand |

## Wanneer staat een plek online

Besluit 18 oktober 2026:

- **Volledig:** de vertrekregel is bekend. Een prijs is het streven (doel 90%) maar geen eis; zonder prijs staat er
  "Prijs onbekend".
- **Onvolledig:** de plek haalt de huidige drempel (contact plus 2 van 4 kernfeiten; contact is website, telefoon, e-mail of beheerder uit OSM), maar de vertrekregel is
  onbekend. Zo'n plek blijft zichtbaar, grijs en met de vraag om de vertrektijd door te geven.
- Plekken onder de drempel blijven verborgen en worden aangevuld door de scraper en de zoekagenten.

## Databronnen

Besluit 18 oktober 2026: alle bruikbare informatie wordt gebruikt, ook reviews en fora.

- Bronnen: websites van plekken, OpenStreetMap, eigenaren, bezoekers van VrijStaan, reviews en fora elders
  (bijvoorbeeld park4night, Campercontact, Facebookgroepen).
- Een vertrektijd uit een review of forum geldt als waar als het bericht **relatief recent** is (voorstel: hooguit 24
  maanden oud) en de tijd er letterlijk in staat. Verzinnen blijft verboden: geen afleiding of gok.
- Intern bewaren we bij elk gegeven de bron (adres, datum, letterlijke zin), zodat we later opnieuw kunnen zoeken of
  scrapen. Dit wordt een eigen brondatabase in beheer.
- Volgorde: eerst alle data gebruiken die er al is. Daarna eventueel een automatische mailronde aan eigenaren met
  vragen en een akkoord, waarvan de antwoorden automatisch worden verwerkt.
- Een gegeven ouder dan **12 maanden** krijgt op de site "mogelijk verouderd". Websites worden elke 30 dagen opnieuw
  gelezen.

## Kernfuncties

| Functie | Voordeel voor de gebruiker | Prioriteit |
|---|---|---|
| Vertrekregel per plek (vrij / per 24 uur / vast met tijd / onbekend); de letterlijke bronzin staat in beheer en op de plekpagina klein onder de vertrekregel ("Bron: “…” (website)", besluit eigenaar 19 oktober 2026); verder per pagina "Laatste update: datum" | Zekerheid of je kunt vertrekken wanneer je wilt | Must |
| Drie vertrekpagina's: `/zonder-vertrektijd` (vrij of per 24 uur), `/uitslapers` (vertrek 12:00 of later), `/overige-plekken` (11:00 tot 12:00 "ruim", vóór 11:00 "vroeg", of onbekend, met keuze daartussen), met tabbladen boven de resultaten en chips in Dichtbij | Direct de plekken die bij de belofte passen, zonder plekken te verbergen | Must |
| Groene vertrekregel uit een bron (website, zoekagent met letterlijk citaat, OpenStreetMap); beheer kan afwijzen of een voorwaarde markeren | Zekerheid op de belangrijkste pagina | Must |
| Prijs met "vanaf", hoogste tarief en losse toeslagen | Geen verrassingen bij aankomst | Must |
| Zoeken op plaats, streek of eiland, vergeeft typfouten | Snel vinden | Must |
| Lijst en kaart, filters in de URL | Overzicht en deelbare zoekopdrachten | Must |
| Dichtbij: plekken rond je locatie op echte rijtijd | De "vannacht"-vraag | Must |
| Plekpagina met beslispaneel (vertrek, open, prijs, voorzieningen, lengte) | Beslissen in één scherm | Must |
| Reviews (gemodereerd, met account of code per mail) | Vertrouwen | Must |
| Plek aanmelden, fout melden, eigenaar claimen | Data compleet en juist houden | Must |
| Meld inhoud (DSA) en verwijderen op verzoek van een eigenaar | Wettelijk verplicht meldkanaal | Must |
| Beheer: plekken, support, inzendingen, reviews, FAQ, logs, statistieken, instellingen, brondatabase | Site beheren zonder code | Must |
| Zoekagenten en scrapers voor vertrektijden en prijzen (eigen sites, reviews, fora) | Alle plekken zonder vertrektijd vinden | Must |
| SEO-pagina's per provincie en plaats, structured data, sitemap | Gevonden worden zonder advertentiebudget | Must |
| Mijn reis: bewaren, volgorde, nachten, kosten, delen, offline | Vooruit plannen | Should |
| Optioneel account (Google, Apple, Facebook of code per mail) voor synchronisatie | Reis op meer apparaten | Should |
| Doe mee: vertrektijden invullen per provincie | Hulp van de Facebookgroep | Should |
| Camperprofiel met automatisch lengtefilter | Niet voor niets rijden | Should |
| Kosten- en brandstoftracker, reisstatistieken | Overzicht van de reis | Should |
| Samen een reis plannen (realtime) | Plannen met reisgenoten | Should |
| Live drukte (meldingen van bezoekers) en pushmelding als een plek rustig wordt | Weten of er plek is | Could (niet per se nodig; werkt pas met veel bezoekers) |
| Papieren in de voertuigkluis | Documenten bij de hand | Could (niet per se nodig; vraagt extra privacyzorg) |
| Foto's van bezoekers en eigenaren (upload) | Echte beelden, legaal | Should (fase B) |
| Foto's bij reviews, reis met datums en waarschuwing bij gesloten plek | Betere planning | Could (fase B, eerste kwartaal 2027) |
| Engels en Duits | Buitenlandse camperaars | Could (fase C, tweede kwartaal 2027) |

Tot 1 januari gaat alle bouwtijd naar de Must-functies, vooral vertrektijden en prijzen. De Should- en
Could-functies blijven bestaan, maar krijgen geen nieuw werk zolang de kern niet af is.

## Buiten scope voor versie 1

- Boeken en betalen via VrijStaan (we verwijzen naar de plek zelf)
- Plekken buiten Nederland (strikt Nederland, bevestigd 18 oktober 2026)
- Wildkamperen of plekken zonder toestemming om te overnachten
- Advertenties, betaalde vermeldingen en tracking van derden
- Native app in de App Store en Play Store (de webapp is installeerbaar als PWA)
- ~~Accounts voor bezoekers~~ **Gewijzigd (12 oktober 2026):** een account is optioneel (Google, Apple, Facebook of
  inlogcode of -link per mail) om Mijn reis te synchroniseren en foto's toe te voegen. Zonder account werkt alles zoals voorheen.

## Organisatie, geld en kosten

- **Vorm:** hobby van Patrick, nog zonder KvK. Het doel is een bedrijf; dan volgen KvK- en btw-gegevens.
- **Verdienmodel:** versie 1 is gratis. Later eventueel een vrijwillige donatie. Zodra er inkomsten zijn, is Vercel
  Pro nodig (Hobby is niet-commercieel).
- **Kosten:** versie 1 en 2 zo dicht mogelijk bij € 0 per maand: alleen gratis plannen en een domein. Eerst kijken of
  er animo is.
- **Domein:** vrijstaan.nl (staat in de code), moet nog geregistreerd worden.
- **Bezoekers werven:** SEO-pagina's en posts in Facebookgroepen en fora. Geen betaalde marketing.
- **Werken vanuit Claude:** Claude Code bouwt, bewaakt en verbetert SEO, data en marketing. Voorstellen voor
  MCP-koppelingen (bijvoorbeeld Search Console) zijn welkom, zolang ze geen tracking van derden op de site zetten.

## Rollen in beheer

- **Beheerder** (Patrick): alles.
- **Support:** inzendingen, reviews, foto's en meldingen afhandelen; geen instellingen, beheerders of verwijderingen
  (besluit 18 oktober 2026).

## User stories

- Als **camperaar onderweg** wil ik **alleen plekken zien waar ik niet voor een vaste tijd weg moet**, zodat ik
  **mijn dag niet hoef in te richten rond een vertrektijd**.
- Als **camperaar** wil ik **de nachtprijs én de toeslagen zien**, zodat ik **weet wat ik echt betaal**.
- Als **camperaar onderweg** wil ik **de plekken om me heen op rijtijd zien**, zodat ik **vannacht snel kan kiezen**.
- Als **camperaar** wil ik **zien hoe oud een gegeven is**, zodat ik **weet hoeveel ik erop kan vertrouwen**.
- Als **camperaar met een lange camper** wil ik **filteren op maximale lengte**, zodat ik **niet voor niets rijd**.
- Als **camperaar** wil ik **plekken bewaren en een reis maken die ook offline werkt**, zodat ik **onderweg zonder
  bereik verder kan**.
- Als **camperaar** wil ik **een review en de vertrektijd doorgeven**, zodat **anderen er iets aan hebben**.
- Als **camperaar** wil ik **bij een onvolledige plek de vertrektijd kunnen doorgeven**, zodat **de gids vollediger
  wordt**.
- Als **eigenaar** wil ik **mijn plek claimen en de gegevens aanpassen**, zodat **mijn plek juist wordt getoond**.
- Als **eigenaar** wil ik **mijn plek laten verwijderen**, zodat **ik niet tegen mijn zin in een gids sta**.
- Als **beheerder** wil ik **meldingen, reviews en inzendingen op één plek afhandelen**, zodat **de data klopt**.
- Als **beheerder** wil ik **bij elk gegeven de bron terugvinden**, zodat **ik later opnieuw kan zoeken of
  controleren**.
- Als **beheerder** wil ik **zien hoe de site wordt gebruikt**, zodat **ik weet wat camperaars zoeken**.

## Acceptatiecriteria

- Gegeven een plek waarvan de website letterlijk "geen aankomst- en vertrektijden" noemt, wanneer de scraper de site
  leest, dan krijgt de plek vertrekregel **vrij**, wordt de zin in beheer bewaard en staat "Laatste update: <datum>" bovenaan de plekpagina.
- Gegeven een site die alleen "het hele seizoen komen en gaan" voor een **seizoensplaats** noemt, wanneer de scraper
  leest, dan blijft de vertrekregel **leeg**.
- Gegeven een forumbericht of review van hooguit 24 maanden oud waarin letterlijk "geen vertrektijd" staat, wanneer de
  zoekagent het vindt, dan krijgt de plek vertrekregel **vrij** (groen) en staan adres, datum en zin in de brondatabase.
- Gegeven de pagina "Zonder vertrektijd", wanneer ik zoek, dan zie ik alleen plekken met vertrekregel vrij of per
  24 uur; op "Uitslapers" alleen vaste vertrektijden van 12:00 of later; op "Overige" de rest. Via de tabbladen ga ik
  met dezelfde zoekopdracht naar een andere pagina. Een vertrekregel uit een bron (website, zoekagent met letterlijk
  citaat, OpenStreetMap) is genoeg: die staat er in groen, zonder label "nog niet bevestigd". Alleen een regel die
  beheer heeft afgewezen of met een voorwaarde heeft gemarkeerd staat bij "Overige" (besluit eigenaar, 18 oktober 2026).
- Gegeven een plek zonder vertrekregel die de drempel haalt, wanneer ik de kaart bekijk, dan is de plek grijs en
  vraagt de plekpagina om de vertrektijd door te geven.
- Gegeven een tarieflijst met "Kampeerplaats € 24,50" en "Extra volwassene € 5,00", wanneer de scraper leest, dan is
  de nachtprijs € 24,50 en staat "Per persoon € 5,00 per nacht" bij de extra kosten.
- Gegeven een plek zonder bekende prijs, wanneer ik de kaart bekijk, dan staat er "Prijs onbekend" en wordt niets
  verzonnen.
- Gegeven een gegeven dat langer dan 12 maanden niet is bijgewerkt, wanneer ik de plekpagina open, dan staat er
  "mogelijk verouderd".
- Gegeven toestemming voor locatie, wanneer ik Dichtbij open, dan zie ik plekken binnen 80 km gesorteerd op rijtijd,
  en verlaat mijn locatie het apparaat alleen afgerond op ±1 km.
- Gegeven een bezoeker zonder keuze voor statistieken, wanneer de site laadt, dan wordt er niets gemeten tot er een
  keuze is gemaakt.
- Gegeven een ingediende review, wanneer de schrijver geen account heeft en de code uit de mail niet heeft ingevuld,
  of een beheerder hem nog niet heeft goedgekeurd, dan is hij niet zichtbaar.
- Gegeven een verwijderverzoek van een eigenaar via Meld inhoud, wanneer het is afgehandeld (binnen 5 werkdagen,
  automatisch waar dat kan), dan is de plek offline en vergrendeld, zodat de scraper hem niet terugzet.
- Gegeven een support-medewerker, wanneer die Beheer → Instellingen opent, dan heeft die geen toegang.

## Open vragen

1. ~~Hoe streng met vertrektijden?~~ **Besloten (11 oktober 2026):** aparte pagina's "Zonder vertrektijd",
   "Uitslapers" (vertrek 12:00 of later) en "Overige". Aangevuld 11 oktober: binnen Overige onderscheid tussen
   "ruim" (11:00 tot 12:00, de norm) en "vroeg" (vóór 11:00, ongebruikelijk). Bronzinnen niet meer op de site; **gewijzigd (19 oktober 2026, eigenaar):** de bronzin van de vertrektijd mag op de plekpagina blijven, klein.
2. ~~Definitieve publicatiedrempel~~ **Besloten 12 oktober (0,45), aangevuld 18 oktober 2026:** volledig met
   vertrekregel, onvolledig (grijs) zonder; zie "Wanneer staat een plek online".
3. ~~Websitefoto's~~ **Besloten (11 oktober 2026):** overal aan, met bronvermelding en verwijdering op verzoek via
   Meld inhoud. Uit te zetten in beheer (`website_photos`).
4. ~~Bedrijfsvorm~~ **Besloten (18 oktober 2026):** hobby zonder KvK; contactgegevens van Patrick op de juridische
   pagina's. KvK volgt als het een bedrijf wordt.
5. ~~Verdienmodel~~ **Besloten (18 oktober 2026):** gratis, later eventueel donatie; kosten zo dicht mogelijk bij € 0.
6. ~~Reviews verifiëren~~ **Besloten (18 oktober 2026):** account of code per mail, plus moderatie.
7. **Reviews en fora elders scrapen:** juridisch risico (databankrecht, gebruiksvoorwaarden van park4night en
   Campercontact). Besluit Patrick: we doen het, alleen vertrektijden en prijzen als feit, geen teksten of foto's
   overnemen. Nog te bepalen: de exacte grens voor "relatief recent" (voorstel 24 maanden).
8. **Mailronde aan eigenaren:** wanneer, met welke dienst (gratis limiet) en hoe antwoorden automatisch verwerkt worden.
