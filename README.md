# VrijStaan

Camperplaatsen in Nederland zoeken, vergelijken en een reis plannen: een booking-achtige gids voor camperaars,
gebouwd voor de telefoon (installeerbaar als app) en met alleen echte, gecontroleerde data.

| Map | Wat |
|---|---|
| [`web/`](web) | De website en app (Next.js 16, React 19, Tailwind 4, MapLibre) inclusief beheeromgeving op `/admin` |
| [`web/supabase/`](web/supabase) | Database (`schema.sql`, `seed.sql`) en de data-pipeline (edge function `pipeline`) |
| [`docs/HANDLEIDING.md`](docs/HANDLEIDING.md) | Stap voor stap: lokaal draaien, online zetten, beheer, data-pipeline |
| [`docs/onderzoek.md`](docs/onderzoek.md) | Doelgroep- en marktonderzoek (booking.com, trivago, park4night, ACSI, NKC) |
| [`docs/design.md`](docs/design.md) | Ontwerpsysteem "Wegwijzer" |

Snel starten:

```bash
cd web
npm install
npm run dev     # http://localhost:3000, gebruikt direct de live Supabase-database
```
