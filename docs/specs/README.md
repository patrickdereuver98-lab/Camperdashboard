# VrijStaan: de zes basisdocumenten

Deze zes documenten beschrijven wat VrijStaan is en hoe het gebouwd wordt. Ze zijn het vaste referentiepunt voor
iedereen die aan de site werkt, mens of AI-agent. Bij twijfel of tegenstrijdigheid gaan deze documenten voor; past de
code niet bij de documenten, dan is dat een open punt (zie onder).

| # | Document | Waarvoor |
|---|---|---|
| 1 | [Product Requirements Document](01-PRD.md) | Wat het product moet doen en hoe we succes meten |
| 2 | [Technical Requirements Document](02-TRD.md) | Techniek, diensten, architectuur, beveiliging |
| 3 | [App Flow](03-app-flow.md) | Elk scherm, elk pad, wat elke tik doet |
| 4 | [UI en UX Design Brief](04-ui-ux-brief.md) | Wat er op welk scherm staat, componenten, toegankelijkheid; uiterlijk in de [stijlgids](../stijlgids.md) |
| 5 | [Backend Schema](05-backend-schema.md) | Tabellen, relaties, rechten, bewaartermijnen |
| 6 | [Implementatieplan](06-implementatieplan.md) | Mijlpalen en taken met status |

Verwante documenten: `docs/HANDLEIDING.md` (draaien, online zetten, beheren), `docs/design.md` (ontwerpdetails),
`docs/onderzoek.md` (vooronderzoek), `docs/review-2026-10.md` (review en wijzigingsplan, oktober 2026),
`docs/audit-2026-10.md` (audit 12 oktober), `docs/review/` (feature review), `docs/samenwerking.md` (hoe de PR's van
oktober zijn samengevoegd), `docs/stijlgids.md` (uiterlijk), `docs/draaiboek.md` (terugdraaien, back-up, bewaking) en
[`plan.md`](../../plan.md) (wat nog openstaat).

## Zo gebruik je ze

1. De **PRD** is leidend. Elke nieuwe functie begint daar: functie, user story, acceptatiecriteria.
2. Werk daarna de andere vijf bij waar nodig (flow, ontwerp, schema, techniek, planning).
3. Geef bij een grotere wijziging alle zes aan de AI-agent, vraag om tegenstrijdigheden te melden en los die op vóór
   er code wordt geschreven.
4. Houd de documenten actueel: een wijziging in code die een document onjuist maakt, past in dezelfde commit ook het
   document aan.

## Vaste spelregels (gelden altijd)

- **Data mag nooit verzonnen worden.** Alleen wat letterlijk in een bron staat; anders blijft het veld leeg en toont de
  site "Onbekend".
- **Vertrektijd is het belangrijkste feit.** De bronzin bewaren we in beheer en staat op de plekpagina klein onder de
  vertrekregel (besluit 19 oktober 2026); verder staat per pagina alleen "Laatste update: datum". Prijs is belangrijk, maar geen faalpunt.
- **Teksten klinken menselijk**: zie `.claude/skills/vrijstaan-stijl/SKILL.md` (geen gedachtestreepjes, geen
  hoofdletterlabels, geen verkooppraat).
- **Prijzen zo transparant mogelijk**: basisprijs plus alle losse toeslagen zoals de website ze noemt.
- **Mobiel eerst** (iPhone-formaat), 50-plussers, tikdoelen van minstens 44 px.
- **Kleuren "natuur & vrijheid"** blijven: zandpapier, bosgroen, avondzon, meerblauw, bosachtige donkere modus.
  Lettertype Geist, vormen en beweging volgens `docs/stijlgids.md` (besluit eigenaar 12 oktober 2026).
- **Nederlands eerst**; Engels en Duits later.
- **Geen cookies of tracking van derden**; statistieken alleen met toestemming.

## Gevonden tegenstrijdigheden en open punten (11 oktober 2026)

