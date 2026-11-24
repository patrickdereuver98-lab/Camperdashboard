# Design-skills: bronnen en voorrang

Deze skills zijn op 12 oktober 2026 toegevoegd als naslag voor ontwerp en code (verzoek eigenaar). Ze zijn
algemeen geschreven; **bij een conflict gaan `docs/stijlgids.md` en `vrijstaan-stijl` altijd voor** (bijvoorbeeld:
wij houden onze kleuren, minimaal 16 px tekst en 44 px tikdoelen, geen enorme witruimte, Nederlandse teksten).

| Map | Bron | Licentie |
|---|---|---|
| `design-taste-frontend` | github.com/leonxlnx/taste-skill (`skills/taste-skill`, commit d237dd3) | MIT |
| `minimalist-ui` | idem (`skills/minimalist-skill`) | MIT |
| `high-end-visual-design` | idem (`skills/soft-skill`) | MIT |
| `redesign-existing-projects` | idem (`skills/redesign-skill`) | MIT |
| `ui-ux-pro-max` | github.com/nextlevelbuilder/ui-ux-pro-max-skill (commit 7246805) | MIT |
| `vercel-react-best-practices` | github.com/vercel-labs/agent-skills (`skills/react-best-practices`, commit 063bee9) | MIT |
| `web-design-guidelines` | idem (`skills/web-design-guidelines`) | zie bron |

Zoeken in ui-ux-pro-max vanuit de hoofdmap van de repository:
`python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<zoekterm>" --domain ux` (of `--design-system`).

## Everything Claude Code (ECC): agents en werk-skills

Op 18 oktober 2026 toegevoegd (verzoek eigenaar): een selectie uit github.com/affaan-m/everything-claude-code
(commit 76aaa77, MIT). Niet alles: het origineel heeft 71 agents en 311 skills, de meeste voor talen en
diensten die wij niet gebruiken, en elke skill kost ruimte in elke sessie. Bewust **niet** overgenomen: de
hooks (draaien code bij elke actie), de plug-in-installer en `security-scan` (installeert een npm-pakket
wereldwijd). `security-review` is weggelaten omdat de ingebouwde `/security-review` zo heet.

- Agents in `.claude/agents/`: planner, architect, code-explorer, code-reviewer, security-reviewer, database-reviewer, silent-failure-hunter, pr-test-analyzer,
  build-error-resolver, react-build-resolver, tdd-guide, e2e-runner, a11y-architect, performance-optimizer,
  seo-specialist, refactor-cleaner.
- Skills hierboven in deze map: tdd-workflow, verification-loop, postgres-patterns, database-migrations,
  nextjs-turbopack, react-patterns, e2e-testing, frontend-a11y, search-first, seo, data-scraper-agent,
  codebase-onboarding, plan-orchestrate, dev-team, team-agent-orchestration.

Ze zijn Engelstalig en algemeen. **CLAUDE.md, `docs/specs/` en de stijlgids gaan voor** (Nederlandse teksten en
commits, nooit data verzinnen, controle met `npm run check`). Bijwerken: kopieer de map opnieuw uit een nieuwere
commit en pas het commitnummer hier aan.

**Eigen aanpassingen (19 november 2026, verzoek eigenaar):** `model:` en `effort:` per agent volgen de
orchestratieregels in `CLAUDE.md`. `typescript-reviewer` en `react-reviewer` zijn opgegaan in `code-reviewer`
(één review-ronde in plaats van drie overlappende). "Use PROACTIVELY" en "MUST BE USED" zijn uit de
beschrijvingen gehaald, zodat agents alleen starten als de hoofdsessie daarvoor kiest. Haal je de map opnieuw op,
zet deze aanpassingen dan terug.
## ECC-commando's (orch-familie)

Op 16 november 2026 toegevoegd (verzoek eigenaar, voor `plan-orchestrate`): uit github.com/affaan-m/everything-claude-code
(commit d2ef268, MIT).

- Commando's in `.claude/commands/`: `orch-add-feature`, `orch-fix-defect`, `orch-change-feature`,
  `orch-refine-code`, `plan`, `build-fix`, `test-coverage`, `update-docs`.
- Skills in deze map: `orch-pipeline` (de gedeelde motor) en `orch-add-feature`, `orch-fix-defect`,
  `orch-change-feature`, `orch-refine-code`.
