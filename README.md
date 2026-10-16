# VrijStaan

Camperplaatsen in Nederland zoeken, vergelijken en een reis plannen: een booking-achtige gids voor camperaars,
gebouwd voor de telefoon (installeerbaar als app), met per plek of je zonder vaste vertrektijd kunt staan en alleen
echte data met bron.

| Map | Wat |
|---|---|
| [`web/`](web) | De website en app (Next.js 16, React 19, Tailwind 4, MapLibre) inclusief beheeromgeving op `/admin` |
| [`web/supabase/`](web/supabase) | Database (`schema.sql`, `seed.sql`) en de data-pipeline (edge function `pipeline`) |
| [`docs/specs/`](docs/specs) | **De zes basisdocumenten**: PRD, TRD, app flow, design brief, backend schema, implementatieplan |
| [`docs/HANDLEIDING.md`](docs/HANDLEIDING.md) | Stap voor stap: lokaal draaien, online zetten, beheer, data-pipeline |
| [`docs/onderzoek.md`](docs/onderzoek.md) | Doelgroep- en marktonderzoek (booking.com, trivago, park4night, ACSI, NKC) |
| [`docs/design.md`](docs/design.md) | Ontwerpsysteem "natuur & vrijheid" |

Snel starten: `node start.mjs` in de map van de repo. Dat installeert de pakketten als dat nodig is, start de
server en opent de browser. In VS Code kan het ook via *Terminal → Run Build Task* (Ctrl+Shift+B). Met de hand:

```bash
cd web
npm install
npm run dev     # http://localhost:3000, gebruikt direct de live Supabase-database
```
