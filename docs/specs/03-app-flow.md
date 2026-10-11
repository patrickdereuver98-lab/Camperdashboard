# 3. App Flow

> Doel: elk scherm, elk pad en het gevolg van elke tik vastleggen.
> Bijgewerkt: 11 oktober 2026. Routes verwijzen naar `web/src/app/`.

## Ingangen

- Zoekmachine of gedeelde link naar een plek: `/plek/<slug>`
- Startpagina `/` (direct of vanaf het beginscherm als geïnstalleerde PWA)
- Provinciepagina's `/camperplaatsen/<provincie>` (SEO)
- Gedeelde zoekopdracht: `/zoeken?...` (alle filters staan in de URL)
- Gedeelde reis: `/mijn-reis?r=<code>`
- Supportlink uit een mail: `/support/<token>`
- Beheer: `/admin` (alleen beheerders)

## Schermoverzicht

| Scherm | Route | Doel | Benodigde data |
|---|---|---|---|
| Start | `/` | Zoeken starten, snelle ingangen ("Geen vaste vertrektijd", "Nu open", stroom, lozen, honden), uitgelichte plekken, provincies | Statistieken, uitgelichte samenvattingen |
| Zoeken | `/zoeken` | Lijst of kaart met filters en sortering | Alle samenvattingen (`/api/places`), woonplaatsen (`/api/towns`) |
| Filterscherm | sheet op `/zoeken` | Vertrekken, voorzieningen, prijs, soort, lengte, overig, met live teller | Samenvattingen |
| Plek | `/plek/<slug>` | Beslissen: vertrek, open, prijs en extra kosten, voorzieningen, contact, route, reviews | Volledige plek, reviews, plekken in de buurt |
| Dichtbij | `/dichtbij` | Plekken rond je locatie op rijtijd | Locatie (toestemming), samenvattingen, `/api/distances` |
| Mijn reis | `/mijn-reis` | Bewaarde plekken, volgorde, nachten, kosten, route, delen | `localStorage`, samenvattingen, `/api/route` |
| Plek aanmelden | `/plek-aanmelden` | Nieuwe plek of eigenaarsclaim indienen | Formulier → `submit_place` |
| Contact | `/contact` | Vraag stellen, ticket maken | Formulier → `create_ticket` |
| Ticket | `/support/<token>` | Antwoord lezen en reageren | `get_ticket`, `reply_ticket` |
| Meld inhoud | `/melden` | DSA-melding van illegale of onjuiste inhoud | Formulier → `create_ticket` |
| Veelgestelde vragen | `/veelgestelde-vragen` | Antwoorden zoeken | `faq` |
| Over ons, Reviews en ranking, Privacy, Cookies, Voorwaarden, Disclaimer, Toegankelijkheid | eigen routes | Uitleg en juridische informatie | `src/lib/company.ts`, statistieken |
| Niet gevonden | elke onbekende route | "Verkeerd afgeslagen" met terugweg | — |
| Beheer | `/admin/*` | Overzicht, Statistieken, Plekken, Support, Inzendingen, Reviews, FAQ, Logs, Instellingen | Beheer-RPC's, RLS |

## Hoofdroute: vannacht een plek vinden

`Start` → typ plaats of streek (suggesties tijdens typen) → **Zoek** → `Zoeken` (lijst, gesorteerd op Aanbevolen) →
tik **Filters** → zet **Geen vaste vertrektijd** aan → **Toon n plekken** → tik een plek → `Plek` (beslispaneel) →
**Route** (opent navigatie) of **Bellen** → **succes:** camperaar rijdt naar de plek.

Snelle variant: `Start` → **Plekken dichtbij** → `Dichtbij` (locatie toestaan) → lijst op rijtijd → `Plek` → **Route**.

## Andere routes

| Route | Pad |
|---|---|
| Bewaren | Hartje op kaart of plekpagina → melding "Bewaard in Mijn reis – Bekijk" → teller op tabblad Mijn reis |
| Reis plannen | `Mijn reis` → volgorde slepen of "Slimste volgorde" → nachten per stop → startpunt → totale route en kosten → **Delen** (link met `?r=`) of **Open in navigatie** |
| Gedeelde reis openen | Link `?r=` → voorbeeld van de stops → **Toevoegen aan mijn reis**, **Mijn reis vervangen** (met aantal stops dat weggaat), **Bewaar deze reis** of **Niet bewaren** |
| Review schrijven | `Plek` → **Schrijf een review** → sheet met cijfer, deelscores, tekst, voertuig, maand van bezoek → **Review versturen** → "We controleren je review" |
| Fout melden | `Plek` → **Klopt er iets niet? Meld het** (of **Weet jij de vertrektijd?**) → sheet met onderwerp, toelichting, optioneel eigenaar + contact → bevestiging |
| Plek aanmelden | Header **+** of footer → `Plek aanmelden` → formulier → bevestiging |
| Contact en support | `Contact` → formulier → persoonlijke link `/support/<token>` → beheerder antwoordt → klant leest en reageert via de link |
| Terug | Terugknop op `Plek` gaat naar de vorige pagina, of naar `/zoeken` als er geen geschiedenis is |
| Annuleren | Elke sheet sluit met ×, swipe omlaag of tik buiten de sheet; niets wordt opgeslagen |

