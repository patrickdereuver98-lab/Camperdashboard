# VrijStaan web

Next.js 16 (App Router, Cache Components, Partial Prerendering), React 19, Tailwind CSS 4, MapLibre GL 5,
motion en Supabase. Mobile-first en installeerbaar als PWA.

## Commando's

```bash
npm install
npm run dev        # ontwikkelserver op http://localhost:3000
npm run check      # ESLint + TypeScript
npm run build      # productiebuild (prerendert alle gepubliceerde plekken)
npm start          # productieserver
```

Zonder internet (bijvoorbeeld in CI) bouwen met de meegeleverde snapshot: `VRIJSTAAN_OFFLINE=1 npm run build`.

## Structuur

| Pad | Wat |
|---|---|
| `src/app/(site)/` | Publieke pagina's: start, zoeken, plek, dichtbij, mijn reis, provincies, FAQ, contact, support, juridisch |
| `src/app/admin/` | Beheeromgeving (client-side, Supabase Auth + RLS) |
| `src/app/api/` | `places`, `towns`, `route` (echte route), `distances` (rijtijdenmatrix) |
| `src/components/` | UI: `sign.tsx` (pictogrammen), `place-ui.tsx`, `place-map.tsx`, `sheet.tsx`, `filter-sheet.tsx`, chrome |
| `src/lib/` | Data (`places.ts`), zoeken en filters (`search.ts`), routes (`routing.ts`), opslag op het toestel (`store.ts`) |
| `src/data/snapshot.json` | Kopie van de data voor offline bouwen en als vangnet als Supabase onbereikbaar is |
| `public/sw.js` | Service worker: app-shell, eerder bekeken pagina's en kaarttegels offline |
| `supabase/schema.sql` | Volledige databasestructuur, functies, RLS en cron-jobs |
| `supabase/seed.sql` | Startgegevens (instellingen, FAQ, provincies, woonplaatsen, Overpass-sjablonen) |
| `supabase/functions/pipeline/` | Edge function: OpenStreetMap-import en website-scraper |
| `supabase/functions/push/` | Edge function: pushmeldingen (test: `deno test push/notify_test.ts`, zie de kop van dat bestand) |
| `supabase/migrations/` | Losse wijzigingen na `schema.sql`, in volgorde uit te voeren (bovenaan staat of ze live al zijn toegepast) |
| `e2e/`, `tests/` | Playwright-tests (`npm run test:e2e`, na `npm run build:offline`) en unit tests (`npm run test:unit`). `e2e/a11y.spec.ts` controleert WCAG 2.1 AA met axe (licht en donker), tekst ≥ 14 px en tikdoelen ≥ 44 px |

## Data

Alle plekken komen uit OpenStreetMap en worden aangevuld met feiten van de eigen website van de plek.
Er wordt niets geschat of verzonnen: een veld zonder bron blijft leeg en de site toont "onbekend".
Een plek gaat pas online als er contact is, minstens twee van prijs/openingsperiode/stroom bekend zijn en de
gewogen score minstens 70% is (instelbaar in `/admin/instellingen`, uitleg in de handleiding).
Meer uitleg: [`../docs/HANDLEIDING.md`](../docs/HANDLEIDING.md).

Snapshot verversen (na een `select public.export_snapshot();` in de Supabase SQL-editor, uitvoer opgeslagen als bestand):

```bash
python3 scripts/write_snapshot.py export.json
```
