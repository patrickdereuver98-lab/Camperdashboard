# VrijStaan web

De nieuwe publieksapp van VrijStaan: camperplaatsen in Nederland zoeken, op de kaart bekijken en een reis plannen.
Gebouwd met Next.js 16 (App Router, Cache Components), Tailwind CSS 4 en MapLibre GL.

De Streamlit-app in de root van de repo blijft voorlopig het beheerpaneel en de batch engine
(OSM-import en AI-verrijking).

## Starten

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # bouwt ook alle ~3.600 plekpagina's statisch voor
```

## Pagina's

| Route | Wat |
|---|---|
| `/` | Landing met zoekbalk, snelle ingangen, provincies en een eerlijk overzicht van de datakwaliteit |
| `/zoeken` | Lijst + kaart. Vrije tekst ("gratis aan het water in Zeeland") wordt omgezet naar filters; alle filters staan in de URL |
| `/plek/[slug]` | Detailpagina: voorzieningen (met "onbekend" waar we het niet weten), contact, ligging, plekken in de buurt |
| `/dichtbij` | GPS-locatie, straal 10–100 km, gesorteerd op afstand |
| `/mijn-reis` | Bewaarde plekken (localStorage) op volgorde, nachten per stop, afstand, kostenschatting, route naar Google Maps |

## Data

`src/data/places.json` wordt gegenereerd uit `../data/api_export_campers.csv`:

```bash
python3 web/scripts/build_data.py
```

Het script vertaalt provincies naar het Nederlands, koppelt elke plek aan de dichtstbijzijnde woonplaats
(GeoNames, `scripts/cities_nl.csv`), geeft naamloze plekken een leesbare naam, voegt dubbelingen samen en
maakt openingstijden leesbaar.

### Supabase (optioneel)

Zet `SUPABASE_URL` en `SUPABASE_ANON_KEY` en de app leest uit de tabel `places`
(schema: `supabase/migrations/0001_places.sql`). Zonder die variabelen, of als Supabase niet bereikbaar is,
gebruikt de app de meegebouwde JSON.

## Ontwerp

"Natuur & vrijheid": zandpapier als ondergrond, bosgroen als merkkleur, avondzon (ember) voor accenten
en meerblauw voor water. Fraunces voor koppen, Inter voor tekst. Alle kleuren zijn tokens in
`src/app/globals.css`, met een donkere variant ("avond in het bos").

Omdat er nog geen echte foto's zijn, krijgt elke plek een gegenereerd landschap (`components/landscape.tsx`),
altijd hetzelfde per plek, met water erin als de plek aan het water ligt.
