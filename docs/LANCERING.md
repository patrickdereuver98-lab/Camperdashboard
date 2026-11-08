# Lancering 1 januari 2027: statusbord

> Het enige statusbord tot de livegang (besluit R42, 8 november 2026). Wat hier staat, gaat voor statussen elders;
> het [implementatieplan](specs/06-implementatieplan.md) en de [open punten](specs/README.md) blijven het archief.
> Bron van de werkpakketten: [review november](review-2026-11.md) §4. Bijgewerkt: 8 november 2026, live database
> gecontroleerd op die dag.

Tekens: ✅ klaar in code (zie kolom Live), 🔄 bezig of deels, ⬜ nog niet begonnen.
Eigenaar: **Agent** bouwt, **Patrick** beslist of zet instellingen.

## Besluiten die op Patrick wachten

| # | Besluit | Waarom het blokkeert | Punten |
|---|---|---|---|
| 1 | **Domein**: is `vrijstaan.nl` van jou? Zo niet: een ander domein (en dan merknaam in teksten nalopen) | Canonicals, sitemap, `hallo@vrijstaan.nl`, Search Console en de inlogmail gaan ervan uit | R2, README 101 |
| 2 | **Vercel Authentication uit** voor Production | Niemand kan de site zien, ook de API en de webhook van Resend niet | R1, README 102 |
| 3 | **Eigen SMTP** (EU, met SPF/DKIM) en welke dienst | De ingebouwde mailer stuurt enkele mails per uur voor de hele site: inloggen en reviews lopen vast | R10, B3 |
| 4 | **90%-eis en mailen naar eigenaren**: eis herzien per soort plek, grijze plekken verbergen bij de livegang, of eigenaren mailen (draait README 59 terug; PR #141 staat klaar) | Lanceervoorwaarde 2 wordt bij het huidige tempo niet gehaald | R16, README 110, 112 |
| 5 | **PR #143 samenvoegen** (golf 1 en 2, naar `acceptatie`) | Pas daarna gaan de migraties en de pipeline hieronder live, ook de fix voor het datalek | Alle R-punten in golf 1 en 2 |

Ook alleen Patrick, geen besluit maar wel nodig: naam en contactadres (of postbus) voor `lib/company.ts`, Google-account
beveiligen en wachtwoord minimaal 10 tekens in Supabase (B2, B4).

Al besloten op 8 november 2026 (agent, op verzoek van Patrick; zie [review november](review-2026-11.md) §6):
prijsbelofte (R22), bevriezen (R41), sturing (R42), README 109, 113, 114 en 115.

## Lanceervoorwaarden (PRD)

| Voorwaarde | Stand 8 november | Wat ontbreekt |
|---|---|---|
| 1. Juridisch en beheer | ⬜ Niet gehaald | Bedrijfsgegevens leeg in `lib/company.ts` (Patrick), domein en contactadres, site achter Vercel-login, B1 nog open op live (fix in PR #143). Bewaartermijnen draaien wel: cron `retention` slaagde op 8 november om 03:17 UTC |
| 2. Kernbelofte | 🔄 Deels | 1.444 van 2.186 gepubliceerde plekken met vertrekregel (66%), prijs bij 1.249 (57%), doel 90%. Besluit over de eis bij Patrick (besluit 4 hierboven) |
| 3. Kwaliteit | 🔄 Niet aangetoond | Lab na golf 2: plekpagina TBT 229 ms en LCP 1,1 s, start TBT 179 ms, zoeken TBT 594 ms en LCP 3,0 s (te hoog). WCAG AA-punten uit de review gebouwd. Productie niet meetbaar zolang de site achter een login staat |

## Na het samenvoegen van PR #143 live zetten (Agent)

Pas na samenvoegen, anders breekt de live site (CLAUDE.md). Volgorde:

1. Migraties in deze volgorde toepassen (`apply_migration`). Op 8 november stond geen ervan live; de laatste live
   migratie is `20261102132558_marketing_dashboard`.
   - `20261106100000_reviews_kolomrechten` (R9, B1, B12 deels, B19; heeft de nieuwe beheerpagina nodig)
   - `20261106100100_is_admin_rol` (R14, B2)
   - `20261106100200_eigenaar_inbox_bevestiging` (R12)
   - `20261106100300_inzendingen_overnemen` (R26)
   - `20261106100400_inzendingen_limiet` (R11)
   - `20261106100500_push_bekende_diensten` (SEC-13)
   - `20261106200000_health_en_ops_probe` (R1 probe, R3)
   - `20261106200100_cron_rustiger_en_opschonen` (R7; haalt ook de dode cron `retention-cron-log` weg)
   - `20261106200200_publicatiedrempel` (README 38)
   - `20261106300000_controledatum_kernvelden` (R20)
   - `20261107120000_doorkliks_website_telefoon` (R45; tot dan toont Statistieken "Onbekend" bij Website en Gebeld)
2. Edge function `pipeline` uitrollen met parser 44 (R17 tot en met R21; live staat versie 64) en `push` (live
   versie 1). De nieuwe versienummers in het implementatieplan zetten.
3. Controleren met SQL: `anon` mag `reviews.author_email`, `admin_note` en `user_id` niet meer lezen; de oude
   `submit_review` met `p_author_email` is weg; `public.health()` bestaat; `is_admin()` kijkt naar de rol; cron
   `retention-cron-log` is weg. Daarna `get_advisors` (security).
4. GitHub (Patrick): "Allow GitHub Actions to create pull requests" aan, of laten zoals het is (Snapshot pusht dan de
   branch en meldt dat); geheimen voor Marketing zetten of de workflow laten overslaan.
5. Vercel (Patrick): `NEXT_PUBLIC_SITE_URL` zetten zodra het domein vaststaat.

## Fase 0: veilig en zichtbaar (6 tot en met 13 november)

| Werkpakket | Status | Eigenaar | Live | Rest |
|---|---|---|---|---|
| 0.1 Bereikbaar (R1, R2) | ⬜ | Patrick | Nee | Domein, Vercel Authentication uit, DNS, `NEXT_PUBLIC_SITE_URL`. Code: ops-probe telt alleen 200 als goed, build waarschuwt zonder site-adres |
| 0.2 Besluiten (R16, R22, R41, R42) | 🔄 | Patrick | n.v.t. | R22, R41 en R42 besloten op 8 november; R16 open |
| 0.3 Juridisch (lanceervoorwaarde 1) | ⬜ | Patrick + Agent | Nee | Naam en contactadres aanleveren; agent vult `lib/company.ts` |
| 0.4 Datalek (R9, B1, B19) | ✅ | Agent | Na #143 | Live leest `anon` nog `author_email` (8 november); er staan 0 reviews. Tot de migratie live staat geen review goedkeuren |
| 0.5 Geen foute feiten (R17, R20, R21, R44) | ✅ | Agent | Na #143 | Pipeline parser 44 en migratie `20261106300000` |
| 0.6 Eerlijke teksten (R22, R37) | ✅ | Agent | Na #143 | SEO-titel, deelafbeelding, vertrouwensregel, "Hoe het werkt" en welkomstuitleg zeggen "met de toeslagen die we kennen" of "incl. toeristenbelasting" |
| 0.7 Ruis weg (R1, R3, R4) | ✅ | Agent + Patrick | Na #143 | Zie stap 4 hierboven voor Patrick |
| 0.8 Kleine schermen (R27) | ✅ | Agent | Na #143 | Geen |

## Fase 1: kernbelofte en betrouwbaarheid (14 november tot en met 4 december)

| Werkpakket | Status | Eigenaar | Live | Rest |
|---|---|---|---|---|
| 1.1 Meer vertrektijden (R16, R48) | 🔄 | Agent + Patrick | Na #143 | R48 gebouwd (oproep "Vertrektijd doorgeven", "Klopt dit niet?" per cel, bevestiging met termijn). Uitvoering van R16 wacht op het besluit |
| 1.2 Juiste feiten (R18, R19, R23, R25, R47) | 🔄 | Agent | Na #143 | Code af. Nog doen na de uitrol: de 3 plekken via het citaatpad nalopen en de steekproef van 30 uit de 416 plekken met tentprijsrisico, plus campings onder € 8 in Beheer → Plekken, Verdachte prijzen |
| 1.3 Meten wat telt (R45, R46) | ✅ | Agent | Na #143 | Migratie `20261107120000` |
| 1.4 Fouten zien (R3, R7) | ✅ | Agent | Na #143 | `health()` in `monitor.yml` werkt pas met de migratie |
| 1.5 Herbouwbaar (R5, R6, R40) | 🔄 | Agent | Deels | Bestanden hebben de live versienummers, back-up neemt `auth.users`, storage en `cron.job` mee, SQL-tests voor drempel, cron en RLS. Nog: nulmigratie met `web/scripts/dump-schema.sh` (heeft `SUPABASE_DB_URL` nodig) en een herbouwtest in CI |
| 1.6 Inloggen en mail (R10, R2) | ⬜ | Patrick + Agent | Nee | Wacht op besluit 1 en 3 |
| 1.7 Niets kwijt (R24, R28, R29, R54) | ✅ | Agent | Na #143 | Geen |

## Fase 2: gebruik, ontwerp en snelheid (5 tot en met 18 december)

| Werkpakket | Status | Eigenaar | Live | Rest |
|---|---|---|---|---|
| 2.1 Eén merk (R49, R50, R52, R53) | ✅ | Agent | Na #143 | Hoofdactie op de start zonder schaduw (stijlgids §7) |
| 2.2 Toegankelijk (R30, R31) | ✅ | Agent | Na #143 | Admin-`Segmented` gebruikt nog `role="radio"` op knoppen (alleen beheer) |
| 2.3 Snel op 4G (R33 tot en met R36) | 🔄 | Agent | Na #143 | R34 en R35 af; R33 en R36 zo ver als besloten (README 114 en 115). Zoeken haalt het doel nog niet (TBT 594 ms, LCP 3,0 s) |
| 2.4 Reizen zonder wrijving (R51, R54) | ✅ | Agent | Na #143 | Geen |
| 2.5 Inbox en limieten (R11 tot en met R14, R26) | ✅ | Agent | Na #143 | Geen |
| 2.6 Vindbaar (R38, R39) | 🔄 | Agent | Na #143 | R38 af; R39 deels (SEO-06 tot en met 15 per punt) |

## Fase 3: bevriezen en live (19 tot en met 31 december)

| Werkpakket | Status | Eigenaar | Rest |
|---|---|---|---|
| 3.1 Alleen fixes, geen nieuwe functies of ontwerpwijzigingen | ⬜ | Agent | Vanaf 19 december |
| 3.2 Testplan op een echte iPhone (Safari) en Android (Chrome): PRD-acceptatiecriteria en de vijf persona-reizen | ⬜ | Patrick + Agent | Site moet publiek zijn |
| 3.3 Lab-meting op productie: LCP < 2,5 s en CLS < 0,1 op start, zoeken, Zonder vertrektijd, plekpagina en Dichtbij; axe 0 meldingen | ⬜ | Agent | Domein en publieke site |
| 3.4 Hersteloefening van de back-up in een tweede gratis project | ⬜ | Agent + Patrick | Na 1.5 |
| 3.5 Search Console aanmelden, sitemap insturen | ⬜ | Patrick | Domein |
| 3.6 De drie lanceervoorwaarden hierboven afvinken | ⬜ | Patrick | Alles hierboven |

## Spelregels tot 1 januari

- Alleen werk voor een lanceervoorwaarde of een Kritiek- of Hoog-punt (R41). Marketingdashboard en Mission Control
  blijven aan, zonder vlag: alleen beheer ziet ze, bezoekers merken er niets van.
- Elke PR noemt het R-nummer, heeft een test en gaat via `acceptatie`. Migraties pas live na samenvoegen.
- Werk dit bord bij in dezelfde commit als het werk. De README splitsen en het implementatieplan inkorten gebeurt pas
  in fase 4 (R42).
