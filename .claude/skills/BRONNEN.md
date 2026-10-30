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

- Agents in `.claude/agents/`: planner, architect, code-explorer, code-reviewer, typescript-reviewer,
  react-reviewer, security-reviewer, database-reviewer, silent-failure-hunter, pr-test-analyzer,
  build-error-resolver, react-build-resolver, tdd-guide, e2e-runner, a11y-architect, performance-optimizer,
  seo-specialist, refactor-cleaner.
- Skills hierboven in deze map: tdd-workflow, verification-loop, postgres-patterns, database-migrations,
  nextjs-turbopack, react-patterns, e2e-testing, frontend-a11y, search-first, seo, data-scraper-agent,
  codebase-onboarding, plan-orchestrate, dev-team, team-agent-orchestration.

Ze zijn Engelstalig en algemeen. **CLAUDE.md, `docs/specs/` en de stijlgids gaan voor** (Nederlandse teksten en
commits, nooit data verzinnen, controle met `npm run check`). Bijwerken: kopieer de map opnieuw uit een nieuwere
commit en pas het commitnummer hier aan.

## brag-slim: korte lanceervideo

Op 30 oktober 2026 toegevoegd (verzoek eigenaar): `brag-slim` uit github.com/latent-spaces/brag
(`skills/brag-slim`, commit 669ab92, MIT). Maakt van het project een video van ongeveer 20 seconden met muziek
en deeltekst, met alleen gereedschap dat al op de machine staat (Playwright, ffmpeg). De volledige `/brag` (met
Hyperframes en meegeleverde muziek) is niet overgenomen. Uitvoer komt in `brag-output/` en hoort niet in git.
Ook hier gaan de stijlgids en `vrijstaan-stijl` voor bij zichtbare tekst.
