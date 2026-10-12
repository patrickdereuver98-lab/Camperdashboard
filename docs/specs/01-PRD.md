# 1. Product Requirements Document (PRD)

> Doel: vastleggen wat VrijStaan moet doen en hoe we meten of het lukt.
> Bijgewerkt: 11 oktober 2026. Houd dit document actueel bij elke wijziging in scope.

## Productnaam en idee in één zin

**VrijStaan**: de camperplaatsengids voor Nederland waarin je per plek ziet of je **zonder vaste vertrektijd** kunt
staan, wat het echt kost (inclusief alle toeslagen) en welke voorzieningen er zijn. Bovenaan elke pagina staat wanneer de gegevens voor het laatst zijn bijgewerkt.

## Doelgroep

| Groep | Wie | Wat ze nodig hebben |
|---|---|---|
| Camperaar onderweg (primair) | Nederlandse camperbezitter, meestal 55+, op een smartphone, vaak laat op de dag | Vannacht een plek vinden, weten of je vrij kunt aankomen en vertrekken, prijs, stroom/water/lozen, past mijn camper, honden |
| Camperaar die vooruit plant | Zelfde groep, thuis op telefoon of tablet | Plekken bewaren, een reis met stops maken, rijtijden zien |
| Eigenaar van een plek | Camping, camperplaats, boerderij, jachthaven, gemeente | Juiste gegevens tonen, foto's toestaan, gevonden worden |
| Beheerder (de eigenaar van VrijStaan) | Patrick, later support-medewerkers | Data controleren, meldingen en reviews afhandelen, statistieken zien |

## Probleem en huidige oplossing

- **Probleem:** veel plekken hanteren vaste vertrektijden ("vertrek vóór 11:00"), en dat staat zelden duidelijk in
  een gids. Prijzen zijn onvolledig (toeslagen ontbreken) en informatie is vaak verouderd.
- **Wat camperaars nu doen:** Campercontact of park4night (betaald voor alle reviews en filters, tijden alleen in
  vrije tekst), losse websites afzoeken, bellen, of forums doorzoeken naar "camperplaatsen zonder vertrektijden".
- **Bewijs:** NKC-enquête (9.000+ respondenten): camperaars willen "ruimte voor spontaniteit"; 32% klaagt over
  onvolledige informatie. Geen grote concurrent heeft vertrektijd als veld of filter.

## Doel en succesmaat

| Doel | Meetbaar signaal | Nu (11 okt 2026) | Doel versie 1 |
|---|---|---|---|
| Zekerheid over vertrektijden | Gepubliceerde plekken met bekende vertrekregel | ±800 van 3.596 in de database | 40% van de gepubliceerde plekken |
| Plekken zonder vaste vertrektijd | Plekken met vertrekregel "vrij" of "per 24 uur" | 32 | 150 (via websites, eigenaren en bezoekers) |
| Transparante prijzen | Gepubliceerde plekken met prijs of prijs per persoon | ±57% | 75% |
| Bruikbare dekking | Gepubliceerde plekken | 883–1.263 (drempel tijdelijk 55%) | ±1.000 plekken van goede kwaliteit |
| Vertrouwen | Goedgekeurde reviews | 0 | 200 |
| Gebruik | Bezoeken per week (alleen met toestemming gemeten) | nog niet live | wordt vastgesteld na livegang |

## Kernfuncties

| Functie | Voordeel voor de gebruiker | Prioriteit |
|---|---|---|
| Vertrekregel per plek (vrij / per 24 uur / vast met tijd / onbekend); de letterlijke bronzin staat in beheer, op de site alleen "Laatste update: datum" | Zekerheid of je kunt vertrekken wanneer je wilt | Must |
| Drie vertrekpagina's: `/zonder-vertrektijd` (vrij of per 24 uur), `/uitslapers` (vertrek 12:00 of later), `/overige-plekken` (11:00 tot 12:00 "ruim", vóór 11:00 "vroeg", of onbekend, met keuze daartussen), met tabbladen boven de resultaten en chips in Dichtbij | Direct de plekken die bij de belofte passen, zonder plekken te verbergen | Must |
| Prijs met "vanaf", hoogste tarief en losse toeslagen | Geen verrassingen bij aankomst | Must |
| Zoeken op plaats, streek of eiland, vergeeft typfouten | Snel vinden | Must |
| Lijst en kaart, filters in de URL | Overzicht en deelbare zoekopdrachten | Must |
| Dichtbij: plekken rond je locatie op echte rijtijd | De "vannacht"-vraag | Must |
| Plekpagina met beslispaneel (vertrek, open, prijs, voorzieningen, lengte) | Beslissen in één scherm | Must |
| Mijn reis: bewaren, volgorde, nachten, kosten, delen, offline | Vooruit plannen | Should |
| Reviews (gemodereerd) | Vertrouwen | Must |
| Plek aanmelden, fout melden, eigenaar claimen | Data compleet en juist houden | Must |
| Meld inhoud (DSA) | Wettelijk verplicht meldkanaal | Must |
| Beheer: plekken, support, inzendingen, reviews, FAQ, logs, statistieken, instellingen | Site beheren zonder code | Must |
| Foto's van bezoekers en eigenaren (upload) | Echte beelden, legaal | Should (fase B) |
| Reis met datums en waarschuwing bij gesloten plek | Betere planning | Could (fase B) |
| Engels en Duits | Buitenlandse camperaars | Could (fase C) |

