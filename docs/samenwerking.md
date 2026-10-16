# Samenwerking: open PR's, volgorde en wie wat oppakt

> Bijgewerkt: 16 oktober 2026, door de audit-agent (PR #9). Dit is het gezamenlijke bord voor alle agents en voor
> Patrick. Werk dit bestand bij als je een PR opent, samenvoegt of een taak oppakt, zodat niemand dubbel werk doet.
> Cijfers komen uit de live database (alleen lezen), niet uit de snapshot.

## 1. Stand van zaken

`main` staat nog op 12 oktober (`c68d087`). Sindsdien zijn zes agents parallel bezig geweest. Niets daarvan is
samengevoegd, maar een deel staat wel al **live in de database** (migraties van PR #4, #10 en #12).

Sinds 16 oktober is er een branch `acceptatie` (nu gelijk aan `main`). PR #10, #11 en #12 hebben die al als basis.
Volgens de sessie van #11/#12 is de nieuwe werkwijze: feature-branch → PR naar `acceptatie` → testen op de
Vercel-preview → PR `acceptatie` → `main`. **Nog door Patrick te bevestigen** (§4, B9).

| PR | Branch | Wat | Grootte | Live in database? | Status |
|---|---|---|---|---|---|
| [#4](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/4) | `claude/launch-hardening` | Tests en CI, kaart per gebied (PostGIS), strikte OSM-toelating, **accounts** (Google, Apple, Facebook, inloglink), foto-uploads met moderatie, dubbelen samenvoegen, drukte, push, camperprofiel met documenten, uitgaven, reisstatistieken, samen plannen | 108 bestanden | Ja: 11 migraties. Nog niet live: `strict_osm_query` (B2) en `delete_my_account` (B5) | Draft, wacht op B2, B3 en B5 |
| [#5](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/5) | `claude/mobile-ui-photos-ux-axxlae` | Nieuwe stijlgids (Geist), compactere UI, scherpe foto's, nette beschrijving, scraper v17 | 212 bestanden | Scraper v17 is uitgerold | Draft, Vercel groen, wacht op review |
| [#6](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/6) | `claude/local-host-setup-3xwg5y` | `node start.mjs` om lokaal te draaien | 1 commit | Nee | Klaar voor review, botst met niets |
| [#9](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/9) | `claude/brave-wright-odz441` | Audit 12 oktober + dit bord | Alleen documenten | Nee | Draft |
| [#10](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/10) | `claude/deelafbeelding-en-review` | Review in fases 0 tot 2: limieten op RPC's en API's, privacy (supporttoken), CI met 15 tests, getypeerde Supabase-client, deelafbeelding, cookiebanner, zoekpagina | 64 bestanden | Ja: 4 migraties (limieten, `admin_mark_beheer`) | Klaar voor review, basis `acceptatie`, CI en Vercel groen |
| [#11](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/11) | `review/feature-review-plan` | Feature review (UI/UX, gebruiker) en `plan.md` | Alleen documenten | Nee | Draft, basis `acceptatie` |
| [#12](https://github.com/patrickdereuver98-lab/Camperdashboard/pull/12) | `feature/kernbelofte-acceptatie` | Kernbelofte: een plek staat pas op `/zonder-vertrektijd` na bevestiging door een mens (beheer of eigenaar), een jaar geldig; scherm `/admin/vertrektijden`. Raakt `places.ts`, `search.ts`, `format.ts`, `types.ts`, `place-ui.tsx`, `legend.tsx`, plekpagina, zoekpagina, startpagina, `admin/shell.tsx` | | Ja: `vertrektijd_bevestiging` (kolommen `departure_check*`, RPC `check_departure`, cron `departure-recheck`) | Draft, basis `acceptatie` |

### Live cijfers (16 oktober 2026)

| Meting | Waarde |
|---|---|
| Gepubliceerde plekken | 1.536 |
| Zonder vaste vertrektijd (`vrij` of `per24`) | 21 (doel 150) |
| Met prijs | 880 |
| Met losse toeslagen (`price_extras`) | 984. **Let op:** de snapshot (680 plekken) heeft dit veld niet, de live data wel. `plan.md` P7, open punt 13 van PR #11 ("veld ontbreekt in de data") gingen uit van de snapshot. Review #10 is aangepast; de sessie van #11 past `plan.md` aan |
| Beheeraccounts | 0 (één uitnodiging klaar) |
| Bewaartermijnen actief | Nee: geen `apply_retention`, geen cron `retention` |
| Scrape-wachtrij | Leeg (herscrape met v17 klaar) |
| Testtabellen `private.probe*` | Staan er nog |

## 2. Waar de PR's elkaar raken

Gemeten met `git merge-tree` op 16 oktober 2026. Elke combinatie van PR #4, #5, #9, #10 en #11 botst minstens in
`docs/specs/README.md`, omdat iedereen zijn open punten als nummer 12 en verder heeft toegevoegd.

| Combinatie | Botsende bestanden |
|---|---|
| #10 + #5 | 17: vrijwel alle formulieren, plekpagina, zoekpagina, `chrome.tsx`, `cookie-banner.tsx`, `place-ui.tsx`, `places.ts`, specs |
| #10 + #4 | 7: `ci.yml` (beide maken hem aan), `package.json`, `places.ts`, `supabase-browser.ts`, `chrome.tsx`, plekpagina, README |
| #4 + #5 | 4: plekpagina, zoekpagina, `places.ts`, README |
| #11 + iedereen | Alleen `docs/specs/README.md` |
| #9 + iedereen | Niets: alleen nieuwe bestanden in `docs/` (de verwijzing in de README komt bij stap 5) |
| #6 + iedereen | Niets |

## 3. Volgorde van samenvoegen (goedgekeurd 16 oktober)

Uitgangspunt: eerst het vangnet (CI), daarna de grote UI-wijziging, dan de nieuwe functies. Na elke merge werkt de
agent van de **volgende** PR zijn branch bij met `main` (merge, geen rebase), lost de botsingen op en laat CI groen
worden. Pas daarna de volgende merge. Als B9 bevestigd is, geldt alles hieronder voor `acceptatie` in plaats van `main`.

1. **#6 startscript.** Botst met niets.
2. **#10 review fase 0 tot 2.** Brengt CI, tests en de limieten. Al groen. Daarna draait CI op elke volgende PR.
3. **#5 UI en stijlgids.** De agent van #5 voegt `main` samen (17 botsingen; meestal kleine wijzigingen van #10 in
   bestanden die #5 herschreef: neem het ontwerp van #5 en zet de functionele fixes van #10 er weer in, zoals
   `formValue()`, `DepartureRadios`, de focusring en de cookiebanner).
4. **#4 accounts en meer**, na de besluiten B2 en B3 in §4. De agent van #4 voegt `main` samen; `ci.yml` wordt één workflow
   (die van #10 als basis, met de Playwright-stap van #4 erbij).
5. **#12 kernbelofte**, na #5: de sessie van #12 zet haar logica op het nieuwe ontwerp van #5. #12 haalt haar eigen `ci.yml` weg, zodat die van #10 de enige is.
6. **#11 en #9 documenten** als laatste. De open punten krijgen dan één doorlopende nummering (§5).

## 4. Besluiten die alleen Patrick kan nemen

| # | Besluit | Waarom nu | Komt uit |
|---|---|---|---|
| B1 | ✅ **Besloten door Patrick (16 oktober):** accounts, drukte, push, camperprofiel en uitgaven blijven (PR #4). Nog te doen op #4: de privacyverklaring noemt accounts, de bucket `vehicle-docs` en de pushdiensten | Staat al live in de database | #4, audit C1 |
| B2 | Strikte OSM-toelating: zo'n 900 campings zonder tag `caravan_site` of `motorhome=yes` worden dan niet meer ververst | Raakt het aantal plekken, de prioriteit van de eigenaar | #4 open punt 12 |
| B3 | Advertenties: geen, sponsoring zonder tracking, of AdSense | AdSense botst met "geen tracking van derden" en met Vercel Hobby | #4 open punt 14 |
| B4 | ✅ **Volgorde goedgekeurd door Patrick (16 oktober).** PR's gaan één voor één uit draft, in de volgorde van §3 | Elke dag langer wordt het samenvoegen zwaarder | dit bord |
| B5 | Zelf uitvoeren in de SQL-editor: `web/supabase/retention.sql` (PR #10) en `delete_my_account(p_confirm text)` (onderaan `migrations/20261012_user_accounts.sql` op PR #4) | De Supabase-tool van de agents kan de bevestiging niet geven | #10 0.4, #4 |
| B6 | Beheeraccount aanmaken via `/admin` | Zonder account blijven inzendingen, reviews en tickets liggen | alle drie de reviews |
| B7 | Login-sleutels (Google, Facebook) en eigen SMTP | Nodig voor B1 en voor mail bij tickets | #4, #10, audit B5 |
| B8 | Bedrijfsgegevens in `web/src/lib/company.ts` | Juridische pagina's tonen nog plaatshouders | alle |
| B9 | Werkwijze via `acceptatie` bevestigen, en de kernbelofte zoals #12 die bouwt: alleen na bevestiging door een mens op `/zonder-vertrektijd`, "per 24 uur" met eigen label, "vrij behalve bij drukte" niet op de kernpagina, bevestiging een jaar geldig | Volgens de sessie van #12 al door Patrick besloten; staat nog niet bij Patrick zelf op dit bord | #12 |

## 5. Eén nummering voor de open punten

Punten 1 tot 11 in `docs/specs/README.md` blijven. Daarna zijn er per branch dubbele nummers 12 tot 19. Voorstel: wie
als laatste samenvoegt (zie §3, stap 5), zet ze in deze volgorde en verwijst naar de bron.

| Nieuw | Onderwerp | Bron |
|---|---|---|
| 12 | Nog geen beheeraccount | #10 (12), audit D1 |
| 13 | `schema.sql` kan geen nieuw project opbouwen; overstap op migraties | #10 (13), audit D2 |
| 14 | Header volgt de app flow (opgelost) | #10 (14) |
| 15 | Stille terugval op de snapshot (deels opgelost) | #10 (15) |
| 16 | Basis 16/17 px en drukte op de telefoon (opgelost) | #5 (12) |
| 17 | Beschrijving "Over deze plek" (scraper v17) | #5 (13) |
| 18 | Foto's: miniaturen en keurmerken (opgelost) | #5 (14) |
| 19 | Typografie en stijl gewijzigd op verzoek eigenaar (opgelost) | #5 (16) |
| 20 | Strikte OSM-toelating (besluit B2) | #4 (12) |
| 21 | Accounts optioneel (gewijzigd, besluit B1) | #4 (13), audit C1 |
| 22 | Advertenties (besluit B3) | #4 (14) |
| 23 | Foto-upload per plek in plaats van in het reviewformulier | #4 (15) |
| 24 | Drukte is een melding, geen feit | #4 (16) |
| 25 | Push via de pushdienst van de browser | #4 (17) |
| 26 | Camperafmetingen: alleen lengte bekend | #4 (18) |
| 27 | "Zonder stroom" in plaats van "off-grid" | #4 (19) |
| 28 | Toegankelijkheidsverklaring belooft meer dan de code | #11 (12) |
| 29 | Prijs met toeslagen: data is er (984 plekken), maar Mijn reis telt toeslagen niet mee | #11 (13), audit B1 |
| 30 | Openbare aanmelding staat aan; nodig voor accounts (B1), dus beheer extra beschermen (MFA, controle op uitnodiging) | audit C2, #11 0.4 |
| 31 | Privacy noemt "een paar dagen" cache voor rijtijden; routes staan weken in de cache | audit C5 |
| 32 | Maar 21 plekken zonder vaste vertrektijd | audit A1, #11 D1 |

Het punt over "drie concept-PR's raken dezelfde bestanden" (#5, punt 15) vervalt: dat regelt dit bord.

## 6. Wie pakt wat op

Bevindingen uit de drie reviews (audit #9, review #10, plan #11) die nog **niemand** heeft gebouwd, met een voorstel
voor de eigenaar. Een agent die iets oppakt, zet zijn naam en branch erbij.

| Taak | Bron | Voorstel eigenaar | Waarom die | Status |
|---|---|---|---|---|
| Kernbelofte: meer plekken zonder vertrektijd (OSM `motorhome=designated`, "per 24 uur" herkennen, Doe mee gericht) en bevestiging door een mens | audit A1, #11 D1/D2 | Sessie "Feature review en plan" | Bezig | 🔄 PR #12 |
| Mijn reis telt toeslagen per persoon en per nacht mee | audit B1, #11 P7, #10 3.1 en G2 | Agent van #4, ná stap 4 | #4 bouwde al uitgaven en reiskosten in `trip-app.tsx`; anders twee keer hetzelfde bestand | ⬜ Toegezegd door #4 |
| Routecache op dagen (privacy) | audit C5 | Agent van #10 | `routing.ts` is in #10 al aangepast; één regel | ✅ PR #10 (`a0301b2`) |
| Eerste resultaten server-side op zoek- en vertrekpagina's (vindbaarheid, LCP) | audit B4, #10 2.12 (LCP) | Agent van #5, ná stap 3 | `search-app.tsx` is in #5 herschreven | ⬜ |
| Door `discover` gevonden websites eerst laten bevestigen | audit A4 | Audit-agent (#9) | Raakt alleen `functions/discover` en één RPC; niemand anders zit daar | ⬜ wacht op akkoord (live deploy) |
| Overpass-ruis in `app_logs` (110 per week) | audit A6 | Audit-agent (#9) | Alleen `functions/pipeline/index.ts`; #4 en #5 raken die niet | ⬜ wacht op akkoord (live deploy) |
| Testtabellen `private.probe*` weg | specs open punt 10 | Patrick (SQL-editor) | Verwijderen vraagt bevestiging | ⬜ |
| Snapshot verversen naar 1.536 plekken | audit A5, #10 S5 en 0.5, #11 D3 | Sessie kernbelofte | Is er al mee bezig (`write_snapshot.py`) | 🔄 |

## 7. Werkafspraken voor alle agents

- Lees dit bord en `git log origin/main` vóór je begint. Staat je taak hier bij iemand anders, stuur die sessie een
  bericht in plaats van hem zelf te bouwen.
- Een migratie op de live database is een wijziging voor iedereen: zet hem altijd ook als bestand in
  `web/supabase/migrations/` op je branch en noem hem in de PR. Nu staan 11 live migraties alleen op niet-samengevoegde
  branches.
- Nieuwe open punten: voeg ze toe aan §5 van dit bord en pas bij het samenvoegen in `docs/specs/README.md`, zodat de
  nummers niet nog eens botsen.
- Rapporteer cijfers uit de live database, niet uit de snapshot.
