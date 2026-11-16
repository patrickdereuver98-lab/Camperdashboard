# Lancering 1 januari 2027: statusbord

> Het enige statusbord tot de livegang (besluit R42, 8 november 2026). Wat hier staat, gaat voor statussen elders;
> het [implementatieplan](specs/06-implementatieplan.md) en de [open punten](specs/README.md) blijven het archief.
> Bron van de werkpakketten: [review november](review-2026-11.md) §4 en [review 16 november](review-2026-11-16.md) §6.
> Bijgewerkt: 16 november 2026, live database gecontroleerd op die dag.

Tekens: ✅ klaar in code (zie kolom Live), 🔄 bezig of deels, ⬜ nog niet begonnen.
Eigenaar: **Agent** bouwt, **Patrick** beslist of zet instellingen.

## Besluiten die op Patrick wachten

| # | Besluit | Waarom het blokkeert | Punten |
|---|---|---|---|
| 1 | **Domein**: is `vrijstaan.nl` van jou? Zo niet: een ander domein (en dan merknaam in teksten nalopen) | Canonicals, sitemap, `hallo@vrijstaan.nl`, Search Console en de inlogmail gaan ervan uit | R2, README 101 |
| 2 | **Vercel Authentication uit** voor Production | Niemand kan de site zien, ook de API en de webhook van Resend niet | R1, README 102 |
| 3 | **Eigen SMTP** (EU, met SPF/DKIM) en welke dienst | De ingebouwde mailer stuurt enkele mails per uur voor de hele site: inloggen en reviews lopen vast | R10, B3 |
| 0 | **Back-up: geheimen `SUPABASE_DB_URL` en `BACKUP_PASSPHRASE` zetten** en de workflow starten (nieuw, 16 november) | Er is nog nooit een back-up gemaakt; de run van 15 november faalde | R59 |
| 4 | **90%-eis en mailen naar eigenaren**: eis herzien per soort plek, grijze plekken verbergen bij de livegang, of eigenaren mailen (draait README 59 terug; PR #141 staat klaar) | Lanceervoorwaarde 2 wordt bij het huidige tempo niet gehaald | R16, README 110, 112 |

Nieuw uit de review van 16 november (§7 daar, met advies): beschrijving van de website op de plekpagina (R80), foto's van
websites (R90), Archies blokkeren en uit de openbare repo (R81), weringen omzeilen in het bronnenbeleid, Dependabot-meldingen
aan en PR #141 (R91).

Ook alleen Patrick, geen besluit maar wel nodig: naam en contactadres (of postbus) voor `lib/company.ts`, Google-account
beveiligen en wachtwoord minimaal 10 tekens in Supabase (B2, B4).

Al besloten op 8 november 2026 (agent, op verzoek van Patrick; zie [review november](review-2026-11.md) §6):
prijsbelofte (R22), bevriezen (R41), sturing (R42), README 109, 113, 114 en 115.

## Lanceervoorwaarden (PRD)

| Voorwaarde | Stand 16 november | Wat ontbreekt |
|---|---|---|
| 1. Juridisch en beheer | ⬜ Niet gehaald | Bedrijfsgegevens leeg in `lib/company.ts` (Patrick), domein en contactadres, site achter Vercel-login (16 november nog 302). B1 dicht. Bewaartermijnen draaien. Nieuw: geen enkele back-up (R59), privacyverklaring noemt niet alle bronnen (R90) |
| 2. Kernbelofte | ⬜ Achteruit | 1.456 van 2.176 met vertrekregel (67%), prijs 1.174 (54%). Steekproef 16 november: vertrekregel 75% juist, prijs 39%; op Zonder vertrektijd 5 van 18 fout en 0 door een mens bevestigd (R56). Stealth-lezer staat stil sinds 9 november (R58). Besluit over de eis bij Patrick |
| 3. Kwaliteit | 🔄 Niet aangetoond | Lab 16 november (trage 4G, CPU x4, 390 px): LCP onder 1,5 s behalve Mijn reis (2,9 s), TBT start 675 ms, Mijn reis 1.268 ms (R65); axe 0 meldingen op 8 pagina's in licht en donker. Eerder, lab na golf 2: plekpagina TBT 229 ms en LCP 1,1 s, start TBT 179 ms, zoeken TBT 594 ms en LCP 3,0 s (te hoog). WCAG AA-punten uit de review gebouwd. Productie niet meetbaar zolang de site achter een login staat |

## Live gezet na het samenvoegen van PR #143 en #144 (8 november 2026)

**Gedaan (agent, 8 november ±14:00 UTC):** stap 1 tot en met 3 hieronder. Alle 11 migraties toegepast en met de versie
van het bestand vastgelegd in `schema_migrations`; pipeline live als versie 65 (parser 45, stub op commit `d6d3bd7`),
`push` als versie 2; beide starten op en weigeren zonder sleutel. Gecontroleerd: `anon` en `authenticated` lezen
`author_email` en `admin_note` niet meer, de oude `submit_review` met e-mailadres is weg, `health()` geeft 2.182
gepubliceerd, 1.444 met vertrekregel, 1.188 met prijs. `get_advisors` (security): alleen de bekende, bewuste meldingen
plus HIBP (B4, Patrick). `20261108100000_bronnen_en_claims` blijft bewust uit (R41). Stap 4 en 5 blijven bij Patrick.

Volgorde zoals uitgevoerd:

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
2. Edge function `pipeline` uitrollen met parser 45 (R17 tot en met R21, nacontrole prijzen; was versie 64, nu 65) en `push` (was
   versie 1, nu 2). De nieuwe versienummers in het implementatieplan zetten.
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
| 0.4 Datalek (R9, B1, B19) | ✅ | Agent | Ja, 8 nov | `anon` en `authenticated` lezen `author_email` en `admin_note` niet meer |
| 0.5 Geen foute feiten (R17, R20, R21, R44) | 🔄 | Agent | Code ja; data nee | Code live, maar op 16 november pas bij 149 van 2.176 plekken toegepast: de stealth-lezer staat stil sinds 9 november (R58). 13 stock-foto's nog in de data (R84) |
| 0.6 Eerlijke teksten (R22, R37) | ✅ | Agent | Ja, 8 nov | SEO-titel, deelafbeelding, vertrouwensregel, "Hoe het werkt" en welkomstuitleg zeggen "met de toeslagen die we kennen" of "incl. toeristenbelasting" |
| 0.7 Ruis weg (R1, R3, R4) | ✅ | Agent + Patrick | Ja, 8 nov | Zie stap 4 hierboven voor Patrick |
| 0.8 Kleine schermen (R27) | ✅ | Agent | Ja, 8 nov | Geen |

## Fase 1: kernbelofte en betrouwbaarheid (14 november tot en met 4 december)

| Werkpakket | Status | Eigenaar | Live | Rest |
|---|---|---|---|---|
| 1.1 Meer vertrektijden (R16, R48) | 🔄 | Agent + Patrick | Ja, 8 nov | R48 gebouwd (oproep "Vertrektijd doorgeven", "Klopt dit niet?" per cel, bevestiging met termijn). Uitvoering van R16 wacht op het besluit |
| 1.2 Juiste feiten (R18, R19, R23, R25, R47) | 🔄 | Agent | Deels | 16 november: 58 campings onder € 8, niet 18; 40 prijzen gelijk aan een toeslag; correcties niet beschermd tegen de scraper (R60, R61). Stand 8 november: nacontrole 8 november: R18 3 van 3 goed; R19 14 van 29 fout, R47 92 van 136 fout; 42 gecorrigeerd, 64 geleegd (back-up `private.nacontrole_20261108`). Parser 45 live, zodat een nieuwe scrape ze niet terugzet. Nog 18 campings onder € 8 niet te controleren: nakijken in Beheer |
| 1.3 Meten wat telt (R45, R46) | ✅ | Agent | Gebouwd, niet gemeten | Migratie `20261107120000`. 0 doorkliks tot de site publiek is; geen doelwaarde (R86) |
| 1.4 Fouten zien (R3, R7) | 🔄 | Agent | Deels | `health()` ziet een stil kanaal pas na dagen (stealth-lezer 6,8 dagen), monitor draait ±4 keer per dag (R64, R89) |
| 1.5 Herbouwbaar (R5, R6, R40) | 🔄 | Agent + Patrick | Deels | Nulmigratie en herbouwtest in CI groen. Back-up: nooit gemaakt (geheimen ontbreken, R59), `auth.identities` en storage-bestanden niet mee, herstelcommando in het draaiboek klopt niet (R67, R89); `baseline/cron.sql` zet het oude ritme terug |
| 1.6 Inloggen en mail (R10, R2) | ⬜ | Patrick + Agent | Nee | Wacht op besluit 1 en 3 |
| 1.7 Niets kwijt (R24, R28, R29, R54) | ✅ | Agent | Ja, 8 nov | Geen |

## Uit de review van 16 november: eerst de keten (17 november tot en met 6 december)

Gaat vóór de rest van fase 1 en 2. Volgorde: eerst beheer beschermen en meten, dan pas herlezen. Details in
[review 16 november](review-2026-11-16.md) §6.

| Werkpakket | Status | Eigenaar | Rest |
|---|---|---|---|
| A.1 Back-up maken en openen (R59) | ⬜ | Patrick | Geheimen zetten, workflow starten |
| A.2 Stealth-lezer repareren, zelfstart begrenzen (R58) | ⬜ | Agent | Nog niet laten lezen tot A.3 klaar is |
| A.3 Beheerslot voor bevestigingen en nacontrole (R61) | ⬜ | Agent | |
| A.4 Zonder vertrektijd: 32 plekken met de hand (R56) | ⬜ | Agent + Patrick | |
| A.5 Risicogroepen foute vertrektijden en prijzen nalopen of legen (R57, R60) | ⬜ | Agent | |
| A.6 Beloftes op start en FAQ, standaard 11:00 weg (R66, R83) | ⬜ | Agent | |
| B.1 Wislog, momentopname, `health()` per kanaal (R62, R64) | ⬜ | Agent | |
| B.2 Gouden set en lezer in CI (R69) | ⬜ | Agent | |
| B.3 Extractor met context en prijsetiketten (R63, R60) | ⬜ | Agent | |
| B.4 Herlezing in porties (R58, R62) | ⬜ | Agent | Na B.1 tot en met B.3 |
| B.5 Niets stil weggooien (R68, R71, R72, R73) | ⬜ | Agent | |
| C.1 Mijn reis snel en offline (R65) | ⬜ | Agent | Fase 2 |
| C.2 Back-up compleet, crons als migratie, constraints (R67, R79) | ⬜ | Agent | Fase 2 |
| C.3 Draaiboek, uptime-check, Dependabot (R89, R91) | ⬜ | Agent + Patrick | Fase 2 |
| C.4 Privacy, bronnen, limieten (R75, R76, R77, R90) | ⬜ | Agent | Fase 2 |
| D.1 Tweede steekproef van 30 plekken vóór de livegang | ⬜ | Agent | Fase 3; doel vertrekregel ≥ 90% juist, Zonder vertrektijd 100% |

## Fase 2: gebruik, ontwerp en snelheid (5 tot en met 18 december)

| Werkpakket | Status | Eigenaar | Live | Rest |
|---|---|---|---|---|
| 2.1 Eén merk (R49, R50, R52, R53) | ✅ | Agent | Ja, 8 nov | Hoofdactie op de start zonder schaduw (stijlgids §7) |
| 2.2 Toegankelijk (R30, R31) | ✅ | Agent | Ja, 8 nov | Admin-`Segmented` gebruikt nog `role="radio"` op knoppen (alleen beheer) |
| 2.3 Snel op 4G (R33 tot en met R36) | 🔄 | Agent | Ja, 8 nov | R34 en R35 af; R33 en R36 zo ver als besloten (README 114 en 115). Zoeken haalt het doel nog niet (TBT 594 ms, LCP 3,0 s) |
| 2.4 Reizen zonder wrijving (R51, R54) | ✅ | Agent | Ja, 8 nov | Geen |
| 2.5 Inbox en limieten (R11 tot en met R14, R26) | ✅ | Agent | Ja, 8 nov | Geen |
| 2.6 Vindbaar (R38, R39) | 🔄 | Agent | Ja, 8 nov | R38 af; R39 deels (SEO-06 tot en met 15 per punt) |

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
