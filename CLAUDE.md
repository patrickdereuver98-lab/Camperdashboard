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
- Controleer vóór een push: `cd web && npm run check && VRIJSTAAN_OFFLINE=1 npm run build`.
- Edge functions (Supabase) uitrollen mag altijd zonder eerst toestemming te vragen (besluit Patrick, 18 oktober 2026);
  de toestemming staat in `.claude/settings.json`. Test eerst (`npm test`), en vermeld de nieuwe versie in het implementatieplan.
