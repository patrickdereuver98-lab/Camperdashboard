# VrijStaan: plan UX-audit "volwassen maken" (27 november 2026)

Bron: opdracht *VrijStaan — volledige UX-, UI-, informatiearchitectuur- en workflow-audit* (74 punten), gelegd naast
de code op `main` (8422374), de specs, de stijlgids en de besluiten in `docs/specs/README.md` (vooral 142 en 144 van
26 november). Het vorige plan (23 oktober) staat in [`docs/archief/plan-2026-10-23.md`](docs/archief/plan-2026-10-23.md).

Status: ✅ klaar · 🔄 bezig · ⬜ open · ❓ wacht op besluit Patrick.

---

## 1. Kern van de analyse

**Ongeveer twee derde van de opdracht staat er al.** De ronden van 26 november (UI/UX-plan T1–T50, README 142;
plekpagina-ronde, README 144; design-audit #200; ontwerpronde 2 C2–C4) hebben veel van wat de opdracht vraagt al
gebouwd: geen "Klopt dit niet?" per vak, één help-blok onderaan, compacte footer op taakpagina's, snelle chips,
resultaatrijen met vertrek eerst, Dichtbij met rijtijd eerst, Mijn reis met Volgende stop bovenaan en de reisopties
in een menu. Die bouwen we niet opnieuw (opdracht §1.1).

Wat overblijft is kleiner maar wel de kern van de opdracht: **de plekpagina heeft nog te veel even zware dingen**.
Op screenshots (390 × 844 en 1440 × 900, offline build, 27 november) valt op:

| # | Waarneming | Waar | Opdracht |
|---|---|---|---|
| W1 | **Desktop: het beslisblok staat onder de vouw.** De foto is 1104 × 470 px; op 1440 × 900 zie je naam en "Nog geen reviews", maar niet de vertrektijd. Acceptatiecriterium §58 ("vertrektijd het belangrijkste gegeven in de eerste viewport") faalt op desktop | `Gallery`, `page.tsx` | §5.2, §40, §58 |
| W2 | Beslisblok is een 2×2-raster van vier even grote cellen. Vertrekken is gekleurd, maar Prijs staat ernaast met dezelfde grootte; Nu open en Aankomen wegen even zwaar. Reserveren staat pas onderaan Goed om te weten | `decision-grid.tsx` | §5.3–5.5 |
| W3 | Telefoon: direct onder het beslisblok vier gelijke tegels (Bewaar, Delen, Website, Bellen), daaronder de vaste balk met Route. Vijf acties binnen één duimhoogte | `ActionRow` | §8 |
| W4 | Desktop: in de zijkolom is **Reserveren via de website** een gevulde bosgroene knop; Route staat lager onder de kaart. Twee primaire knoppen, en de verkeerde wint | `PriceCard`, `RouteCard` | §5.6, §8 |
| W5 | Kop op de plekpagina (telefoon): terug, logo, +, ⋯, account. Op desktop daarbij Hulp, Plek aanmelden, thema | `chrome.tsx` | §5.1, §30 |
| W6 | Bovenaan "Nog geen reviews" op **elke** plek (live: 0 reviews). Dat is het eerste wat je leest na de naam, en het zegt niets over de beslissing | kop `page.tsx` | §13 |
| W7 | "Check voor vertrek" in Ervaringen herhaalt vertrek, prijs en reserveren uit het beslisblok | `CheckVoorVertrek` | §9 (geen dubbelingen) |
| W8 | Help-blok onderaan: "7 van 12 gegevens bekend. Nog onbekend: vertrektijd, openingsperiode, …", dan tot zes acties (Vertrektijd doorgeven, Eigenaar? Vul de tijden in, Wijziging doorgeven, Foto toevoegen, eigenaarsroute, Hoe druk is het nu) | `HelpBlock` | §6, §7, §34 |
| W9 | "Mogelijk verouderd" in rood met waarschuwingsicoon | `OutdatedNote` | §12 |
| W10 | Volgorde: Ervaringen vóór Over deze plek; Ligging zit op de telefoon tussen Voorzieningen en Ervaringen (goed) | `page.tsx` | §10 |
| W11 | Correctieformulier is één `select` "Wat klopt er niet?" met 8 onderwerpen; Reserveren, Aankomst en Foto ontbreken als keuze | `ReportProblem` | §6 |
| W12 | Teksten verwijzen nog naar de knop "Klopt er iets niet?", die niet meer bestaat (voorwaarden, melden, disclaimer); standaardlabel van `ReportProblem` is nog "Klopt er iets niet? Meld het"; review-sheet zegt "Bedankt!" | diverse | §32, §33 |
| W13 | Cookiebalk + vaste Route-balk samen ±170 px over de inhoud bij het eerste bezoek | `cookie-banner.tsx` | §9, §58 |
| W14 | "1 van 300"-balk staat op desktop als volle breedte kaart boven de foto | `ResultsNav` | §50 |

Daarbuiten (Zoeken, Dichtbij, Mijn reis, start, footer) vond ik vooral kleine punten; zie §4.

## 2. Matrix behouden / versimpelen / herstructureren / herbouwen (opdracht §1.1, §68 fase A)

| Onderdeel | Oordeel | Toelichting |
|---|---|---|
| Huisstijl, tokens, Geist, kleuren, kaartstijl | **Niet aanraken** | Staat vast (brief, stijlgids, besluit 75) |
| Startpagina (kop, avondzonknop, zoekveld, "Hoe wil je staan?") | **Behouden** | Propositie is precies wat §22 vraagt; #200 maakte hem al rustiger |
| Zoeken: rij, chips, filtersheet, sessionStorage | **Behouden** | §14, §15, §45 staan er (T13, C4, G-audit) |
| Kaart: stippen, gekozen-plekpaneel, Zoek in dit gebied | **Behouden**, C5 afmaken | Paneel heeft Route + Bekijk plek (§18) |
| Dichtbij | **Versimpelen** (klein) | Rijtijd eerst staat er (C3); nul-resultaten en locatie geweigerd nalopen (§17, §47) |
| Mijn reis | **Behouden** | Volgende stop bovenaan, opties in menu (C2). Alleen QA op ontbrekende data (§21) |
| Plekpagina: kop en foto | **Herstructureren** | W1, W5, W6, W14 |
| Plekpagina: beslisblok | **Herbouwen** (één component) | W2 |
| Plekpagina: acties en vaste balk | **Herstructureren** | W3, W4, W13 |
| Plekpagina: Goed om te weten, Praktisch | **Versimpelen** | Reserveren naar boven, rest blijft |
| Plekpagina: Ervaringen | **Versimpelen** | W6, W7 |
| Plekpagina: help-blok + formulier | **Herstructureren** | W8, W11 |
| Footer | **Behouden** | Compact op taakpagina's staat er al |
| Kop (globaal) | **Versimpelen** op plekpagina | W5 |
| Formulieren (aanmelden, doe mee) | **Nalopen** | §25, §26; eerst kijken wat er staat |
| SEO-pagina's provincie/plaats | **Nalopen** | §24, na P1 |

## 3. Routes: gebruikersdoel en risico (opdracht fase B)

| Route | Doel | Eerste vraag | Primaire actie | Grootste risico nu |
|---|---|---|---|---|
| `/` | plek vinden | waar wil ik staan? | Plekken bij mij in de buurt / zoeken | onboarding-sheet dekt de start af bij eerste bezoek (bestaand besluit 87) |
| `/zoeken` | vergelijken | welke plek past? | plek openen | weinig; QA |
| `/zonder-vertrektijd`, `/uitslapers`, `/overige-plekken` | vergelijken binnen groep | idem | plek openen | idem |
| `/dichtbij` | nabij kiezen | wat haal ik nog? | plek selecteren | nul-resultaten met te veel uitwegen |
| `/plek/[slug]` | beslissen | kan ik hier staan, hoe laat weg? | Route | **te veel even zware blokken en acties** |
| `/mijn-reis` | reis plannen | volgende stop? | Route | weinig; QA bij onbekende data |
| `/camperplaatsen/*` | oriënteren (SEO) | wat is er in deze streek? | plek openen | database-gevoel (§24) |
| `/doe-mee`, `/plek-aanmelden`, `/melden` | bijdragen | hoe help ik? | formulier | lange formulieren (§26) |
| `/account`, `/inloggen` | ondersteunend | – | inloggen | geen accountdruk (staat goed) |
| 404 / fout | herstellen | waar nu heen? | Terug naar Zoeken | QA |

## 4. Fasen en taken

Werkwijze per fase: bouwen → `npm run check` → e2e die het raakt → screenshots 390 licht/donker en 1440 → specs en
stijlgids in dezelfde commit bijwerken. Per fase hoogstens één review met `code-reviewer`.

### Fase A: audit ✅ (deze sessie)
- ✅ Docs, routes, componenten, smells gelezen; offline build en screenshots (zie §1).
- ✅ Matrix (§2) en routetabel (§3).

### Fase D: plekpagina (P1) — ⬜ besloten 27 november, klaar om te bouwen

| # | Taak | Hangt af van | Moeite |
|---|---|---|---|
| D1 | **Beslisblok herbouwen** als `PlaceDecisionSummary`: rij 1 Vertrek over de volle breedte en groter (met steunzin: "Je kunt vertrekken wanneer het jou uitkomt" / "Je verblijf loopt per 24 uur" / "We weten nog niet hoe laat je hier moet vertrekken"); rij 2 Prijs (bedrag groot, "per nacht" of "+ toeslagen" eronder); daarna drie compacte regels Aankomst · Open · Reserveren, onbekend als "Onbekend" | V1 | M |
| D2 | Link in de vertrekcel bij onbekend: "Weet jij het?" → **Vertrektijd doorgeven**, opent het formulier meteen op Vertrektijd (§49) | – | S |
| D3 | **Acties**: telefoon zonder tegelrij; Bewaren als hartje op de foto, Delen als icoon naast de naam; Website en Bellen als secundaire regels bij Reserveren en Contact. Vaste balk blijft: prijs klein + **Route** | V2 | M |
| D4 | Desktop: Route wordt de primaire knop bovenaan de zijkolom; "Website openen" secundair met rand | – | S |
| D5 | **Desktop-hero**: foto lager (max ±340 px of 21:9 naast/boven een smallere kolom), zodat naam én vertrektijd in 1440 × 900 staan; "1 van 300" als dunne tekstregel, geen kaart | V5 | M |
| D6 | Kop op de plekpagina: terug, naam van de plek (verschijnt bij scrollen), Bewaren, ⋯ (Delen, Plek aanmelden, Hulp, Donker, Inloggen) | V3 | M |
| D7 | "Nog geen reviews" weg uit de kop; score alleen tonen als er reviews zijn, klein | – | S |
| D8 | Volgorde: beslisblok → Aankomst en reserveren / Prijs en voorwaarden (Goed om te weten, reserveren eerst) → Voorzieningen → Ligging → Over deze plek → Ervaringen → Contact → In de buurt → Gegevens bijwerken | – | S |
| D9 | "Check voor vertrek" uit Ervaringen halen (dubbel met het beslisblok); alleen Google-cijfer en reviews | V6 | S |
| D10 | **Help-blok → "Klopt er iets niet?"**: één zin + knop **Gegevens corrigeren of aanvullen**; daaronder klein "Foto toevoegen". Apart blok **Eigenaar van deze plek?** met **Gegevens aanpassen**. Teller "x van 12 bekend" en de lijst onbekende velden weg | V4 | M |
| D11 | Correctieformulier: eerste stap **Wat wil je aanpassen?** als radiolijst (Vertrektijd, Prijs, Aankomst, Reserveren, Voorzieningen, Contactgegevens, Locatie, Foto, De plek bestaat niet meer, Anders), daarna alleen de velden van die keuze. Zelfde RPC `submit_place`, geen migratie | – | M |
| D12 | "Mogelijk verouderd" volgens V5-keuze | V5 | S |
| D13 | Cookiebalk op de plekpagina boven de vaste balk laten aansluiten, niet erover; of op taakpagina's pas na de eerste scroll | – | S |
| D14 | Drukte ("Hoe druk is het nu?") alleen tonen als er een melding is (staat al zo boven), doorgeven via het formulier of in het Eigenaar/Help-blok | V4 | S |
| D15 | Tests: onbekende vertrektijd, oude data, prijs onbekend, reserveren onbekend, centrale correctieflow, vaste Route, desktop-vouw (vertrektijd in viewport) | – | M |

### Fase E: Zoeken, kaart, Dichtbij (P1, klein)
- ⬜ E1 Dichtbij nul resultaten: hoogstens twee uitwegen (§17); nu kan `nearbySuggestions` er meer geven.
- ⬜ E2 Dichtbij locatie geweigerd: één zin + zoekveld "Zoek op een plaats of streek" (§47) nalopen.
- ⬜ E3 Kaartpaneel en popup gelijk aan §18 (foto, naam, vertrek, prijs, rijtijd, Route, Bekijk plek); C5 afronden.
- ⬜ E4 Lijst ↔ kaartselectie en terugkeer met filters/scroll in een e2e-test vastleggen (§45, §59).

### Fase F: Mijn reis (P1, alleen QA)
- ⬜ F1 Onbekende vertrektijd/rijtijd: gewone status, uitleg alleen als de berekening er last van heeft (§21).
- ⬜ F2 e2e: volgende stop staat bovenaan; route-instellingen niet boven de stops (§61).

### Fase G: globaal (P1 #9–10, P2)
- ⬜ G1 **Microcopy**: vaste termen (Bewaren, Route openen of Route, Website openen, Bellen, Delen, Gegevens corrigeren
  of aanvullen, Vertrektijd onbekend, Onbekend, Laatste update) en alle verwijzingen naar "Klopt er iets niet?" in
  voorwaarden, melden, disclaimer en FAQ; "Bedankt!" zonder uitroepteken.
- ⬜ G2 Doe mee: twee doelen (plek verbeteren, plek aanmelden), eigenaren onderaan (§25).
- ⬜ G3 Plek aanmelden in drie stappen (§26), server-side validatie blijft.
- ⬜ G4 Empty/loading/error per datacomponent: skeleton zoals de echte lijst (§44).
- ⬜ G5 Provincie/plaatspagina's als reisgids-volgorde (§24).
- ⬜ G6 Technische cleanup (§55): 13× `shadow-`, 9× `text-[…]`, 2× `rounded-2xl`, 32 inline styles en 77 hexwaarden
  (meeste in kaart, iconen, OG-beelden: terecht) langslopen tegen de stijlgids.

### Fase H en I: QA en oplevering
- ⬜ H1 a11y-e2e (axe) op alle gewijzigde schermen, focus in sheets, 44 px, reduced motion.
- ⬜ H2 Screenshots 375/390/430 licht+donker, 1440 licht (+donker voor de plekpagina); randgevallen §63.
- ⬜ I1 `docs/review/UX-AUDIT-REPORT.md`, `docs/review/DESIGN-DECISIONS.md`, `docs/review/SCREENSHOT-QA.md`
  (in `docs/review/` in plaats van de root, zoals de eerdere reviews).
- ⬜ I2 Specs bijwerken: `04-ui-ux-brief.md` (rij Plek, Laatste update, Navigatie), `03-app-flow.md`, stijlgids
  (informatiedichtheidsrichtlijn §39), implementatieplan, README (nieuw besluit 145).

### Bewust niet doen
- Geen nieuwe kleuren, radius of iconenset (§1.2). Geen visuele snapshottests in CI (bestaand besluit, data wisselt).
- Tabnamen Start/Zoeken/Dichtbij/Mijn reis blijven (§29: niet veranderen zonder reden; geen gebruiksdata).
- Footer, snelle chips, filtersheet, Mijn reis-opbouw: staan er al.
- Geen migraties of edge functions: alles is presentatie.

## 5. Botsingen met eerdere besluiten (CLAUDE.md: melden vóór bouwen)

| Opdracht zegt | Besluit nu | Vraag |
|---|---|---|
| §12: "mogelijk verouderd" niet in rood, liever amber | README 142 / T27 (26 november): alles overnemen, dus `alert` met icoon. Avondzon is volgens de stijlgids alleen voor de gekozen plek en de startknop | V5 |
| §5.3–5.5: vertrek groot boven, prijs eronder, aankomst/open/reserveren compact | Beslisblok 2×2 (redesign 30 oktober, README 144) | V1 |
| §8: website/bellen niet als even zware tegels | Actierij met vier tegels (18 november, brief rij Navigatie) | V2 |
| §5.1, §30: geen +, Hulp, thema, account in de kop van de plekpagina | T39 (26 november): op de telefoon +, Meer en Inloggen | V3 |
| §6, §7: één correctieknop + apart eigenaarsblok, geen "x van 12 bekend" | README 144: help-blok met teller en meerdere acties | V4 |
| §13 / §9: geen dubbele beslisinfo | "Check voor vertrek" (README 141, opdracht Patrick 21 november) | V6 |
| §69: rapporten in de root | Reviews staan in `docs/review/` | geen vraag, `docs/review/` |

### Besluiten Patrick (27 november 2026)

| Vraag | Besluit |
|---|---|
| V1 Beslisblok | Nieuwe opbouw: vertrek groot over de volle breedte, prijs eronder, Aankomst · Open · Reserveren als drie compacte regels |
| V2 Acties telefoon | Alleen Route prominent; tegelrij weg, Bewaren als hartje op de foto, Delen als icoon bij de naam, Website/Bellen als regels bij Reserveren en Contact |
| V3 Kop plekpagina | Terug, Bewaren, ⋯ (Delen, Plek aanmelden, Hulp, Donker, Inloggen); naam van de plek verschijnt bij scrollen |
| V4 Bijdragen | Eén knop **Gegevens corrigeren of aanvullen** + blok **Eigenaar van deze plek?**; teller weg; Foto toevoegen als kleine link; oproep Vertrektijd doorgeven blijft bij onbekende vertrektijd |
| V5 Mogelijk verouderd | `ink-2` halfvet met icoon, geen rood en geen avondzon |
| V5b Desktopfoto | Lager, ongeveer 320 px, zodat naam en vertrektijd in 1440 × 900 staan |
| V6 Check voor vertrek | Weghalen; Ervaringen houdt Google-cijfer en reviews |

## 6. Planning (vóór de bevriezing van 19 december)

| Week | Werk |
|---|---|
| 27 nov – 3 dec | Antwoorden V1–V6, fase D (plekpagina) bouwen en testen |
| 4 – 10 dec | Fase E en F, G1 microcopy |
| 11 – 18 dec | G2–G6 voor zover tijd, fase H en I, samenvoegen |

P2-punten die niet af zijn op 18 december gaan naar na de livegang; P1 (fase D, E, F, G1) gaat voor.
