# 3. App Flow

> Doel: elk scherm, elk pad en het gevolg van elke tik vastleggen.
> Bijgewerkt: 29 oktober 2026 (redesign: start, gekozen plek op de kaart, Dichtbij kaart eerst). Routes verwijzen naar `web/src/app/`.

## Ingangen

- Zoekmachine of gedeelde link naar een plek: `/plek/<slug>`
- Startpagina `/` (direct of vanaf het beginscherm als geïnstalleerde PWA)
- Landingspagina's voor zoekmachines (SEO, sinds 22 oktober 2026; regels in `web/src/lib/seo-pages.ts`):
  - Provincie: `/camperplaatsen/<provincie>` (alle 12)
  - Plaats of Waddeneiland: `/camperplaatsen/<provincie>/<plaats>` (bv. `/camperplaatsen/noord-holland/texel`,
    `/camperplaatsen/zeeland/middelburg`). Een eiland hoort bij een plek op ligging (rechthoek om het eiland), een
    plaats op de plaatsnaam van de plek
  - Vertrekgroep per provincie: `/zonder-vertrektijd/<provincie>` en `/uitslapers/<provincie>`
  - Drempel: pas vanaf 3 gepubliceerde plekken een indexeerbare pagina met plek in de sitemap. Daaronder bestaat de
    pagina wel (links blijven werken als het aantal even zakt), met `noindex, follow`. Een plaats zonder plekken of
    een onbekende provincie geeft "Niet gevonden"
- Gedeelde zoekopdracht: `/zoeken?...`, `/zonder-vertrektijd?...`, `/uitslapers?...` of `/overige-plekken?...` (alle
  filters staan in de URL)
- Gedeelde reis: `/mijn-reis?r=<code>`
- Supportlink uit een mail: `/support/<token>`
- Beheer: `/admin` (alleen beheerders)

## Schermoverzicht

