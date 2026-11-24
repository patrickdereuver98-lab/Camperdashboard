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
4. Alle andere skills zijn naslag, geordend in de hiërarchie hieronder.
   Zeggen ze iets anders (ander lettertype, serif, gradients, glas, 3D, schuine lagen), dan negeer je dat.

## Hiërarchie van skills (bindend, standaard, naslag)

Per groep: **bindend** gaat altijd voor en geldt zonder vraag; **standaard** gebruik je uit jezelf als de taak erom
vraagt; **naslag** gebruik je alleen op verzoek of als de andere twee niets zeggen.

| Groep | Bindend | Standaard | Naslag |
|---|---|---|---|
| Ontwerp en tekst | `docs/stijlgids.md`, `vrijstaan-stijl` | Impeccable (`critique`, `audit`, `polish`, `harden`, `adapt`, `clarify`), `ui-ux-pro-max`, `web-design-guidelines` | `design-taste-frontend`, `minimalist-ui`, `high-end-visual-design`, `redesign-existing-projects`, `frontend-design` |
| Bouwen | `CLAUDE.md`, `docs/specs/` | ponytail, `react-patterns`, `nextjs-turbopack`, `vercel-react-best-practices` | agent-skills (`spec`, `plan`, `build`), `search-first` |
| Testen en controle | `npm run check` en offline build | `tdd-workflow`, `verification-loop`, `playwright-cli` | `e2e-testing`, agent `tdd-guide`, agent-skills `test-driven-development` |
| Data en database | specs 02 en 05, `database-migrations` | `postgres-patterns`, agent `database-reviewer` | `data-scraper-agent` |
| Orkestratie | regels in `CLAUDE.md` | `orch-add-feature`, `orch-fix-defect`, `orch-change-feature`, `orch-refine-code` | `opus-orchestrator`, `plan-orchestrate`, `team-agent-orchestration`, `dev-team` |
| Zoeken en onderhoud | n.v.t. | `graphify` | `codebase-onboarding` |

Staat een skill of agent hier niet in, meld hem dan eerst aan Patrick en gebruik hem niet uit jezelf.

## Werkvolgorde en modellen (volgt `CLAUDE.md`, orchestratie)

De hoofdsessie is de orchestrator: Opus, effort high (xhigh bij een lastige functie). Zij plant, beslist en bouwt zelf.
Een agent begint zonder context; taken tot ongeveer drie bestanden doe je dus zelf. Hoogstens 2 agents tegelijk, nooit
twee workers in dezelfde bestanden.

| # | Stap | Wie en welk model | Skill of hulpmiddel |
|---|---|---|---|
| 1 | Lezen en tegenstrijdigheden melden | hoofdsessie | `docs/specs/`, noteer in `docs/specs/README.md` |
| 2 | Code vinden | hoofdsessie; veel bestanden: `code-explorer` of `explorer` (Haiku, low) | `graphify query` vóór grep |
| 3 | Plannen | hoofdsessie; alleen bij een grote verbouwing `planner` of `architect` (Opus, high) | agent-skills `spec` en `plan` bij een grote functie |
| 4 | Ontwerp bij een scherm | hoofdsessie | `vrijstaan-stijl`, Impeccable `shape`, `ui-ux-pro-max` |
| 5 | Bouwen, test eerst | hoofdsessie; echt parallel werk: `worker` (Sonnet, medium) | ponytail, `tdd-workflow`, `orch-*` |
| 6 | Build- en typefouten | `build-error-resolver` of `react-build-resolver` (Sonnet, medium) | `build-fix` |
| 7 | Controle | hoofdsessie | `cd web && npm run check && VRIJSTAAN_OFFLINE=1 npm run build`, `npm test` |
| 8 | Pagina bekijken | hoofdsessie of `e2e-runner` (Sonnet, medium) | `playwright-cli`, Impeccable `critique` en `audit` |
| 9 | Review, één ronde | `code-reviewer` (Sonnet, medium); bij auth, RLS, migraties of persoonsgegevens ook `security-reviewer` en `database-reviewer` (Opus, medium) | `verification-loop` |
| 10 | Controlelijsten | `seo-specialist`, `a11y-architect`, `silent-failure-hunter`, `pr-test-analyzer` (Sonnet, low) | `seo`, `frontend-a11y` |
| 11 | Documenten bijwerken | hoofdsessie, in dezelfde commit | status in `06-implementatieplan.md`, schema, flow |
| 12 | Push en PR | hoofdsessie | concept-PR naar `acceptatie`; migratie pas live na samenvoegen |

Fable hebben we niet: loopt Opus vast, zet het effort op max of xhigh. De modellen en het effort per agent staan in de kop van
`.claude/agents/*.md`; wijkt een skill daarvan af (bijvoorbeeld `opus-orchestrator`), dan gaan de agentkoppen en
`CLAUDE.md` voor.

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