| # | Wat | Waar | Voorstel |
|---|---|---|---|
| 1 | Rol `support` bestaat, maar `is_admin()` geeft elke beheerder alle rechten | Schema, TRD | Besluiten wat support niet mag; policies per rol (Implementatieplan M2) |
| 2 | Privacyverklaring belooft bewaartermijnen die nog niet automatisch worden toegepast | Backend Schema, privacy | **Klaar om uit te voeren (15 oktober 2026):** `web/supabase/retention.sql` in de SQL-editor; tickets en contactgegevens zitten er nu in |
| 3 | `web/supabase/schema.sql` en de snapshot lopen achter op de live database | Backend Schema, TRD | Opnieuw genereren na de herscrape |
| 4 | ~~Publicatiedrempel~~ | PRD, site | **Opgelost (12 oktober 2026):** 0,45 na de herscrape. Elke plek heeft contact en 2 van 4 kernfeiten; dat geeft 1.509 plekken (bij 0,55: 1.277). Aantal plekken is de prioriteit van de eigenaar. Aan te passen in Beheer → Instellingen |
| 5 | ~~Hoe streng met vertrektijden~~ | PRD open vraag 1 | **Opgelost:** aparte pagina's Zonder vertrektijd, Uitslapers, Overige; websitefoto's overal aan |
| 6 | Vercel Hobby is niet-commercieel; verdienmodel nog onbekend | TRD, PRD | Bij inkomsten overstappen op Vercel Pro |
| 7 | Bedrijfsgegevens ontbreken op privacy, voorwaarden en disclaimer | Release | Invullen in `web/src/lib/company.ts` |
| 8 | Reviews: formulier belooft nog geen foto's ("binnenkort") | App Flow, PRD | Fase B (Implementatieplan M4). De vertrektijdvraag staat sinds 15 oktober 2026 in het formulier |
| 9 | `/zoeken?waar=<onbekend>` toont het hele land met die plaatsnaam | App Flow | **Opgelost (16 oktober 2026):** kop "in Nederland" met de melding dat de plaats onbekend is |
| 10 | Testtabellen `private.probe` en `private.probe2` staan nog in de database | Backend Schema | Verwijderen |
| 11 | Kop van de startpagina is een tekening; een echte sfeerfoto vraagt een foto met vrije licentie of eigen foto | UI/UX Brief | Foto aanleveren (eigen of Wikimedia Commons, CC BY/CC0) en in `web/public/` zetten met bronvermelding |
| 12 | Implementatieplan noemt beheeraccounts klaar, maar live bestaan 0 gebruikers en 0 beheerders (15 oktober 2026) | Implementatieplan M2, live database | Account aanmaken zodra Vercel gekoppeld is ([review](../review-2026-10.md) 0.7) |
| 13 | Backend Schema noemt `schema.sql` de basis voor een nieuw project, maar het bestand mist alle `REVOKE`s, de controle op `email_confirmed_at` en ongeveer tien live tabellen | Backend Schema, TRD | Overstappen op migraties ([review](../review-2026-10.md) 2.1); tot dan geen nieuw project uit `schema.sql` opzetten |
| 14 | ~~Header volgt de app flow niet~~ | App Flow, `chrome.tsx` | **Opgelost (15 oktober 2026):** code aangepast aan de app flow (+ en Hulp op mobiel, Hulp op desktop) |
| 15 | ~~Stille terugval op de snapshot bij elke Supabase-fout~~ | TRD, `lib/places.ts` | **Deels opgelost (15 oktober 2026):** alleen nog bij netwerk- en serverfouten; een 4xx gaat door. Nog open: zichtbaar maken op de site dat de snapshot wordt getoond |
| 16 | Brief zei basis 17 px; eigenaar vond de telefoonweergave te druk | UI/UX Brief | **Opgelost (12 okt):** 16 px op de telefoon, 17 px vanaf tablet, kleinere koppen, beslisblok |
| 17 | "Over deze plek" is de meta-omschrijving van de website: vaak afgekapt ("Lees meer"), soms Duits of een prijslijst | Backend Schema, scraper | Site en scraper (v17) gebruiken dezelfde regels (`description.ts`); de scraper leest ook de eerste alinea's van de pagina. Nog open: eigenaren hun eigen tekst laten schrijven (claim, M4) |
| 18 | Foto's: 448 plekken met WordPress-miniaturen, keurmerken (SVR, Zoover) als eerste foto | Scraper, UI/UX Brief | **Opgelost (12 okt):** site en scraper (v17) gebruiken `photos.ts`; de site vraagt de grote versie op |
| 19 | Brief en vaardigheden zeiden "thema staat vast, Fraunces + Inter"; eigenaar vond de site "te AI, te kinderlijk, niet professioneel" | UI/UX Brief, `vrijstaan-stijl` | **Opgelost (12 okt):** kleuren blijven, typografie (Geist), hoeken, schaduw, iconen en beweging volgens de nieuwe `docs/stijlgids.md` |
| 20 | Strikte OSM-toelating (alleen `caravan_site` of `motorhome=yes`) zou ~900 gepubliceerde campings zonder die tag niet meer verversen | PRD (aantal plekken), opdracht 12 okt | **Besloten (16 oktober 2026): nee.** Zoveel mogelijk plekken gaat voor; de strikte toelating staat niet live. Was: besluit Patrick vóór het live zetten van de query en de edge function |
| 21 | ~~PRD: geen accounts voor bezoekers~~ | PRD, TRD | **Gewijzigd 12 okt:** accounts optioneel (opdracht Patrick); zonder account werkt alles |
| 22 | Opdracht Fase 6 (advertenties) botst met PRD "geen advertenties en tracking van derden" en het Vercel Hobby-plan | PRD, TRD | **Besloten (16 oktober 2026): geen advertenties.** Was: besluit Patrick vóór Fase 6; alleen advertenties zonder tracking/cookies passen bij de spelregels |
| 23 | Implementatieplan noemde foto-upload via het reviewformulier (max. 5); gebouwd is een losse knop "Foto toevoegen" per plek | Implementatieplan M4 | Reviewformulier later koppelen aan dezelfde `place_photos` |
| 24 | Live drukte is door gebruikers gemeld, geen feit uit een bron | Spelregel "nooit verzinnen" | Altijd tonen als melding met aantal en tijdstip; niets tonen zonder meldingen van de laatste 3 uur |
| 25 | Pushmeldingen lopen via de pushdienst van de browser (Google, Apple, Mozilla) | Spelregel "geen tracking van derden" | Alleen na toestemming, geen inhoud buiten de melding; vermelden in de privacyverklaring |
| 26 | Opdracht: camper-afmetingen "gekoppeld aan auto-filters"; plekken hebben alleen een bekende maximale lengte, geen hoogte of gewicht | Backend Schema | Alleen op lengte filteren; hoogte en gewicht bewaren voor later (bv. als OSM `maxheight`/`maxweight` wordt meegenomen) |
| 27 | Opdracht: "off-grid ratio" in reisstatistieken; plekken kennen geen "off-grid", alleen stroom ja/nee/onbekend | Spelregel "nooit verzinnen" | Getoond als "Zonder stroom": aandeel nachten zonder stroomaansluiting, alleen over nachten waarvan het bekend is; onbekend apart |
| 28 | Toegankelijkheidsverklaring noemt WCAG 2.2, ≥ 17 px tekst en ≥ 44 × 44 tikdoelen; de code heeft 12 px tekst, 36 px chips en ±12 px markers | UI/UX Brief, toegankelijkheid | **Opgelost (16 oktober 2026):** verklaring noemt WCAG 2.1 AA als doel en de bekende beperkingen; de herstelpunten staan in `plan.md` P13 |
| 29 | Startpagina belooft prijzen met alle toeslagen; live staan toeslagen bij ±965 plekken, maar de snapshot heeft ze niet en Mijn reis telt ze niet mee | PRD, home | `plan.md` P7 (nummering volgt het bord in `docs/samenwerking.md`) |
| 33 | Websites worden maar één keer gelezen (`enqueue_scrape(true)` plant alleen plekken zonder `last_scraped_at`), terwijl de handleiding een "volgende controle" belooft | HANDLEIDING §6, pipeline | **Opgelost (16 oktober 2026):** cron `scrape-refresh` leest elke website eens per 30 dagen opnieuw (`migrations/20261016200000_opnieuw_lezen.sql`). Nummer 33: 12 tot en met 32 zijn uitgedeeld op het samenwerkingsbord (PR #9, §5) |
| 34 | Kernbelofte (#12) zette niet-bevestigde plekken bij Overige; live was er nog geen enkele bevestiging, dus Zonder vertrektijd zou leeg zijn | App Flow, `search.ts` | **Gewijzigd (16 oktober 2026, eigenaar):** kandidaten staan op Zonder vertrektijd onder de bevestigde plekken, met het label "nog niet bevestigd"; groen alleen na bevestiging. **Gewijzigd (18 oktober 2026, eigenaar):** een bron is genoeg bevestiging; geen label meer. Vrij en per 24 uur uit website, zoekagent of OSM staan in groen op Zonder vertrektijd; alleen afgewezen is onbekend en voorwaardelijk staat bij Overige |
| 35 | Agents en skills uit Everything Claude Code gaan uit van Engels, Conventional Commits en eigen documenten (CODEMAP) | CLAUDE.md, stijlgids | **Besloten (18 oktober 2026):** naslag; CLAUDE.md, `docs/specs/` en de stijlgids gaan voor (zie `.claude/skills/BRONNEN.md`) |
| 36 | PRD en spelregels: bronzin alleen in beheer; de plekpagina toont "Volgens de website…" met de zin, en `timesNote` gaat naar de browser | PRD, UI/UX Brief, plekpagina | **Besloten (19 oktober 2026, eigenaar):** mag blijven, klein. De plekpagina toont de bronzin in 14 px, gedempt, onder de vertrekregel ("Bron: “…” (website)"); PRD, UI/UX Brief en spelregel bijgewerkt |
| 37 | PRD noemt 1.509 gepubliceerde plekken; live zijn het er 1.924 (18 oktober 2026) | PRD | PRD bijwerken bij de volgende herziening |
| 38 | Standaarddrempel als de instelling ontbreekt: 0,7 in de trigger `places_before_write`, 0,8 in `private.publish_threshold()`; `apply-threshold` telt de verplichte velden niet mee | Backend Schema | Overal `publish_threshold()` en `place_meets_must_haves` (datareview stap 5) |
| 39 | Backend Schema noemt de soort `parkeerplaats`, maar alle 15 staan op concept | Backend Schema | Bekijken bij de dekkingsronde; geen wijziging nodig zolang ze niet aan de eisen voldoen |
| 40 | App Flow: op Zonder vertrektijd staan bevestigde plekken "bovenaan". Sinds datareview stap 4 houdt elke sortering de gekozen volgorde voorop; bevestigd is bij Afstand en Prijs alleen de tweede sleutel (bij gelijke stand), dus niet altijd bovenaan | App Flow, `search.ts` | **Vervalt grotendeels (18 oktober 2026):** na het besluit bij nummer 34 is er geen zichtbaar verschil meer tussen bevestigd en bron; "bovenaan" is uit de app flow gehaald. Bevestigd blijft alleen de tweede sorteersleutel. Oorspronkelijk voorstel (bevestigd als eerste sleutel op Zonder vertrektijd) is niet meer nodig |