| Scherm | Route | Doel | Benodigde data |
|---|---|---|---|
| Start | `/` | Knop **Plekken bij mij in de buurt** (→ `/dichtbij`), zoekveld (bestemming → `/zoeken`), direct daaronder "Hoe wil je staan?" met drie regels (→ `/zonder-vertrektijd`, `/uitslapers`, `/zoeken`), populaire bestemmingen, uitgelichte plekken, voorzieningen (nu open, stroom, lozen, honden), uitleg in drie stappen | Statistieken, alle plekken (voor de bestemmingsfoto's), uitgelichte samenvattingen |
| Zoeken | `/zoeken` | Lijst of kaart met filters en sortering, alle plekken. De eerste 20 plekken van de zoekopdracht in het adres staan al in de HTML (server); daarna rekent de browser met de hele dataset | Eerste 20 op de server (`getSummaries`), daarna alle samenvattingen (`/api/places`), woonplaatsen (`/api/towns`), adressen en postcodes (`/api/locatie`, PDOK) |
| Zonder vertrektijd | `/zonder-vertrektijd` | Zelfde zoekscherm, vertrekregel vrij of per 24 uur, allemaal in groen en gelijkwaardig: een regel uit een bron (website, zoekagent met letterlijk citaat, OSM) is genoeg, zonder label "nog niet bevestigd" (besluit eigenaar 18 oktober 2026). Door beheer of de eigenaar bevestigd (Beheer → Vertrektijden) is alleen de tweede sorteersleutel: bij gelijke prijs, afstand of score staat die eerst. Met voorwaarde of afgewezen staat bij Overige | Idem |
| Uitslapers | `/uitslapers` | Zelfde zoekscherm, vaste vertrektijd 12:00 of later | Idem |
| Overige plekken | `/overige-plekken` | Zelfde zoekscherm, vertrek vóór 12:00 of onbekend, met keuze: 11:00 tot 12:00 / vóór 11:00 / onbekend | Idem |
| Provincie | `/camperplaatsen/<provincie>` | Landingspagina: inleiding uit de cijfers (aantal, gratis, zonder vertrektijd, uitslapers, vertrektijd onbekend, gemiddelde nachtprijs zonder toeslagen) → **Bekijk op de kaart** (`/zoeken?provincie=…&kaart=1`), knoppen naar de vertrekgroep-pagina's van de provincie en Gratis plekken → 24 plekken (meest complete gegevens eerst) met link naar alle plekken in het zoekscherm → eilanden → plaatsnamen (met ≥ 3 plekken naar de plaatspagina, anders het zoekscherm rond die plaats). Lijst staat in de HTML (server-side) | Samenvattingen |
| Plaats of eiland | `/camperplaatsen/<provincie>/<plaats>` | Kruimelpad Start › provincie › plaats → inleiding uit de cijfers → **Bekijk op de kaart** (zoekscherm rond de plaats of het eiland) en, als er plekken zonder bekende vertrektijd zijn, **Weet jij een vertrektijd?** (`/doe-mee`) → alle plekken (max. 40) → plaatsen op het eiland → meer in de provincie (provincie, vertrekgroepen, andere plaatsen) | Samenvattingen |
| Vertrekgroep per provincie | `/zonder-vertrektijd/<provincie>`, `/uitslapers/<provincie>` | Kruimelpad Start › Zonder vertrektijd (of Voor uitslapers) › provincie → inleiding → **Bekijk op de kaart** en **Filters en sorteren** (het zoekscherm `/zonder-vertrektijd?provincie=…`) → plekken uit die groep (max. 40) → plaatsen met zulke plekken → verder zoeken (provincie, andere groep, dezelfde groep in andere provincies met ≥ 3 plekken) | Samenvattingen |
| Filterscherm | sheet op `/zoeken` | Vertrekken, voorzieningen, prijs, soort, lengte, overig, met live teller | Samenvattingen |
| Plek | `/plek/<slug>` | Beslissen: vertrek met aankomstvenster ("Aankomen tussen 14:00 en 22:00") en reserveren (verplicht, kan, hoeft niet) bovenaan, open, prijs met het totaal voor 2 personen per nacht (toeristenbelasting en stroom erbij, alleen als elk onderdeel vaststaat; anders staat er wat ontbreekt) en extra kosten, voorzieningen, contact, route, reviews. Bovenaan "Laatste update: <datum>" (laatste controle, zie hieronder), met ", mogelijk verouderd" als die controle meer dan 12 maanden oud is. Een onvolledige plek (geen vertrekregel) vraagt bij Vertrekken om de vertrektijd door te geven | Volledige plek, reviews, plekken in de buurt |
| Dichtbij | `/dichtbij` | Plekken rond je locatie op rijtijd. Op de telefoon kaart eerst met de lijst als sheet eronder; een tik op een stip toont de plek onderaan de kaart (Route, Bekijk plek). Chips "Nu open" en "Nu nog aankomen" (beide standaard aan) verbergen alleen wat zeker dicht is: seizoen voorbij, of de laatste aankomsttijd van vandaag verstreken (onbekend blijft staan); met een lengte in Mijn camper vallen te kleine plekken weg (chip "Mijn camper" zet dat uit), net als bij Zoeken | Locatie (toestemming), samenvattingen, `/api/distances` |
| Mijn reis | `/mijn-reis` | Bewaarde plekken, vertrekdatum (optioneel: per stop aankomst en vertrek, waarschuwing als de plek dan volgens het seizoen dicht is), volgorde, nachten, kosten (inclusief prijs per persoon bij plekken zonder basisprijs en de toeristenbelasting die de plek zelf per persoon per nacht noemt; overige toeslagen apart onder "+ toeslagen, niet meegeteld"), route, delen. Paneel "Uitgaven onderweg": uitgave toevoegen (soort, bedrag, datum, liters bij brandstof, stop), totaal tegenover de begroting, gemiddelde per dag en literprijs, weghalen | `localStorage`, samenvattingen, `/api/route` |
| Doe mee | `/doe-mee` | Camperaars (o.a. de Facebookgroep) vullen vertrektijden in van plekken waar die onbekend is, of melden een plek | Samenvattingen; formulier → `submit_place` (soort `correctie`, onderwerp `vertrektijd`) → Beheer → Inzendingen, waar beheer de vertrektijd met één knop overneemt (daarna bij Vertrektijden te bevestigen als het "geen vaste tijd" of "per 24 uur" is) |
| Plek aanmelden | `/plek-aanmelden` | Nieuwe plek of eigenaarsclaim indienen | Formulier → `submit_place` |
| Contact | `/contact` | Vraag stellen, ticket maken | Formulier → `create_ticket` |
| Ticket | `/support/<token>` | Antwoord lezen en reageren | `get_ticket`, `reply_ticket` |
| Meld inhoud | `/melden` | DSA-melding van illegale of onjuiste inhoud | Formulier → `create_ticket` |
| Veelgestelde vragen | `/veelgestelde-vragen` | Antwoorden zoeken | `faq` |
| Over ons, Reviews en ranking, Privacy, Cookies, Voorwaarden, Disclaimer, Toegankelijkheid | eigen routes | Uitleg en juridische informatie | `src/lib/company.ts`, statistieken |
| Niet gevonden | elke onbekende route | "Verkeerd afgeslagen" met terugweg | — |
| Inloggen | `/inloggen?next=<pad>` | Google, Apple, Facebook of e-mail: je krijgt een mail met een code (invullen op dezelfde pagina) en een link; daarna terug naar `next`. Met e-mail maak je bij de eerste keer meteen een account aan | Supabase Auth |
| Inlog-terugkomst | `/auth/callback` | Code inwisselen, door naar `next`; bij een fout een begrijpelijke melding | Supabase Auth |
| Reisstatistieken | `/mijn-reis/statistieken` | Kerncijfers (km langs je stops, nachten, gemiddelde nachtprijs over bekende prijzen, aandeel nachten zonder stroom over bekende nachten) en staafdiagrammen (nachten per stroomsituatie, uitgaven per soort) met tabelweergave. Onbekend blijft onbekend | Mijn reis, uitgaven, `/api/route` |
| Mijn camper | `/mijn-camper` | Maten, brandstof en verbruik invullen (werkt zonder account). Lengte zet bij zoeken het lengtefilter vanzelf aan (chip "Mijn camper"; wegtikken → `lengte=0`, blijft uit). Verbruik vult Mijn reis. Ingelogd: papieren uploaden, openen, weghalen | localStorage, `user_vehicles`, Storage `vehicle-docs` |
| Mijn account | `/account` | Naam, inlogmanier, aantal plekken in Mijn reis, uitloggen, account verwijderen (tweestaps: knop, dan VERWIJDEREN typen; papieren worden eerst weggehaald; `delete_my_account(p_confirm)` controleert het woord ook) |
| Samen plannen | kaart in `/mijn-reis`, uitnodiging `/samen/<code>` | Starten maakt een gedeelde reis van je reis; uitnodiging delen; meedoen vervangt je reis (met waarschuwing); wijzigingen realtime bij iedereen; stoppen maakt je los | `shared_trips` (Realtime), RPC's | Sessie, `user_trips` |
| Drukte | kaart onder prijs op `/plek/<slug>` | Meldingen van de laatste 3 uur ("Druk, volgens 3 camperaars, laatste melding 20 minuten geleden") of "Nog niemand gemeld". Ingelogd: Rustig / Druk / Vol doorgeven; anders inloggen. Bij druk of vol: "Laat het me weten als het hier rustig is" → toestemming voor meldingen → één pushmelding binnen 24 uur (iPhone: alleen vanaf het beginscherm) | `crowd_status`, `report_crowd` |
| Foto toevoegen | knop onder het beslisblok op `/plek/<slug>` | Niet ingelogd → `/inloggen`; ingelogd → foto kiezen, verkleinen (zonder EXIF), bijschrift, licentie aanvinken, versturen → "we bekijken je foto" of (vertrouwd) "staat zo online" | Storage `place-photos`, `place_photos` |
| Beheer | `/admin/*` | Overzicht, Statistieken, Plekken, Dubbelen, Support, Inzendingen, Reviews, Foto's, FAQ, Logs, Instellingen | Beheer-RPC's, RLS |

## Hoofdroute: vannacht een plek vinden

`Start` → typ plaats, streek, adres of postcode (suggesties tijdens typen) → **Zoeken** (of eerst een regel uit "Hoe wil je staan?") → `Zoeken` (lijst, gesorteerd op Aanbevolen) →
tik de chip **Zonder vertrektijd** (gaat naar `/zonder-vertrektijd` met dezelfde zoekopdracht; nog een tik zet hem uit) → tik een plek → `Plek` (beslispaneel) →
**Route** (opent navigatie) of **Bellen** → **succes:** camperaar rijdt naar de plek.

Snelle variant: `Start` → **Plekken bij mij in de buurt** → `Dichtbij` (locatie toestaan) → kaart en lijst op rijtijd → tik een stip → **Route** (meteen) of **Bekijk plek** → `Plek` → **Route**.

## Andere routes

| Route | Pad |
|---|---|
| Bewaren | Hartje op kaart of plekpagina → melding "Bewaard in Mijn reis – Bekijk" → teller op tabblad Mijn reis |
| Reis plannen | `Mijn reis` → volgorde slepen of "Slimste volgorde" → nachten per stop → startpunt → totale route en kosten → **Delen** (link met `?r=`) of **Open in navigatie** |
| Gedeelde reis openen | Link `?r=` → voorbeeld van de stops → **Toevoegen aan mijn reis**, **Mijn reis vervangen** (met aantal stops dat weggaat), **Bewaar deze reis** of **Niet bewaren** |
| Review schrijven | `Plek` → **Schrijf een review** → sheet met cijfer, deelscores, tekst, "Hoe laat moest je weg?" (optioneel), voertuig, maand van bezoek → ingelogd: **Review versturen**; niet ingelogd: e-mailadres → **Stuur mij een code** → code uit de mail → **Bevestigen en versturen** (de code logt je in), of **Liever inloggen met Google, Apple of Facebook** (`/inloggen?next=/plek/<slug>#review`, daarna gaat de sheet vanzelf weer open). Het concept staat per plek in de browser (`localStorage`, een week) en verdwijnt na versturen. Een vertrektijd gaat apart als inzending naar beheer → "We controleren je review" |
| Vertrektijd doorgeven | `Plek` van een onvolledige plek (geen vertrekregel) → **Vertrektijd doorgeven** → zelfde sheet als bij Doe mee ("Hoe laat moet je hier weg?", hoe weet je het, optioneel naam en e-mail) → **Versturen** → `submit_place` (soort `correctie`, onderwerp `vertrektijd`) → "Bedankt. We controleren het en zetten het daarna op de site." → Beheer → Inzendingen |
| Fout melden | `Plek` → **Klopt er iets niet? Meld het** (of **Weet jij de vertrektijd?**) → sheet met onderwerp, toelichting, optioneel eigenaar + contact → bevestiging. Bij onderwerp **Voorzieningen**: per voorziening **Ja**, **Nee** of **Weet ik niet** (begint bij wat we weten); alleen wat anders is gaat mee, toelichting is dan optioneel. Beheer neemt het over met **Voorzieningen overnemen** (Beheer → Inzendingen) |
| Voorziening doorgeven | `Plek` → Voorzieningen → **?** bij een onbekende voorziening → in de cel: **Ja**, **Nee** of **Weet ik niet** → "Bedankt, we controleren het" in de cel (inzending `voorzieningen` voor beheer; op de site verandert niets tot beheer het overneemt) |
| Eigenaar vult aan | `Plek` → **Ben je de eigenaar? Vul je gegevens aan** (onderaan bij "x van y gegevens bekend"; bij een onbekende vertrektijd ook in het vertrekblok als **Ben je de eigenaar? Vul de vertrektijd in**, en `Doe mee` verwijst eigenaren hiernaartoe) → sheet met wat we weten al ingevuld (vertrek, aankomst, reserveren, prijs, toeristenbelasting, extra kosten, open, plekken, lengte, telefoon, website) → naam en e-mail verplicht → **Gegevens versturen**: alleen de veranderde velden gaan als inzending `eigenaar` met oud en nieuw naar beheer. Niets veranderd en geen toelichting: melding, er gaat niets weg → bevestiging. Beheer zet het pas na controle op de site |
| Plek aanmelden | Header **+** of footer → `Plek aanmelden` → formulier → bevestiging |
| Contact en support | `Contact` → formulier → persoonlijke link `/support/<token>` → beheerder antwoordt → klant leest en reageert via de link |
| Terug | Terugknop op `Plek` gaat naar de vorige pagina binnen VrijStaan, of naar `/zoeken` als je van buiten kwam (Google, een gedeelde link) |
| Annuleren | Elke sheet sluit met ×, swipe omlaag of tik buiten de sheet; niets wordt opgeslagen |

## Per actie: trigger, controle, laden, succes, fout, volgende scherm

| Actie | Trigger | Controle | Laden | Succes | Fout | Volgende |
|---|---|---|---|---|---|---|
| Zoeken | Zoek-knop of Enter | Plaats, streek, eiland of provincie uit de eigen lijst (vergeeft typfouten en aliassen), anders adres, postcode, woonplaats of gemeente van PDOK | Kaarten als skelet; "Adres opzoeken…" als PDOK nog moet antwoorden | Resultaten met titel "n plekken in <plaats>" | "Geen plaats, adres of plek gevonden" onder het zoekveld | `Zoeken` |
| Filter toepassen | **Toon n plekken** in de sheet | Knop uit bij 0 resultaten, met voorstel welke filter weg kan | Live teller | Chips boven de lijst, filters in de URL | — | `Zoeken` |
| Lijst/kaart wisselen | **Kaart** / **Lijst** in de rij met Filters en Sorteren (telefoon en tablet) | — | "Kaart laden…" | Kaart met clusters; stipkleur = vertrekregel | "De kaart kon niet worden geladen" + **Toon lijst** | `Zoeken` |
| Plek op de kaart kiezen | Tik op een stip (Zoeken in kaartweergave, Dichtbij) | — | — | Telefoon: paneel onderaan de kaart met vertrek, prijs, **Route** en **Bekijk plek**, × sluit; groot scherm: popup (naam, plaats en prijs, vertrekregel, **Bekijk plek** en het hartje om te bewaren) en de kaart in de lijst licht op | — | Zelfde scherm, `Plek` of navigatie-app |
| Locatie gebruiken | **Gebruik mijn locatie** | Browsertoestemming | "Locatie bepalen…" | Lijst; rijtijden volgen | Geweigerd: uitleg + verwijzing naar zoeken; onbekend: "Probeer opnieuw" | `Dichtbij` |
| Afstand tonen | **Afstand tonen** boven de zoekresultaten (of stil als locatie al eerder is toegestaan) | Browsertoestemming | "Locatie bepalen…" | Op elke kaart "x km van je locatie" (hemelsbreed, berekend op het apparaat, niets naar de server) | Geweigerd: "Locatie staat uit, afstand onbekend" | `Zoeken` |
| Rijtijd berekenen | **Rijtijd berekenen** (onder de kaart bij Ligging en route) | Toestemming; locatie afgerond op ±1 km | "Bezig…" | "x min rijden, y km over de weg" | "Open de route in je navigatie-app" | `Plek` |
| Bewaren | Hartje | — | Hartje springt direct | Melding met **Bekijk** | Opslag niet beschikbaar: hartje blijft leeg | Zelfde scherm |
| Review versturen | **Review versturen** (of **Stuur mij een code** / **Bevestigen en versturen** zonder account) | Totaalcijfer verplicht, tekst 20–3.000 tekens, naam 2–60 tekens; ingelogd of code uit de mail (de database weigert anders); verborgen honeypotveld tegen spam | Knop "Versturen…" | "Bedankt, we controleren je review" | Foutmelding in de sheet | Zelfde scherm |
| Fout melden | **Versturen** in de sheet | Onderwerp en toelichting (min. 5 tekens) verplicht; e-mail geldig als ingevuld; honeypotveld | Knop uit | "Bedankt voor je melding" | Foutmelding in de sheet | Zelfde scherm |
| Melding (DSA) | **Melding versturen** | Reden, URL, toelichting, naam, e-mail, verklaring te goeder trouw | Knop uit | Bevestiging met persoonlijke link | Foutmelding | `/support/<token>` |
| Cookiekeuze | **Statistieken toestaan**, **Alleen noodzakelijk** of **Zelf instellen** | — | — | Banner weg, keuze opgeslagen en gelogd | — | Zelfde scherm |

## Zoekvak "waar"

Op Start en boven de zoekresultaten (`destination-search.tsx`, combobox met pijltjestoetsen, Enter en Escape).

- Leeg veld: **Dichtbij mijn locatie** en vier provincies.
- Tijdens typen, in deze volgorde: Dichtbij, provincies, streken en eilanden, woonplaatsen uit de eigen lijst
  (`nl_towns` plus plaatsen van plekken, alleen met plekken binnen 25 km), daarna na 250 ms stilte maximaal 6 adressen,
  postcodes, gemeenten en woonplaatsen van PDOK die er nog niet staan (met "n plekken binnen 25 km"), en plekken op naam.
- De browser vraagt PDOK nooit zelf: `/api/locatie?q=` (2 tot 80 tekens, alleen letters, cijfers en . , ' - /) gaat via
  onze server. Antwoordt PDOK niet binnen 4 s of met een fout, dan geeft de route woonplaatsen uit `nl_towns`
  (`bron: "lokaal"`) en toont het zoekvak alleen de eigen lijst. De site werkt dus ook als PDOK plat ligt.
- Kies je een adres, postcode, woonplaats of gemeente van PDOK: `waar` wordt de weergavenaam (bij een woonplaats of
  gemeente alleen de naam), `lat` en `lng` het middelpunt, straal blijft zoals hij was (standaard 25 km). Zonder
  coördinaat in de suggestie vraagt het zoekvak die op via `/api/locatie?id=`.
- Enter zonder keuze: de eerste suggestie uit de eigen lijst, anders de eerste van PDOK (zo nodig eerst opgevraagd),
  anders "Geen plaats, adres of plek gevonden".
- Statistieken (alleen met toestemming) krijgen bij een adres of postcode alleen de soort ("adres"), nooit het adres.

## Navigatieregels

- **Tabbalk** onderaan (mobiel): Start, Zoeken, Dichtbij, Mijn reis (met teller). Verborgen op `/plek/*`; daar staat een
  vaste actiebalk met prijs, hartje, bellen, website en **Route**.
- **Header**: logo naar Start, **+** naar Plek aanmelden, **? Hulp** naar Veelgestelde vragen (op desktop: Zoeken, Dichtbij, Mijn reis, Hulp en Plek aanmelden). Op `/plek/*` een terugknop.
- **Actief tabblad**: Zoeken is ook actief op de vertrekpagina's en alle landingspagina's (provincie, plaats, vertrekgroep per provincie).
- **Kruimelpad op de plekpagina**: Zoeken › provincie (naar `/camperplaatsen/<provincie>`) › plek; onder "In de buurt"
  links naar alle camperplaatsen in de provincie en, op een Waddeneiland, op dat eiland.
- **Footer**: over VrijStaan, juridisch, Cookie-instellingen, Meld inhoud.
- **Deep links `/zoeken`**: `waar`, `lat`, `lng`, `straal`, `provincie`, `v` (voorzieningen: stroom, water, lozen,
  toilet, douche, wifi, honden), `type`, `gratis`, `maxprijs`, `onbekend`, `lengte`, `vertrek` (`ruim`, `vroeg` of `onbekend`, alleen op `/overige-plekken`; de andere groepen zijn eigen pagina's, oude links met `vrij=1` gaan naar `/zonder-vertrektijd`),
  `open`, `score`, `sort`, `kaart=1`.
- Paginaovergangen met `<ViewTransition>`: de foto of tekening schuift mee van de lijst naar de plekpagina.

## Lege en geblokkeerde toestanden

| Toestand | Wat de gebruiker ziet |
|---|---|
| Geen resultaten | "Geen plekken met deze keuzes" + voorstellen met aantallen ("Zonder 'Stroom': 22 plekken", "Binnen 50 km") |
| Onbekende plaats in de URL | `waar` zonder `lat`/`lng` of provincie: kop "in Nederland" met de melding dat de plaats onbekend is (open punt 9) |
| Locatie geweigerd | Rode uitleg met hoe je het toestaat, en verwijzing naar zoeken op plaats |
| Offline | Bewaarde reis en eerder bekeken pagina's werken; in Mijn reis de melding "Geen verbinding. Je ziet de gegevens van je reis zoals ze de vorige keer zijn bewaard." |
| Rijtijden niet beschikbaar | Afstand hemelsbreed, met uitleg |
| Gegeven onbekend | "Onbekend" in grijs. Bij een afgewezen vertrekregel: "Weet jij de vertrektijd?" (meldformulier) |
| Onvolledige plek | Gepubliceerd, maar zonder vertrekregel (PRD, besluit 18 oktober 2026). Kaart: holle grijze stip (ring in token `muted`) onder de gekleurde plekken, popup of paneel "Vertrektijd onbekend". Lijst: grijs label "Vertrektijd onbekend". Plekpagina: oproep met knop **Vertrektijd doorgeven**. Plekken onder de drempel blijven verborgen |
| Mogelijk verouderd | Laatste controle = de jongste van `verified_at` (website leverde iets op) en `departure_checked_at` (beheer of eigenaar). Ouder dan 12 maanden: ", mogelijk verouderd" achter "Laatste update". Geen van beide: "Laatste update" toont `updated_at` en er komt geen melding (`last_scraped_at` en `updated_at` tellen niet: die veranderen ook als er niets is gecontroleerd) |
| Geen foto | Getekend landschap met "Nog geen foto van deze plek" (ook als alle foto's keurmerken, logo's van anderen of te klein zijn) |
| Geen bruikbare beschrijving | Het blok "Over deze plek" ontbreekt; we schrijven geen eigen tekst |
| Leeg Mijn reis | Uitleg en knop naar zoeken |
| Geen statistieken (beheer) | "Nog geen statistieken. Die verschijnen zodra bezoekers statistieken toestaan." |

## Eerste gebruik

- Geen account nodig. Eerste bezoek aan de startpagina: korte uitleg in drie schermen als sheet (README 87): "Welkom bij
  VrijStaan" (geen lappen tekst, alleen feiten), "Actueel, met jouw hulp" (meedoen met één tik) en "Sneller op je plek"
  (filteren op wat telt). Knoppen **Volgende**, **Terug**, **Overslaan**, op het laatste scherm **Aan de slag**; sluiten,
  Escape, omlaag vegen of op de achtergrond tikken telt ook als gezien. Daarna nooit meer (`vrijstaan:welkom` in de
  browser). Niet voor wie al een cookiekeuze had en niet op andere pagina's (wie via Google op een plek landt, ziet
  meteen de plek). Onder de sheet staat de cookiebanner (weigeren en toestaan even zwaar), daarna direct zoeken.
- Installeren als app: uitleg in de FAQ ("Hoe zet ik VrijStaan op mijn beginscherm?").
- **Beheerder:** `/admin` → **Nog geen account? Aanmaken** met het uitgenodigde e-mailadres → bevestigingsmail →
  inloggen → Overzicht.
