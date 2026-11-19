# VrijStaan: instructies voor AI-agents

Lees vóór elke wijziging de zes basisdocumenten in [`docs/specs/`](docs/specs/README.md). Ze zijn leidend:

1. [PRD](docs/specs/01-PRD.md): wat het product moet doen en hoe we succes meten
2. [TRD](docs/specs/02-TRD.md): techniek, diensten, architectuur, beveiliging
3. [App Flow](docs/specs/03-app-flow.md): schermen, paden, gevolgen van elke actie
4. [UI en UX Design Brief](docs/specs/04-ui-ux-brief.md): thema "natuur & vrijheid" (staat vast)
5. [Backend Schema](docs/specs/05-backend-schema.md): tabellen, rechten, bewaartermijnen
6. [Implementatieplan](docs/specs/06-implementatieplan.md): mijlpalen en taken met status

Werkwijze:
- Meld tegenstrijdigheden tussen een opdracht, de code en deze documenten vóór je bouwt, en noteer ze in
  `docs/specs/README.md`.
- Werk de documenten bij in dezelfde commit als de code die ze verandert (status in het implementatieplan, schema,
  flow).
- Vaste regels: nooit data verzinnen (onbekend blijft leeg), vertrektijd is het kernfeit, prijzen met alle toeslagen,
  mobiel eerst, Nederlands eerst, geen tracking van derden.
- Next.js 16 wijkt af van oudere kennis: lees `web/AGENTS.md`.
- Zichtbare tekst of uiterlijk aanpassen? Volg `docs/stijlgids.md` en de skill `vrijstaan-stijl`. De design-skills in
  `.claude/skills/` (design-taste-frontend, minimalist-ui, high-end-visual-design, redesign, ui-ux-pro-max, Vercel
  react-best-practices en web-design-guidelines) zijn naslag; bij een conflict gaan de stijlgids en `vrijstaan-stijl`
  voor (zie `.claude/skills/BRONNEN.md`).
- Agents en werk-skills uit Everything Claude Code staan in `.claude/agents/` en `.claude/skills/` (overzicht en
  herkomst in `.claude/skills/BRONNEN.md`). Gebruik ze als team (plannen, bouwen, reviewen); bij een conflict gaan
  deze instructies en `docs/specs/` voor.
- Orchestratie (modellen en agents): de hoofdsessie is de orchestrator. Zij plant, beslist en bouwt zelf, op Opus
  met effort high (xhigh bij lastige features). Een agent begint zonder context en leest alles opnieuw in, dus:
  - Kleine taken (tot ongeveer drie bestanden) doe je zelf, zonder agents.
  - Agents alleen voor zoekwerk over veel bestanden, voor werk dat echt parallel kan, of voor een review.
  - Zoeken en code in kaart brengen: `code-explorer` of Explore op Haiku (effort low).
  - Per wijziging hoogstens één review-ronde met `code-reviewer` (Sonnet, dekt ook TypeScript en React). Raakt
    de wijziging auth, RLS, migraties of persoonsgegevens, dan ook `security-reviewer` en/of `database-reviewer`
    (Opus, effort medium).
  - Uitvoerwerk (build-fouten, refactor, e2e, tests, performance) op Sonnet, effort medium. Controlelijsten (seo,
    a11y, silent-failure-hunter, pr-test-analyzer) op Sonnet, effort low.
  - `planner` en `architect` alleen bij grote verbouwingen over meerdere delen van de app.
  - Fable alleen als Opus echt vastloopt (twee keer de prijs). Kijk naar kosten per afgeronde taak, niet per
    aanroep. Model en effort per agent staan in de kop van `.claude/agents/*.md`.
- Controleer vóór een push: `cd web && npm run check && VRIJSTAAN_OFFLINE=1 npm run build`.
- Edge functions uitrollen, migraties toepassen (`apply_migration`) en SQL uitvoeren (`execute_sql`) in Supabase mag
  altijd zonder eerst toestemming te vragen (besluit Patrick, 18 oktober 2026, herhaald 22 oktober: "100% toegang,
  nooit meer vragen"). Dit geldt voor elke sessie en elke agent; vraag het ook niet opnieuw in een andere sessie. De
  toestemming staat in `.claude/settings.json`. Een migratie die bij nieuwe code hoort, pas je pas live toe als die
  code samengevoegd is, zodat de live site niet breekt. Test eerst (`npm test`), leg elke migratie vast in `web/supabase/migrations/`, en vermeld een
  nieuwe edge-functieversie in het implementatieplan. Ook MCP-servers aansluiten en skills installeren mag zonder
  vragen (zelfde besluit); noteer wat je toevoegt in `.claude/skills/BRONNEN.md`.
- Skill `opus-orchestrator` (16 november 2026) en de agents `explorer`, `worker`, `tester`, `researcher` en
  `reviewer` volgen de orchestratieregels hierboven (19 november): Opus stuurt, geen Fable als standaard. Hoogstens 2
  agents tegelijk (`.claude/settings.json`); nooit twee workers in dezelfde bestanden (herkomst in
  `.claude/skills/BRONNEN.md`).
