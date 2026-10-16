# VrijStaan: de zes basisdocumenten

Deze zes documenten beschrijven wat VrijStaan is en hoe het gebouwd wordt. Ze zijn het vaste referentiepunt voor
iedereen die aan de site werkt, mens of AI-agent. Bij twijfel of tegenstrijdigheid gaan deze documenten voor; past de
code niet bij de documenten, dan is dat een open punt (zie onder).

| # | Document | Waarvoor |
|---|---|---|
| 1 | [Product Requirements Document](01-PRD.md) | Wat het product moet doen en hoe we succes meten |
| 2 | [Technical Requirements Document](02-TRD.md) | Techniek, diensten, architectuur, beveiliging |
| 3 | [App Flow](03-app-flow.md) | Elk scherm, elk pad, wat elke tik doet |
| 4 | [UI en UX Design Brief](04-ui-ux-brief.md) | Thema "natuur & vrijheid", componenten, toegankelijkheid |
| 5 | [Backend Schema](05-backend-schema.md) | Tabellen, relaties, rechten, bewaartermijnen |
| 6 | [Implementatieplan](06-implementatieplan.md) | Mijlpalen en taken met status |

Verwante documenten: `docs/HANDLEIDING.md` (draaien, online zetten, beheren), `docs/design.md` (ontwerpdetails),
`docs/onderzoek.md` (vooronderzoek), `docs/review-2026-10.md` (review en wijzigingsplan, oktober 2026).

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
- **Vertrektijd is het belangrijkste feit.** De bronzin bewaren we in beheer; op de site staat per pagina alleen
  "Laatste update: datum". Prijs is belangrijk, maar geen faalpunt.
- **Teksten klinken menselijk**: zie `.claude/skills/vrijstaan-stijl/SKILL.md` (geen gedachtestreepjes, geen
  hoofdletterlabels, geen verkooppraat).
- **Prijzen zo transparant mogelijk**: basisprijs plus alle losse toeslagen zoals de website ze noemt.
- **Mobiel eerst** (iPhone-formaat), 50-plussers, tikdoelen van minstens 44 px.
- **Thema "natuur & vrijheid"** blijft: zandpapier, bosgroen, avondzon, meerblauw, Fraunces en Inter, bosachtige
  donkere modus.
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
| 9 | `/zoeken?waar=<onbekend>` toont het hele land met die plaatsnaam | App Flow | Fix in M5 |
| 10 | Testtabellen `private.probe` en `private.probe2` staan nog in de database | Backend Schema | Verwijderen |
| 11 | Kop van de startpagina is een tekening; een echte sfeerfoto vraagt een foto met vrije licentie of eigen foto | UI/UX Brief | Foto aanleveren (eigen of Wikimedia Commons, CC BY/CC0) en in `web/public/` zetten met bronvermelding |
| 12 | Implementatieplan noemt beheeraccounts klaar, maar live bestaan 0 gebruikers en 0 beheerders (15 oktober 2026) | Implementatieplan M2, live database | Account aanmaken zodra Vercel gekoppeld is ([review](../review-2026-10.md) 0.7) |
| 13 | Backend Schema noemt `schema.sql` de basis voor een nieuw project, maar het bestand mist alle `REVOKE`s, de controle op `email_confirmed_at` en ongeveer tien live tabellen | Backend Schema, TRD | Overstappen op migraties ([review](../review-2026-10.md) 2.1); tot dan geen nieuw project uit `schema.sql` opzetten |
| 14 | ~~Header volgt de app flow niet~~ | App Flow, `chrome.tsx` | **Opgelost (15 oktober 2026):** code aangepast aan de app flow (+ en Hulp op mobiel, Hulp op desktop) |
| 15 | ~~Stille terugval op de snapshot bij elke Supabase-fout~~ | TRD, `lib/places.ts` | **Deels opgelost (15 oktober 2026):** alleen nog bij netwerk- en serverfouten; een 4xx gaat door. Nog open: zichtbaar maken op de site dat de snapshot wordt getoond |