## Buiten scope voor versie 1

- Boeken en betalen via VrijStaan (we verwijzen naar de plek zelf)
- Plekken buiten Nederland
- Wildkamperen of plekken zonder toestemming om te overnachten
- Advertenties, betaalde vermeldingen en tracking van derden
- Native app in de App Store en Play Store (de webapp is installeerbaar als PWA)
- ~~Accounts voor bezoekers~~ **Gewijzigd (12 oktober 2026):** een account is optioneel (Google, Apple, Facebook of
  inloglink) om Mijn reis te synchroniseren en foto's toe te voegen. Zonder account werkt alles zoals voorheen.

## User stories

- Als **camperaar onderweg** wil ik **alleen plekken zien waar ik niet voor een vaste tijd weg moet**, zodat ik
  **mijn dag niet hoef in te richten rond een vertrektijd**.
- Als **camperaar** wil ik **de nachtprijs én de toeslagen zien**, zodat ik **weet wat ik echt betaal**.
- Als **camperaar onderweg** wil ik **de plekken om me heen op rijtijd zien**, zodat ik **vannacht snel kan kiezen**.
- Als **camperaar** wil ik **zien waar een gegeven vandaan komt en hoe oud het is**, zodat ik **weet hoeveel ik erop
  kan vertrouwen**.
- Als **camperaar met een lange camper** wil ik **filteren op maximale lengte**, zodat ik **niet voor niets rijd**.
- Als **camperaar** wil ik **plekken bewaren en een reis maken die ook offline werkt**, zodat ik **onderweg zonder
  bereik verder kan**.
- Als **camperaar** wil ik **een review en de vertrektijd doorgeven**, zodat **anderen er iets aan hebben**.
- Als **eigenaar** wil ik **mijn gegevens en foto's aanpassen**, zodat **mijn plek juist wordt getoond**.
- Als **beheerder** wil ik **meldingen, reviews en inzendingen op één plek afhandelen**, zodat **de data klopt**.
- Als **beheerder** wil ik **zien hoe de site wordt gebruikt**, zodat **ik weet wat camperaars zoeken**.

## Acceptatiecriteria

- Gegeven een plek waarvan de website letterlijk "geen aankomst- en vertrektijden" noemt, wanneer de scraper de site
  leest, dan krijgt de plek vertrekregel **vrij**, wordt de zin in beheer bewaard en staat "Laatste update: <datum>" bovenaan de plekpagina.
- Gegeven een site die alleen "het hele seizoen komen en gaan" voor een **seizoensplaats** noemt, wanneer de scraper
  leest, dan blijft de vertrekregel **leeg**.
- Gegeven de pagina "Zonder vertrektijd", wanneer ik zoek, dan zie ik alleen plekken met vertrekregel vrij of per
  24 uur; op "Uitslapers" alleen vaste vertrektijden van 12:00 of later; op "Overige" de rest. Via de tabbladen ga ik
  met dezelfde zoekopdracht naar een andere pagina.
- Gegeven een tarieflijst met "Kampeerplaats € 24,50" en "Extra volwassene € 5,00", wanneer de scraper leest, dan is
  de nachtprijs € 24,50 en staat "Per persoon € 5,00 per nacht" bij de extra kosten.
- Gegeven een plek zonder bekende prijs, wanneer ik de kaart bekijk, dan staat er "Prijs onbekend" en wordt niets
  verzonnen.
- Gegeven toestemming voor locatie, wanneer ik Dichtbij open, dan zie ik plekken binnen 80 km gesorteerd op rijtijd,
  en verlaat mijn locatie het apparaat alleen afgerond op ±1 km.
- Gegeven een bezoeker zonder keuze voor statistieken, wanneer de site laadt, dan wordt er niets gemeten tot er een
  keuze is gemaakt.
- Gegeven een ingediende review, wanneer een beheerder hem nog niet heeft goedgekeurd, dan is hij niet zichtbaar.

## Open vragen

1. ~~Hoe streng met vertrektijden?~~ **Besloten (11 oktober 2026):** aparte pagina's "Zonder vertrektijd",
   "Uitslapers" (vertrek 12:00 of later) en "Overige". Aangevuld 11 oktober: binnen Overige onderscheid tussen
   "ruim" (11:00 tot 12:00, de norm) en "vroeg" (vóór 11:00, ongebruikelijk). Bronzinnen niet meer op de site.
2. **Definitieve publicatiedrempel** na de herscrape (nu tijdelijk 55%).
3. ~~Websitefoto's~~ **Besloten (11 oktober 2026):** overal aan, met bronvermelding en verwijdering op verzoek via
   Meld inhoud. Uit te zetten in beheer (`website_photos`).
4. **Bedrijfsvorm en gegevens** (naam, adres, KvK, btw) voor privacy en voorwaarden.
5. **Verdienmodel**: blijft het gratis? Bij commercieel gebruik is Vercel Pro nodig.
6. **Reviews verifiëren** met een bevestigingsmail (vraagt een mailprovider)?
