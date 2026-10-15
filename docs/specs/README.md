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
`docs/onderzoek.md` (vooronderzoek).

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
| 2 | Privacyverklaring belooft bewaartermijnen die nog niet automatisch worden toegepast | Backend Schema, privacy | `web/supabase/retention.sql` uitvoeren; tickets toevoegen |
| 3 | `web/supabase/schema.sql` en de snapshot lopen achter op de live database | Backend Schema, TRD | Opnieuw genereren na de herscrape |
| 4 | ~~Publicatiedrempel~~ | PRD, site | **Opgelost (12 oktober 2026):** 0,45 na de herscrape. Elke plek heeft contact en 2 van 4 kernfeiten; dat geeft 1.509 plekken (bij 0,55: 1.277). Aantal plekken is de prioriteit van de eigenaar. Aan te passen in Beheer → Instellingen |
| 5 | ~~Hoe streng met vertrektijden~~ | PRD open vraag 1 | **Opgelost:** aparte pagina's Zonder vertrektijd, Uitslapers, Overige; websitefoto's overal aan |
| 6 | Vercel Hobby is niet-commercieel; verdienmodel nog onbekend | TRD, PRD | Bij inkomsten overstappen op Vercel Pro |
| 7 | Bedrijfsgegevens ontbreken op privacy, voorwaarden en disclaimer | Release | Invullen in `web/src/lib/company.ts` |
| 8 | Reviews: formulier belooft nog geen foto's en vertrektijdvraag ("binnenkort") | App Flow, PRD | Fase B (Implementatieplan M4) |
| 9 | `/zoeken?waar=<onbekend>` toont het hele land met die plaatsnaam | App Flow | Fix in M5 |
| 10 | Testtabellen `private.probe` en `private.probe2` staan nog in de database | Backend Schema | Verwijderen |
| 11 | Kop van de startpagina is een tekening; een echte sfeerfoto vraagt een foto met vrije licentie of eigen foto | UI/UX Brief | Foto aanleveren (eigen of Wikimedia Commons, CC BY/CC0) en in `web/public/` zetten met bronvermelding |
| 12 | Toegankelijkheidsverklaring noemt WCAG 2.2, ≥ 17 px tekst en ≥ 44 × 44 tikdoelen; de code heeft 12 px tekst, 36 px chips en ±12 px markers | UI/UX Brief, toegankelijkheid | Verklaring laten kloppen; herstel in `plan.md` fase 1 en P13 |
| 13 | Startpagina belooft prijzen met alle toeslagen; het veld met toeslagen ontbreekt in de data | PRD, home | `plan.md` P7 |
