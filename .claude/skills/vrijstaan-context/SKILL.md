---
name: vrijstaan-context
description: Vaste feiten, regels en voorrang voor VrijStaan. Lees dit eerst bij elke taak aan de site, de data of het ontwerp, en kies hier welke skill of agent past. Alle andere skills verwijzen hiernaartoe; bij een conflict gaan CLAUDE.md, docs/specs/ en docs/stijlgids.md voor.
---

# VrijStaan: context voor skills en agents

Camperplaatsen in Nederland, met **vertrektijd** als kernfeit. Mobiel eerst (iPhone, 390 px), camperaars van 40+,
Nederlands eerst. Eigenaar: Patrick. Bijgewerkt 24 november 2026.

## Voorrang bij een conflict (hoog naar laag)

1. `CLAUDE.md` en `docs/specs/` (PRD, TRD, flow, UI-brief, schema, plan)
2. `docs/stijlgids.md` en skill `vrijstaan-stijl`
3. `PRODUCT.md` en `DESIGN.md` (samenvatting voor Impeccable, wijst terug naar 1 en 2)
4. Alle andere skills zijn naslag: Impeccable, ui-ux-pro-max, design-taste-frontend, minimalist-ui,
   high-end-visual-design, redesign-existing-projects, frontend-design, ponytail, agent-skills.
   Zeggen ze iets anders (ander lettertype, serif, gradients, glas, 3D, schuine lagen), dan negeer je dat.

## Vaste feiten

- Stack: Next.js 16.4 (App Router, `cacheComponents`), React 19, Tailwind 4 (tokens in `web/src/app/globals.css`),
  MapLibre, Supabase (Postgres, RLS, edge functions `pipeline` en `push`), Vercel. Lees `web/AGENTS.md`: Next 16 wijkt af.
- Code in `web/src/app` en `web/src/lib`, tests in `web/tests` (`npm test`) en `web/e2e` (Playwright), migraties in
  `web/supabase/migrations/`, dataverzamelaars in `tools/`.
- Controle vóór een push: `cd web && npm run check && VRIJSTAAN_OFFLINE=1 npm run build`.
- Branch: PR (concept) naar `acceptatie`; `main` gaat live en wordt door Patrick samengevoegd.
- Migraties pas live na samenvoegen van de bijbehorende code; wel altijd vastleggen in `web/supabase/migrations/`.

## Vaste regels

- Nooit data verzinnen: onbekend blijft leeg en toont "Onbekend".
- Vertrektijd is het kernfeit; prijzen altijd met alle toeslagen.
- Geen tracking van derden, geen cookies zonder toestemming.
- Teksten: je-vorm, geen gedachtestreepjes, geen middenpunten, geen hoofdletterlabels, geen verkooppraat (zie
  `vrijstaan-stijl`).
- Uiterlijk: Geist als enige lettertype, kleuren zandpapier, bosgroen, avondzon, meerblauw, randen van 1 px,
  hoeken maximaal 8 px, tikdoelen 44 px, contrast 4,5:1, licht en donker.
- Wijzigt code een document? Werk het document in dezelfde commit bij (status in `06-implementatieplan.md`).

## Welke skill of agent wanneer

| Taak | Gebruik | Let op |
|---|---|---|
| Zichtbare tekst of uiterlijk | `vrijstaan-stijl`, `docs/stijlgids.md` | Altijd eerst |
| Bestaande pagina beoordelen | Impeccable `critique` en `audit`, daarna `web-design-guidelines` | Rapporteer; pas niets toe dat de stijlgids tegenspreekt |
| Nieuw scherm ontwerpen | Impeccable `shape`, dan `ui-ux-pro-max` voor patronen | Palet en lettertype staan vast |
| Laatste poets | Impeccable `polish`, `harden`, `adapt`, `clarify` | Geen `bolder` of `colorize`: kleur betekent iets |
| Toegankelijkheid | `frontend-a11y`, agent `a11y-architect` | WCAG 2.2, 44 px |
| Pagina bekijken op telefoon | `playwright-cli` (`open --mobile`, `resize 375 812`) | Licht en donker |
| Code vinden | `graphify query` vóór grep | `graphify update .` na wijzigingen |
| Bouwen | ponytail (kleinste oplossing) met `tdd-workflow` | Agent-skills `spec`, `plan`, `build` alleen bij grote functies |
| Bug | `orch-fix-defect` | Eerst falende test |
| Database | `database-migrations`, `postgres-patterns`, agent `database-reviewer` | Op auth, RLS, migraties ook `security-reviewer` |
| Review | agent `code-reviewer`, één ronde | Zie CLAUDE.md voor de orchestratie |
| SEO | `seo`, agent `seo-specialist` | Geen verzonnen data in structured data |