- Bewust **niet** overgenomen: `code-review` (botst met de ingebouwde `/code-review`), `security-scan` (installeert een
  npm-pakket wereldwijd, zie hierboven), `loop-start` (botst met de ingebouwde `/loop`), `orch-build-mvp` (leunt op
  gan-agents die we niet hebben).
- Het zijn alleen instructies, zonder scripts of hooks. De orch-commando's stoppen twee keer voor goedkeuring: na het
  plan en vóór de commit. Ze noemen Engelse "conventional commits" en `rules/common/*`, die hier niet bestaan:
  **CLAUDE.md gaat voor** (Nederlandse commits, PR naar `acceptatie`, `npm run check` en een offline build vóór een push,
  migraties pas live na samenvoegen).

## Orchestrator (Fable stuurt, Sonnet voert uit)

Op 16 november 2026 toegevoegd (verzoek eigenaar): profiel `Claude-FableMedium-SonnetMax` uit
github.com/rajatmshukla/claude-opus-sonnet-orchestrator (commit d5894f8, Apache 2.0, licentie in
`opus-orchestrator/LICENSE`). Niet met de installer, maar met de hand:

- Agents in `.claude/agents/`: `explorer`, `worker`, `tester`, `researcher` (Sonnet, denkstand max) en `reviewer`
  (Fable, alleen lezen). Skill `opus-orchestrator` in deze map.
- `.claude/settings.json` is **samengevoegd**, niet vervangen: de vaste rechten blijven. Erbij: `model: fable`,
  `effortLevel: medium`, subagents op Sonnet, en **2** agents tegelijk in plaats van 4 (gebruikslimiet; de review van
  november liep twee keer vast). Hun `sandbox`-instelling en `defaultMode` zijn niet overgenomen.
- Hun projectregels staan als één punt in `CLAUDE.md`; CLAUDE.md en `docs/specs/` gaan voor.
- **19 november 2026 (release 0.9.1):** gelijkgetrokken met de orchestratieregels van 19 november. `model: fable`,
  `effortLevel` en `CLAUDE_CODE_SUBAGENT_MODEL` uit `.claude/settings.json` gehaald (die overschreven de keuze per agent);
  `explorer` op Haiku (low), `worker`, `tester` en `researcher` op Sonnet (medium), `reviewer` op Opus (medium).

## /brag (launch-video's)

Op 2 november 2026 toegevoegd (verzoek eigenaar, marketingplan `docs/marketing/plan.md` §3.4):
`brag-slim` uit github.com/latent-spaces/brag (commit 669ab92, MIT, licentie in de map). Eén bestand, zonder
meegeleverde muziek of Hyperframes. Huisregels die voorgaan staan in `.claude/skills/brag-slim/VRIJSTAAN.md`.
De volledige `/brag` (met Hyperframes en muziek, ±20 MB) is bewust niet overgenomen; de Studio in het dashboard
gebruikt dezelfde werkwijze (HTML met tijdlijn, Chromium, ffmpeg) zonder extra pakket.

## Ponytail, graphify en agent-skills

Op 24 november 2026 toegevoegd (verzoek eigenaar: "gebruik ze vanaf nu overal en altijd"):

- **ponytail** (github.com/DietrichGebert/ponytail, MIT): als plugin via `extraKnownMarketplaces` en `enabledPlugins` in
  `.claude/settings.json`. Laadt bij elke sessie de "bouw het simpelste dat werkt"-regels (hooks in Node).
- **agent-skills** (github.com/addyosmani/agent-skills): als plugin, marketplace `addy-agent-skills`, in dezelfde
  instelling. Let op: de commando's `/spec`, `/plan`, `/build`, `/test`, `/review` en `/ship` botsen soms met
  ingebouwde of bestaande namen; gebruik dan `/agent-skills:<naam>`.
- **graphify** (github.com/Graphify-Labs/graphify, pakket `graphifyy` via `uv tool install graphifyy`): projectinstallatie
  met `graphify install --project`. Gaf `.claude/skills/graphify/`, hooks in `.claude/settings.json` en een blok in
  `CLAUDE.md`. In een nieuwe omgeving eerst `uv tool install graphifyy`, daarna `/graphify .`.
- CLAUDE.md en `docs/specs/` gaan bij een conflict voor.
