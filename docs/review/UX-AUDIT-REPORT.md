# UX-audit "VrijStaan volwassen maken" (27 november 2026)

Uitvoering van `plan.md` (twee plannen samengevoegd: de opdracht UX-audit en "VrijStaan 2027" van ChatGPT). Besluiten
in `docs/specs/README.md` nummer 145. Screenshots en controle per scherm: [`SCREENSHOT-QA.md`](SCREENSHOT-QA.md).
Belangrijkste keuzes en waarom: [`DESIGN-DECISIONS.md`](DESIGN-DECISIONS.md).

## 1. Wat al goed was (niet opnieuw gebouwd)

De ronden van 26 november hadden veel van beide plannen al gedaan. Nagekeken in de code, niet aangeraakt:

- Zoekresultaten met vertrektijd eerst, snelle chips, filtersheet met "Toon n plekken", lijst en kaart naast elkaar
  op een groot scherm, "Met filters: …" bij zoeken in gewone taal, "Toon meer" onthouden.
- Kaart met groepen, "Zoek in dit gebied", paneel met Route en Bekijk plek.
- Dichtbij met rijtijd eerst; Mijn reis met Volgende stop bovenaan, reisopties in een menu, kosten met
  "€ 84 + 2 onbekend", volgorde wijzigen zonder slepen.
- Compacte footer op taakpagina's; provincie- en plaatspagina's als korte gids (titel, feiten, kaart, vertrekgroepen,
  plekken, plaatsen); geen tekening als er geen foto is.

## 2. Belangrijkste problemen en waarom

| # | Probleem | Waarom een probleem | Pagina |
|---|---|---|---|
| 1 | Op een computer stond de vertrektijd onder de vouw (foto 470 px hoog) | Het kernfeit is het eerste wat iemand wil weten | Plek |
| 2 | Beslisblok van vier even grote vakken | Vertrek, prijs, open en aankomst kregen hetzelfde gewicht; reserveren stond pas ver onderaan | Plek |
| 3 | Vijf even zware acties binnen één duimhoogte (vier tegels plus Route) | Te veel keuzes, meer verkeerde tikken | Plek |
| 4 | Op een computer won "Reserveren via de website" van Route | De primaire actie was niet de opvallendste; VrijStaan kan niet reserveren | Plek |
| 5 | Kop met vijf iconen op de plekpagina | Globale acties concurreren met de plek | Plek |
| 6 | "Nog geen reviews" bovenaan elke plek | Live zijn er 0 reviews: elke plek begon met een gemis | Plek |
| 7 | Check voor vertrek herhaalde het beslisblok | Dubbele informatie | Plek |
| 8 | Onderaan een teller "7 van 12 gegevens bekend" en zes acties | De bezoeker hoeft de database niet te begrijpen | Plek |
| 9 | "Mogelijk verouderd" in rood | Rood is voor fouten en dicht; dit is een signaal | Plek |
| 10 | Springlinks plakten bovenaan (±56 px) | Ruimte weg van de inhoud | Plek |
| 11 | Correctieformulier: één keuzelijst met acht onderwerpen, Reserveren, Aankomst en Foto ontbraken | Eerst kiezen, dan alleen de relevante velden is sneller | Plek |
| 12 | Teksten verwezen naar de knop "Klopt er iets niet?" die niet meer bestond | Kapotte instructies | Voorwaarden, melden, disclaimer, FAQ |
| 13 | Dichtbij zonder resultaat: tot vier uitwegen | Te veel keuzes op het moment dat je vastzit | Dichtbij |
| 14 | Locatie geweigerd: rood blok met uitleg over de browser | Geen weg vooruit, voelt als een fout | Dichtbij |
| 15 | Onbekende vertrektijd in Mijn reis zonder uitleg waarom een aankomsttijd ontbreekt | De gebruiker snapt de berekening niet | Mijn reis |

## 3. Wat er veranderde

**Plekpagina** (fase D)
- Beslisblok: vertrek groot over de volle breedte met één zin wat dat betekent, dan de prijs, dan Aankomst, Open en
  Reserveren als korte regels. Onbekend staat er rustig als "Onbekend". Alleen bij een onbekende vertrektijd één knop
  **Vertrektijd doorgeven**.
- Eén primaire actie: **Route openen** (vaste balk op de telefoon, bovenaan de zijkolom op een groot scherm). De prijs
  komt pas in de vaste balk als het beslisblok uit beeld is. Website en bellen zijn ondergeschikt en staan bij
  Reserveren en Contact.
- Kop op de telefoon: terug, naam van de plek bij scrollen, Bewaren en Meer (Delen, Plek aanmelden, Inloggen).
- Goed om te weten: tijden, reserveren uitgelegd vóór de link, prijs en voorwaarden met betalen. Past je camper? bij
  Voorzieningen. Over deze plek vóór Ervaringen.
- Onderaan **Klopt er iets niet?** met één knop **Gegevens corrigeren of aanvullen** (eerst kiezen wat, dan alleen die
  velden, fout bij het veld) en een eigen blok **Eigenaar van deze plek?**.
- Mogelijk verouderd in `ink-2` met een klokicoon. Desktopfoto 320 px. Laadscherm met dezelfde maten.

**Dichtbij, kaart en Mijn reis** (fase E en F)
- Dichtbij: hoogstens twee uitwegen; "Geen plekken waar je nu nog kunt aankomen." als dat de oorzaak is; zonder
  locatie één zin en het zoekveld.
- Rijtijd nooit tonen als het hemelsbreed is (`driveSummary`, met test).
- Kaartpaneel: Route openen, Bekijk plek en het hartje. Mijn reis: Route openen en één uitlegregel als de aankomsttijd
  door een onbekende vertrektijd niet te berekenen is.

**Overal** (fase G)
- Woordenboek, statustaal en informatiedichtheid in de stijlgids (§11a), doorgevoerd: Bewaren, Route openen, Naar de
  website, Gegevens corrigeren of aanvullen, Vertrektijd doorgeven.
- Doe mee en Plek aanmelden: zie [`SCREENSHOT-QA.md`](SCREENSHOT-QA.md) en de commit van de formulierenronde.

## 4. Bewust niet veranderd

- Huisstijl, kleuren, Geist, kaartstijl, hoeken: staan vast en waren niet het probleem.
- Snelle chips op Zoeken en de volgorde op de start: pas gisteren besloten, geen gebruiksdata die iets anders zegt.
- Tabnamen Start, Zoeken, Dichtbij, Mijn reis: beide plannen zeggen niet veranderen zonder bewijs.
- "Vanaf € 18": komt uit de bron, de prijslogica is leidend.
- Een set bouwstenen voor knoppen, kaarten en secties voor de hele site: na de livegang, te veel risico vóór de
  bevriezing van 19 december.
- Meting van klikken (events): na de livegang en alleen met toestemming.
- Delen en Meer reisopties in Mijn reis blijven direct onder Volgende stop (brief): het is een gesloten menu.

## 5. Open en voor Patrick

- Migratie `20261127100000_faq_nieuwe_knoppen.sql` live zetten zodra PR #202 live staat (FAQ verwijst dan naar de
  nieuwe knoppen).
- Zes begeleide gebruikerstests in de testweek (plan.md spoor P1).
- Kaartpaneel op een kleine telefoon valt deels achter de tabbalk in de kaartweergave van Zoeken (melding van de
  worker; hoort bij C5, kaartronde).