## Per actie: trigger, controle, laden, succes, fout, volgende scherm

| Actie | Trigger | Controle | Laden | Succes | Fout | Volgende |
|---|---|---|---|---|---|---|
| Zoeken | Zoek-knop of Enter | Plaats, streek, eiland of provincie gevonden (vergeeft typfouten en aliassen) | Kaarten als skelet | Resultaten met titel "n plekken in <plaats>" | "Geen plaats, streek of plek gevonden" onder het zoekveld | `Zoeken` |
| Filter toepassen | **Toon n plekken** in de sheet | Knop uit bij 0 resultaten, met voorstel welke filter weg kan | Live teller | Chips boven de lijst, filters in de URL | — | `Zoeken` |
| Lijst/kaart wisselen | Zwevende knop **Toon kaart/lijst** | — | "Kaart laden…" | Kaart met clusters | "De kaart kon niet worden geladen" + **Toon lijst** | `Zoeken` |
| Locatie gebruiken | **Gebruik mijn locatie** | Browsertoestemming | "Locatie bepalen…" | Lijst; rijtijden volgen | Geweigerd: uitleg + verwijzing naar zoeken; onbekend: "Probeer opnieuw" | `Dichtbij` |
| Rijtijd berekenen | **Bereken vanaf mijn locatie** | Toestemming; locatie afgerond op ±1 km | "Bezig…" | "x min rijden, y km over de weg" | "Open de route in je navigatie-app" | `Plek` |
| Bewaren | Hartje | — | Hartje springt direct | Melding met **Bekijk** | Opslag niet beschikbaar: hartje blijft leeg | Zelfde scherm |
| Review versturen | **Review versturen** | Totaalcijfer verplicht, tekst 20–3.000 tekens, naam 2–60 tekens; verborgen honeypotveld tegen spam | Knop "Versturen…" | "Bedankt, we controleren je review" | Foutmelding in de sheet | Zelfde scherm |
| Fout melden | **Versturen** in de sheet | Onderwerp en toelichting (min. 5 tekens) verplicht; e-mail geldig als ingevuld; honeypotveld | Knop uit | "Bedankt voor je melding" | Foutmelding in de sheet | Zelfde scherm |
| Melding (DSA) | **Melding versturen** | Reden, URL, toelichting, naam, e-mail, verklaring te goeder trouw | Knop uit | Bevestiging met persoonlijke link | Foutmelding | `/support/<token>` |
| Cookiekeuze | **Statistieken toestaan**, **Alleen noodzakelijk** of **Zelf instellen** | — | — | Banner weg, keuze opgeslagen en gelogd | — | Zelfde scherm |

## Navigatieregels

- **Tabbalk** onderaan (mobiel): Start, Zoeken, Dichtbij, Mijn reis (met teller). Verborgen op `/plek/*`; daar staat een
  vaste actiebalk met prijs, hartje, bellen, website en **Route**.
- **Header**: logo naar Start, **+** naar Plek aanmelden, **?** naar Veelgestelde vragen. Op `/plek/*` een terugknop.
- **Footer**: over VrijStaan, juridisch, Cookie-instellingen, Meld inhoud.
- **Deep links `/zoeken`**: `waar`, `lat`, `lng`, `straal`, `provincie`, `v` (voorzieningen: stroom, water, lozen,
  toilet, douche, wifi, honden), `type`, `gratis`, `maxprijs`, `onbekend`, `lengte`, `vrij` (geen vaste vertrektijd),
  `open`, `score`, `sort`, `kaart=1`.
- Paginaovergangen met `<ViewTransition>`: de foto of tekening schuift mee van de lijst naar de plekpagina.

## Lege en geblokkeerde toestanden

| Toestand | Wat de gebruiker ziet |
|---|---|
| Geen resultaten | "Geen plekken met deze keuzes" + voorstellen met aantallen ("Zonder 'Stroom': 22 plekken", "Binnen 50 km") |
| Onbekende plaats in de URL | Hoort "niet gevonden" te tonen; nu nog "680 plekken in xyzqqq" (bekende fout, fase B) |
| Locatie geweigerd | Rode uitleg met hoe je het toestaat, en verwijzing naar zoeken op plaats |
| Offline | Bewaarde reis en eerder bekeken pagina's werken; in Mijn reis de melding "Geen verbinding. Je ziet de gegevens van je reis zoals ze de vorige keer zijn bewaard." |
| Rijtijden niet beschikbaar | Afstand hemelsbreed, met uitleg |
| Gegeven onbekend | "Onbekend" in grijs, of bij vertrektijd: "Weet jij de vertrektijd? Laat het weten" |
| Geen foto | Getekend landschap met "Nog geen foto van deze plek" |
| Leeg Mijn reis | Uitleg en knop naar zoeken |
| Geen statistieken (beheer) | "Nog geen statistieken. Die verschijnen zodra bezoekers statistieken toestaan." |

## Eerste gebruik

- Geen onboarding en geen account. Eerste bezoek: cookiebanner (weigeren en toestaan even zwaar), daarna direct zoeken.
- Installeren als app: uitleg in de FAQ ("Hoe zet ik VrijStaan op mijn beginscherm?").
- **Beheerder:** `/admin` → **Nog geen account? Aanmaken** met het uitgenodigde e-mailadres → bevestigingsmail →
  inloggen → Overzicht.
