# Triage UI/UX-plan van ChatGPT (26 november 2026)

Bron: `plan.md` van ChatGPT (50 taken T1–T50), gemaakt met de prompt in `chatgpt-ux-prompt.md`. Per taak naast de
code, de stijlgids en de specs gelegd. Belangrijk: ChatGPT zag alleen screenshots. Veel regels onder "Nu" zijn
aannames ("kan concurreren", "kan verdwijnen") en geen waarnemingen; die heb ik in de code nagekeken.

Uitkomst: **12 bouwen**, **18 staat er al zo**, **9 botst met een besluit van jou**, **11 te vaag of geen ontwerpwerk**.

## A. Bouwen (past binnen de stijlgids, geen besluit nodig)

| Taak | Wat ik doe | Waarom het klopt |
|---|---|---|
| T37 | 404 gelijktrekken: `text-h1` in plaats van `text-4xl`, geen `rounded-2xl`/`shadow-lift`; tekening kleiner en rustig (8 px hoek, rand) of weg | Overtreedt nu stijlgids §2, §4, §6, §7 |
| T45 | Restanten `rounded-2xl`, `shadow-lift`, `shadow-low` en `text-xl`-koppen weg op Dichtbij-intro, Mijn camper, Account, Inloggen, Contact, Melden, Plek aanmelden (legends → `text-h2`), toasts (`rounded-xl` → `rounded-lg`) | Oude ronde, staat in stijlgids §6 als "gaat mee bij de volgende ronde" |
| T35 | Plek aanmelden: de drie groepen bestaan al; alleen de koppen naar `text-h2` en vaste ruimte tussen groepen | Kleine afwerking |
| T21 | Waarde in de cel Vertrekken één stap groter (`text-h2`), andere drie cellen blijven `text-h3` | Versterkt de kernbelofte, zonder nieuw blok |
| T22 | Cel Nu open: alleen tekst in `alert` als de plek dicht is, nooit een rood vlak | Controleren en zo nodig rechtzetten |
| T25 | Onbekende vertrektijd: oproeptekst inkorten tot twee regels, knop blijft | Minder lezen |
| T34 | Doe mee: de twee acties (vertrektijd doorgeven, plek aanmelden) bovenaan als korte lijst, dan de provinciekeuze | Nu staat de eigenaarsvraag eerst |
| T32 | Provinciepagina: inleiding maximaal drie zinnen, tabel direct na de knoppen | Brief zegt al "twee of drie zinnen"; nakijken |
| T40 | Footer korter op Plek, Zoeken en Mijn reis (alleen juridisch en contact) | Minder tweede navigatie |
| T44 | Losse maten (`mt-1.5`, `pt-7`, `pt-9` enz.) naar de 4 px-stappen uit stijlgids §5 op de vier kernschermen | Consistentie |
| T49 | Visuele snapshots (390 × 844 licht/donker, 1440 desktop) als e2e-test | Vangt afwijkingen in CI |
| T50 | Design-QA-lijst toevoegen aan stijlgids §12 | Bestaat grotendeels, aanvullen met "geen kaart in kaart" en "één primaire knop" |

## B. Staat er al zo (geen werk)

T4 (vertrekkeuzes direct onder het zoekveld), T6 (bestemmingen na de vertrekkeuzes), T7 (één blok met haarlijnen),
T10 (vertrekbadge bovenaan de rij), T11/T41 (geen voorzieningen in de rij sinds 30 oktober), T14 (één `Chip`, review
R49), T17 (stipkleuren en holle ring), T20 (volgorde plekpagina), T23 (Route is de enige primaire knop), T28
(voorzieningenraster met haarlijnen), T33 (tabel Plek / Vertrek / Per nacht), T36 (veld Website heeft een zichtbaar
label), T38 (zelfde componenten in licht en donker), T42, T43, T46, T47 (staan in stijlgids §3, §5 en de a11y-test).

## C. Botst met een eerder besluit (jij beslist)

| Taak | Voorstel ChatGPT | Huidig besluit | Mijn advies |
|---|---|---|---|
| T2 | Ondertitel wordt "Zoek een camperplaats voor vannacht. Zie meteen wanneer je moet vertrekken." | Ondertitel met echte cijfers: "2.373 camperplaatsen … Bij 1.684 weten we hoe laat je weg moet." | **Houden.** Echte cijfers zijn sterker en eerlijker dan een slogan |
| T3 | Zoeken wordt de primaire actie, Dichtbij secundair | Avondzon-knop Dichtbij is de hoofdactie (brief, "de vannacht-vraag") | **Houden.** ChatGPT spreekt zichzelf hier tegen |
| T9 | Foto in de rij 84 × 63 px | 96 px (`sm` 144 px), redesign 30 oktober | **Houden**; kleiner maakt de foto nutteloos |
| T13 | Snelle chips: Geen vaste vertrektijd, 12:00 of later, Nu open, Voorzieningen | Dichtbij, Zonder vertrektijd, Gratis, 8+, Stroom, Lozen | Twijfel; "Nu open" is wel een goed idee. Pas na gebruiksdata |
| T19 | Uitleg "plekken zonder opgegeven vaste vertrektijd" | Huidige uitleg | **Niet doen**: die zin suggereert dat de tijd onbekend is, en dat is precies wat deze lijst niet is |
| T26 | Prijs als "€ X per nacht" | Totaal voor 2 personen met toeslagen (R22) | **Houden** |
| T27 | "Mogelijk verouderd" in `alert` met icoon | `ink-2` halfvet | **Houden**; rood is voor fouten en dicht |
| T29 | Fotobron buiten de foto | "Foto: domein.nl" in de hoek (besluit eigenaar) | **Houden** |
| T39 | Hoogstens twee iconen in de kop | Plek aanmelden, Hulp, licht/donker, Inloggen | Mogelijk: Hulp en licht/donker naar het menu. Jouw keuze |

## D. Te vaag of geen ontwerpwerk

T1, T5, T8, T12, T15, T16, T24, T30, T31, T48 geven een richting zonder waarneming ("Nu: kan …"), of beschrijven wat
er al is. T18 (rijtijd eerst op Dichtbij) en T30/T31 (Mijn reis "volgende stop eerst") zijn inhoudelijk interessant,
maar vragen eerst een screenshot en een eigen ontwerpronde. De kaart en de filtersheet heeft ChatGPT niet gezien.

## Logo (hoofdstuk 3 van het plan)

Concept blijft. Het advies voor een kleine variant (≤ 32 px) bestaat al sinds 2 november (stijlgids §10). De
woordmerkmaten (14–15 px) zijn kleiner dan nu (18–20 px) en zouden de kop zwakker maken; niet overnemen.
