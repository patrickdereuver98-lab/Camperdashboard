# Volgende stappen tot de livegang (26 november 2026)

> Na het samenvoegen van het UI/UX-plan en de nieuwe logoset (#193). Bronnen: [LANCERING](LANCERING.md),
> [implementatieplan](specs/06-implementatieplan.md), triage van het UI/UX-plan
> ([`review/ux-plan-chatgpt-2026-11-triage.md`](review/ux-plan-chatgpt-2026-11-triage.md)).

## Waar we staan

- **Livegang 1 januari 2027**, bevriezing vanaf **19 december** (LANCERING 3.1: daarna alleen fixes). Er zijn dus nog
  ruim drie weken voor nieuw werk.
- **Site niet bereikbaar:** `vrijstaan.nl` toont een foutpagina van JouwWeb (403) en de Vercel-site zit achter een
  login. Zolang dat zo is, kan niemand hem gebruiken: geen bezoekers, geen Search Console, geen mail aan eigenaren en
  geen meting op productie.
- **Kernbelofte:** 2.373 plekken, bij 1.684 is de vertrekregel bekend (71%; doel 90%). 29 plekken zonder vaste
  vertrektijd.
- **Ontwerp:** basis staat en is consistent (stijlgids, design-QA, e2e groen). Open: Mijn reis, Dichtbij, kaart en
  filtersheet zijn nog niet als geheel beoordeeld.

## Spoor A: wat alleen jij kunt doen (blokkeert de livegang)

| # | Wat | Waarom nu | Tijd |
|---|---|---|---|
| A1 | **Domein `vrijstaan.nl` naar Vercel** (DNS bij je registrar, weg bij JouwWeb) en `NEXT_PUBLIC_SITE_URL` zetten | Alles hieronder hangt eraan | 30 min |
| A2 | **Vercel Authentication uit** voor Production | Nu ziet niemand de site, ook de webhooks niet | 5 min |
| A3 | **Back-up:** geheimen `SUPABASE_DB_URL` en `BACKUP_PASSPHRASE` in GitHub, workflow starten | Er is nog nooit een back-up gemaakt | 15 min |
| A4 | **Naam en contactadres** (of postbus) voor `lib/company.ts` | Lanceervoorwaarde 1 (juridisch) | 5 min |
| A5 | **Eigen SMTP** kiezen (EU, met SPF/DKIM), plus Resend-domein en OAuth-sleutels | Inloggen, reviews en mail aan eigenaren lopen anders vast | 1 uur |
| A6 | **Besluit 90%-eis:** eis per soort plek, grijze plekken verbergen bij livegang, of eigenaren mailen (staat klaar, wacht op A1 en A5) | Bepaalt of lanceervoorwaarde 2 haalbaar is | besluit |

Advies: A1 tot en met A4 deze week, A5 en A6 vóór 6 december.

## Spoor B: kernbelofte en data (agent, met jouw besluit A6)

1. **Vertrekregel van 71% naar 90%:** de stealth-lezer en zoekagenten eerst op de 689 plekken zonder vertrekregel,
   gesorteerd op hoeveel mensen ze bekijken. Wekelijks de teller in LANCERING bijwerken.
2. **Mail aan eigenaren** aanzetten zodra A1 en A5 klaar zijn (code staat klaar, verzenden staat uit).
3. **Steekproef van 30 plekken** (LANCERING D.1) half december: vertrekregel ≥ 90% juist, Zonder vertrektijd 100%.

## Spoor C: ontwerp ronde 2 (agent, vóór 19 december)

Volgorde op wat de camperaar onderweg het meest raakt. Elk punt start met screenshots en een kort voorstel dat jij
goedkeurt, daarna bouwen.

| # | Wat | Waarom | Moeite |
|---|---|---|---|
| C1 ✅ | **Screenshots van kaart en Dichtbij werkend krijgen** (kaarttegels nadoen in de screenshotscripts, zoals in de e2e-test) | Zonder beeld kan niemand de kaart beoordelen; ChatGPT kon het ook niet | S |
| C2 🔄 | **Mijn reis "volgende stop eerst"** (opbouw klaar 26 november; snelheid R65 nog meten): bovenaan de eerstvolgende stop met datum, vertrekregel en Route; daaronder kosten en de rest. Meteen ook sneller maken (R65: LCP 2,9 s, TBT 1,3 s op trage 4G) | Onderweg is de volgende stop de enige vraag; nu het traagste scherm | L |
| C3 | **Dichtbij met rijtijd als hoofdgegeven** in de lijst en het paneel op de kaart, afstand klein | De vraag is "haal ik het vóór sluiting", niet hoeveel kilometer | M |
| C4 | **Filtersheet nalopen**: vaste knop "Toon n plekken" onderaan, volgorde Vertrek, Open, Prijs, Voorzieningen, Overig | Nu meer filters in de sheet (Gratis, 8+, Stroom, Lozen) | M |
| C5 🔄 | **Kaart** (26 november: Nederlandse namen, locatieknop, bronvermelding, Dichtbij-chips; open: groepen dekken plaatsnamen af): stippen, groepen en het gekozen-plekpaneel beoordelen op 390 px in licht en donker | Laatste hoofdscherm zonder ontwerpronde | M |
| C6 | **Voor/na-overzicht** per scherm als pagina, voor jou en voor latere reviews | Laat zien wat er echt veranderde | S |

Niet doen vóór de livegang: visuele snapshottests in CI (T49): de data wisselt dagelijks, dus de baselines breken
steeds. Liever na de livegang met vaste testdata.

## Spoor D: kwaliteit en release (19 tot en met 31 december)

1. Alleen fixes vanaf 19 december.
2. Meting op productie (LANCERING 3.3): LCP < 2,5 s en CLS < 0,1 op start, zoeken, Zonder vertrektijd, plekpagina en
   Dichtbij; axe 0 meldingen.
3. Testplan op een echte iPhone en Android (3.2), samen met jou.
4. Hersteloefening van de back-up (3.4), Search Console en sitemap (3.5).
5. De drie lanceervoorwaarden afvinken (3.6).

## Planning

| Week | Jij | Agent |
|---|---|---|
| 27 nov – 3 dec | A1–A4 | C1, C2 (voorstel en bouwen), B1 starten |
| 4 – 10 dec | A5, A6 | C3, C4, B2 zodra mail kan |
| 11 – 18 dec | Voorstellen C5 goedkeuren | C5, C6, B3 steekproef, alles samenvoegen |
| 19 – 31 dec | Testen op je telefoon, afvinken | Spoor D, alleen fixes |

## Eerste stap

Als jij A1 en A2 doet, kan ik daarna meteen meten op de echte site. Ondertussen begin ik met C1 en het voorstel voor
C2 (Mijn reis), tenzij je liever eerst Dichtbij of de kaart wilt.
