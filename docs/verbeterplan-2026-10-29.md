# VrijStaan: review en verbeterplan (29 oktober 2026)

Een volledige ronde langs de site: zes soorten gebruikers, een designreview volgens de stijlgids, een vergelijking met
de concurrenten en inspiratie van ontwerpsites. Aan het eind staat één plan met prioriteiten, wie het doet en wat
Patrick moet besluiten.

Status: ⬜ open · 👤 alleen Patrick · grootte S (uren), M (dagen), L (een week of meer).

## 1. Hoe er gekeken is

- **Code:** branch `acceptatie` op f926267 (PR #93), gelijk met `main`.
- **Site:** lokaal gebouwd met `VRIJSTAAN_OFFLINE=1` (snapshot van 22 oktober, 680 plekken) en met Playwright doorlopen
  op iPhone 13-formaat en op een laptop (1440 × 900): start, zoeken, kaart, vertrekpagina's, Dichtbij, plekpagina,
  Mijn reis, Doe mee, provinciepagina, plek aanmelden, FAQ, Mijn camper en Niet gevonden.
- **Beperking:** de testomgeving kan geen foto's van websites en geen kaarttegels laden. Lege fotovakken en een
  kaart die niet laadt zijn daarom niet als fout geteld, wel hoe de site zich gedraagt als dat gebeurt (dat
  overkomt echte bezoekers ook, zie S4).
- **Live cijfers:** rechtstreeks uit Supabase (29 oktober, 21:40).
- **Bronnen:** Campercontact, park4night, ACSI, Camperstop, Searchforsites, The Dyrt, Hipcamp; Dribbble; onderzoek
  naar apps voor oudere gebruikers (zie §9).

## 2. Stand in cijfers (live, 29 oktober)

| | Aantal | Aandeel |
|---|---|---|
| Plekken online | 2.193 | |
| waarvan campings / camperplaatsen / boerderijen / jachthavens | 1.649 / 297 / 210 / 37 | 75% / 14% / 10% / 2% |
| Vertrektijd bekend | 1.447 | 66% |
| waarvan zonder vaste vertrektijd (vrij 25, per 24 uur 7) | 32 | **1,5%** |
| Camperplaatsen met vertrektijd | 140 van 297 | 47% |
| Met nachtprijs | 1.260 | 57% |
| Met foto (van de eigen website) | 2.081 | 95% |
| Reviews / accounts / bezoekersfoto's | 0 / 1 / 0 | |
| Inzendingen die nog wachten | 4 | |
| Database | 73 MB van 500 MB | |

Supabase-adviseur (beveiliging): geen kritieke meldingen. Wel: 13 openbare `SECURITY DEFINER`-functies (bekend, de
meeste bewust), en de controle op gelekte wachtwoorden staat uit.

## 3. De vijf grote bevindingen

**S1. De kernbelofte rust op 32 plekken.** De startpagina en de PRD zetten "zonder vertrektijd" voorop, maar dat geldt
voor 1,5% van de plekken. Op de startpagina staat "Zonder vertrektijd 32" naast "2.193 plekken"; voor een nieuwe
bezoeker voelt de belofte daardoor leeg. Wat VrijStaan wél uniek maakt: bij 1.447 plekken (66%) weet je hoe laat je weg
moet, en vaak ook tot hoe laat je kunt aankomen. Geen concurrent heeft dat als veld.
*Voorstel:* maak de belofte "Weet vooraf hoe laat je weg moet" (vertrektijd bekend), met drie antwoorden: geen vaste
tijd, uitslapers, vaste tijd. Zonder vertrektijd blijft een eigen pagina en filter, maar is niet langer het enige
verhaal. Dit is een besluit voor Patrick (B1) en raakt PRD, start en teksten.

**S2. Het is vooral een campinggids, terwijl camperaars camperplaatsen zoeken.** 75% van de plekken is een camping. Van
de 297 camperplaatsen heeft maar 47% een vertrektijd. Juist daar verwacht de doelgroep het antwoord.
*Voorstel:* data-werk eerst op camperplaatsen richten (157 zonder vertrektijd), met bellen, een mailronde aan
eigenaren en Doe mee per provincie. Doel: 90% van de camperplaatsen vóór 1 januari.

**S3. Er komt nog niets binnen van gebruikers.** 0 reviews, 1 account, 0 bezoekersfoto's, 4 inzendingen die niemand
afhandelt. Campercontact en park4night draaien op hun community; VrijStaan heeft de formulieren, maar zonder domein,
eigen mail en een beheerder die inlogt komt de lus niet op gang.
*Voorstel:* de 👤-taken (domein, mail, beheeraccount) zijn de echte lanceerblokkers; daarna een terugkoppeling aan
wie iets doorgeeft ("je vertrektijd staat nu online").

**S4. Foto's komen rechtstreeks van de websites van plekken.** Elke bezoeker laadt foto's van honderden vreemde
servers. Dat is traag, breekt vaak (dan staat er "De foto kon niet worden geladen", op de laptop een leeg vlak van
470 px hoog) en het IP-adres van de bezoeker gaat naar die sites. Dat schuurt met de regel "geen tracking van derden".
*Voorstel:* een eigen beeldcache (verkleinde WebP in Supabase Storage of via Vercel Image), met de bronvermelding zoals
nu. Gaat de foto mis, dan een kleine kaart van de ligging in plaats van een leeg vlak.

**S5. De hele dataset gaat naar de browser.** `/api/places` stuurt alle samenvattingen mee (±550 bytes per plek, live
±1,2 MB onverpakt). Voor 2.193 plekken gaat dat nog, maar het groeit met elke plek en weegt op 4G op het platteland.
*Voorstel:* compacter formaat (korte sleutels, alleen wat de lijst nodig heeft) en per kaartvlak laden zodra het
aantal boven ±5.000 komt.

## 4. Review per soort gebruiker

### A. Camperaar onderweg (18:30, telefoon, zoekt voor vannacht)

Werkt goed: de oranje knop "Plekken bij mij in de buurt" staat direct in beeld; Dichtbij sorteert op echte rijtijd;
"Nu nog aankomen" is precies de vraag van dat moment; de actiebalk op de plekpagina (prijs, bellen, website, Route).

Stoort:
- De cookiebanner dekt ±20% van het scherm af, net boven de tabbalk, op elke eerste pagina. Op de plekpagina ligt hij
  over het beslisblok, op Dichtbij over de lijst.
- Bij een onbekende vertrektijd is het grootste woord op de plekpagina "Onbekend" (30 px, grijs). Wat we niet weten
  krijgt de meeste aandacht, terwijl er wel iets te doen is: bellen.
- De vertrektabbladen ("Alle 680, Zonder vertrektijd 19, Uitslapers 13…") en de chips op Dichtbij lopen van het scherm
  zonder dat zichtbaar is dat je kunt vegen.
- Geen weer en geen waarschuwing voor milieuzones, twee dingen die een camperaar onderweg wil weten.

### B. Camperaar die vooruit plant (thuis, tablet of laptop)

Werkt goed: Mijn reis met datums, eerlijke kosten ("€ 84 + 2 onbekend"), seizoenswaarschuwing, delen.

Stoort:
- Er is geen "plekken langs mijn route". Campercontact, park4night en The Dyrt hebben het allemaal; voor een planner is
  het de hoofdfunctie.
- Op de laptop is de foto op de plekpagina 470 px hoog; het beslisblok (vertrektijd, prijs) staat pas onder de vouw.
- Niet te zien in je eigen agenda; niet af te drukken als lijstje voor onderweg.
- Plekken naast elkaar vergelijken kan niet.

### C. Oudere of minder digitaal vaardige gebruiker (65+)

Werkt goed: 16 px tekst, tikdoelen van 44 px, duidelijke labels, rustige kleuren, geen haast.

Stoort:
- Voorzieningen op de resultaatkaart zijn alleen icoontjes met "+4"; zonder legenda niet te lezen.
- In de kop staan drie icoonknoppen (+, Hulp, account), op de plekpagina vier. Wat de "+" doet, is niet te raden.
- De startpagina telt acht blokken; wie verder scrolt, verliest het overzicht.

### D. Eigenaar van een plek

Werkt goed: "Ben je de eigenaar? Vul je gegevens aan" met de bekende gegevens al ingevuld; alleen wijzigingen gaan mee.

Stoort:
- Na versturen hoort de eigenaar niets meer; inzendingen wachten op een beheerder.
- Er is niets wat de eigenaar terugkrijgt (een vermelding, een link, een keurmerk). Er is dus weinig reden om mee te
  doen.

### E. Meedoener uit de Facebookgroep

Werkt goed: Doe mee per provincie, korte vragen, geen account nodig.

Stoort:
- Geen voortgang te zien ("in Zeeland zijn nog 29 vertrektijden onbekend, deze week 6 ingevuld").
- Geen bericht als je bijdrage online staat. Zonder beloning houdt een groep het niet lang vol.

### F. Bezoeker via Google

Werkt goed: provincie-, plaats- en vertrekpagina's met structured data, sitemap en drempel voor dunne pagina's.

Stoort:
- Zonder domein en Search Console wordt niets gevonden; dit is de grootste rem op groei.
- De provinciepagina begint op de telefoon met vier alinea's tekst; de lijst met plekken staat pas na twee schermen.

### G. Beheerder (Patrick, later support)

Werkt goed: beheer voor plekken, dubbelen, inzendingen, vertrektijden, statistieken en logs.

Stoort:
- De rol support kan nog alles; bewaartermijnen draaien nog niet automatisch.
- Geen wekelijks overzicht in de mail ("4 inzendingen, 0 reviews, 3 kapotte websites").

## 5. Designreview

Gedaan met de stijlgids, de skill `vrijstaan-stijl`, de UI-brief en de design-skills als naslag.

**Sterk:** het palet is rustig en consequent; Geist leest goed; kleur betekent iets (groen is geen vaste vertrektijd);
"onbekend" is eerlijk zichtbaar; de actiebalk op de plekpagina; geen AI-kenmerken als verlopen, gekleurde blokken of
sierletters.

| # | Wat | Waarom | Voorstel | Grootte |
|---|---|---|---|---|
| D1 | Cookiebanner te groot | Dekt ±20% van het scherm, op elke eerste pagina | Compacte balk van één regel, of geen banner: anonieme statistieken zonder cookies met weinig impact op de privacy mogen in Nederland zonder toestemming (Telecomwet 11.7a; juridisch laten nakijken, B4) | S |
| D2 | Leeg fotovak | 470 px niets op de laptop, 5:2 op de telefoon | Zonder foto: een kleine kaart van de ligging (echte data) of een laag vlak van 120 px; nooit een groot leeg vak | S |
| D3 | "Onbekend" als grootste woord | Het beslisblok antwoordt met wat we niet weten | Bij onbekend: een normale regel "Vertrektijd nog onbekend" plus de knop **Bel en vraag het** (telefoon van de plek) en **Weet jij het?**; aankomst en reserveren blijven zichtbaar | S |
| D4 | Resultaatkaart hoog | Op de telefoon ±2 plekken per scherm | Compacte kaart: foto 96 px vierkant, naam, vertrekbadge, prijs; 3 tot 4 plekken per scherm. Top-3 voorzieningen met woord ("Stroom") in plaats van alleen icoon | M |
| D5 | Startpagina te lang | Acht blokken; "Hoe wil je staan?" maar half in beeld | Vijf blokken: kop, zoeken, Hoe wil je staan, provincies, eigenaren. Uitgelichte plekken en "Zo werkt het" weg of naar Over ons | S |
| D6 | Afgesneden tabbladen en chips | Niet te zien dat je kunt vegen | Vervaagde rand rechts en de actieve tab in beeld scrollen | S |
| D7 | Volle kop op de telefoon | Drie of vier icoonknoppen zonder woord | "+" weg uit de kop (staat in de footer en bij Doe mee); account als woord "Inloggen" of in Mijn reis | S |
| D8 | Landingspagina's tekstzwaar | Vier alinea's vóór de lijst | Cijfers als drie korte regels met getal vooraan (63 plekken · 3 zonder vertrektijd · gemiddeld € 17,40), daarna direct de tabel | S |
| D9 | Laptop-plekpagina | Beslisblok onder de vouw | Foto max. 320 px hoog op `lg`, beslisblok rechts naast de foto | M |
| D10 | Zoeken op de kaart | Kaart en lijst wisselen via de bovenbalk | Zwevende knop **Kaart** / **Lijst** onderaan boven de tabbalk (Airbnb, Hipcamp); kaart laat bij verschuiven direct de plekken in beeld zien (zoals Campercontact sinds de laatste update) | M |
| D11 | Prijs op de kaart | Alleen "Gratis" staat bij de stip | Prijslabel bij elke stip vanaf zoom 11 (zoals Airbnb), kleur blijft de vertrekregel | M |
| D12 | Donkere modus | Niet opnieuw bekeken na de redesign van 29 oktober | Screenshotronde in donker, a11y-test draait al | S |

Niet overnemen van de inspiratiesites: de grote illustraties en verlopen van Dribbble-concepten, foto's als volledige
achtergrond, ronde bubbels. Ze botsen met de stijlgids (§2, "wat we nooit doen") en met de 40+-doelgroep.

## 6. Wat de concurrenten hebben

| | VrijStaan | Campercontact | park4night | ACSI | Camperstop | The Dyrt (VS) |
|---|---|---|---|---|---|---|
| Plekken | 2.193 (NL) | 60.000+ (58 landen) | Europa, community | 9.400 campings + 9.000 camperplaatsen | 15.500 | 50.000+ |
| Prijs voor de gebruiker | gratis | Pro+ € 17,99/jaar | park4night+ € 9,99/jaar | abonnement | betaald | Pro $ 59,99/jaar |
| Vertrektijd als veld | **ja** | nee | nee | nee | nee | nee |
| Prijs met toeslagen | **ja** | deels | nee | deels | tarieven | nee |
| Reviews en foto's | gebouwd, nog 0 | veel | veel | ja | ja | veel |
| Route met plekken onderweg | nee | Pro+ | premium | nee | nee | Pro |
| Offline | reis en bekeken pagina's | per land, Pro+ | premium | ja | ja | Pro |
| Weer | nee | nee | nee | nee | 5 dagen | nee |
| Milieuzones | nee | nee | premium | nee | nee | nee |
| Reclame en tracking | geen | gratis versie met reclame | gratis versie met reclame | | | |

Conclusie: VrijStaan wint op vertrektijd, eerlijke prijs, gratis en geen reclame. Het verliest op aantal plekken
(bewust: alleen Nederland), community, route en offline per regio. De eerste drie gaten zijn met gratis bronnen te
dichten; de community komt pas na livegang.

## 7. Het plan

### Fase 0: lanceerblokkers (nu tot 15 november)

| # | Wat | Wie | Grootte |
|---|---|---|---|
| L1 | Domein vrijstaan.nl registreren en koppelen, `NEXT_PUBLIC_SITE_URL`, Search Console | 👤 + Agent | S |
| L2 | Eigen mail (SMTP) en mailsjablonen met code; daarna reviews aanzetten | 👤 + Agent | S |
| L3 | Beheeraccount gebruiken, de 4 wachtende inzendingen afhandelen | 👤 | S |
| L4 | Naam en contactadres op de juridische pagina's | 👤 | S |
| L5 | Bewaartermijnen automatisch laten draaien (`retention.sql`) | 👤 of Agent | S |
| L6 | Controle op gelekte wachtwoorden aanzetten (Supabase Auth) | 👤 | S |
| L7 | Rol support echt beperken | Agent | M |
| L8 | Back-upgeheimen en hersteltest | 👤 + Agent | S |

### Fase 1: kernbelofte en data (november en december)

| # | Wat | Wie | Grootte |
|---|---|---|---|
| K1 | Besluit over de belofte (S1, B1) en daarna start, PRD en teksten bijwerken | 👤 dan Agent | S |
| K2 | Camperplaatsen naar 90% vertrektijd: lijst van 157, eerst stealth-lezer en zoekagent, daarna bellijst per provincie voor Patrick of de Facebookgroep | Agent + 👤 | L |
| K3 | Mailronde aan eigenaren (vraag vertrektijd, aankomst, prijs; antwoord via het bestaande eigenaarsformulier) | Agent, na L2 | M |
| K4 | Bij onbekende vertrektijd: knop **Bel en vraag het** en **Weet jij het?** (D3) | Agent | S |
| K5 | Prijzen van 57% naar 75%: tarieven uit PDF lezen, campings met tarieflijst | Agent | L |
| K6 | Terugkoppeling aan inzenders: mail als hun vertrektijd of wijziging online staat | Agent, na L2 | M |

### Fase 2: snelle UX-winst (twee weken, kan naast fase 1)

D1, D2, D3, D5, D6, D7, D8, D12 uit §5. Samen ±3 dagen werk; elk punt in een eigen kleine PR met screenshots voor en
na, en de a11y-test erbij.

### Fase 3: vóór livegang (december)

| # | Wat | Waarom | Wie | Grootte |
|---|---|---|---|---|
| F1 | Eigen beeldcache voor foto's (S4) | Snelheid, privacy, minder kapotte foto's | Agent | M |
| F2 | Compacte dataset (S5) | 4G op het platteland | Agent | M |
| F3 | Compacte resultaatkaart en laptop-plekpagina (D4, D9) | Meer plekken per scherm, beslisblok boven de vouw | Agent | M |
| F4 | Zoeken op de kaart: zwevende knop, direct laden bij verschuiven, prijslabels (D10, D11) | Zoals de apps die camperaars al kennen | Agent | M |
| F5 | Lighthouse en Core Web Vitals op de echte Vercel-site, op een middenklasse Android | Lanceervoorwaarde 3 | Agent | S |
| F6 | Testplan uit de PRD op iPhone en Android, met twee echte camperaars van 40+ | Lanceervoorwaarde | 👤 + Agent | M |

### Fase 4: na livegang (eerste kwartaal 2027)

| # | Wat | Bron of inspiratie | Grootte |
|---|---|---|---|
| N1 | Plekken langs je route: route A naar B, plekken binnen x km van de lijn, op rijtijd | Campercontact, park4night, The Dyrt | L |
| N2 | Offline per provincie: plekken, gegevens en kaart van één provincie bewaren | Campercontact Pro+ | L |
| N3 | Weer op de plekpagina (3 dagen, via onze server, zonder tracking) | Camperstop | S |
| N4 | Milieuzones: waarschuwing als een plek of route in een zone ligt, met de regel voor campers (open data van de overheid) | park4night | M |
| N5 | Voortgang per provincie bij Doe mee ("nog 29 onbekend, deze week 6 ingevuld") | Community-lus | S |
| N6 | Voor eigenaren: een link of klein bordje "Vertrektijd bekend op VrijStaan" voor de eigen website | Backlinks en betrouwbaarheid | M |
| N7 | Reis naar je agenda (.ics) en afdrukken als lijst | Planner | S |
| N8 | Twee of drie plekken naast elkaar vergelijken | Booking.com | M |
| N9 | Wekelijks overzicht voor beheer in de mail | Beheer | S |
| N10 | Foto's van bezoekers bij reviews | PRD fase B | M |
| N11 | Engels en Duits | PRD fase C | L |

### Bewust niet doen

Boeken en betalen, reclame, plekken buiten Nederland, een native app (de PWA volstaat) en live drukte zolang er weinig
bezoekers zijn. Dit blijft zoals de PRD het zegt.

## 8. Besluiten voor Patrick

| # | Vraag | Voorstel |
|---|---|---|
| B1 | Wordt de hoofdbelofte "Weet vooraf hoe laat je weg moet" in plaats van alleen "zonder vertrektijd"? | Ja (S1). Zonder vertrektijd blijft een eigen pagina |
| B2 | Data-werk eerst op camperplaatsen? | Ja (S2) |
| B3 | Foto's via een eigen cache in plaats van rechtstreeks van de websites? | Ja (S4); kost opslag binnen het gratis plan |
| B4 | Cookiebanner weg als de statistieken anoniem en zonder cookies zijn? | Eerst juridisch laten nakijken, dan ja |
| B5 | "Plekken langs je route" als eerste grote functie na livegang? | Ja (N1) |

## 9. Bronnen

- Campercontact Pro+: <https://www.campercontact.com/nl/content/proplus>, <https://campercontact.com/en/content/features-pro>;
  update van de app (kaart filtert direct): <https://www.campercontact.com/en/blog/behind-the-scenes-of-major-app-update>
- park4night premium: <https://park4night.com/en/premium>, <https://www.wandernundmehr.at/faq/wie-teuer-ist-park4night>
- Overzicht van apps (Camperstop, Searchforsites, ACSI): <https://www.swiftgroup.co.uk/resources/best-touring-apps/>,
  <https://apps.apple.com/gb/app/searchforsites/id1391657133>
- The Dyrt Pro en routeplanner: <https://bearfoottheory.com/the-dyrt-pro-review/>,
  <https://lunolife.com/blogs/journal/the_best_camping_and-road_tripping_apps_for_2026>
- Hipcamp filters: <https://support.hipcamp.com/hc/en-us/articles/7924872522260-How-to-use-search-filters>
- Dribbble: <https://dribbble.com/shots/4320606-Camp-Rv-App-Redesign>, <https://dribbble.com/savannahux>
- Apps voor oudere gebruikers: <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12350549/>,
  <https://preprints.jmir.org/preprint/43186/accepted>
