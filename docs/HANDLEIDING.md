# Handleiding VrijStaan

Stap voor stap: de site lokaal draaien, online zetten, beheren en de data bijhouden.

---

## 1. Wat er staat

| Onderdeel | Waar | Status |
|---|---|---|
| Website + app | `web/` (Next.js) | Klaar. Draait lokaal en bouwt foutloos |
| Database | Supabase-project `qkrmthrhwmmmwswmfgwc` | Live, gevuld en wordt automatisch bijgewerkt |
| Data-pipeline | Supabase edge function `pipeline` + `pg_cron` | Draait automatisch, 24/7 |
| Beheer | `https://<jouw-domein>/admin` | Klaar. Jij maakt je account zelf aan (stap 4) |

De site praat rechtstreeks met de live database. Er hoeft lokaal niets ingesteld te worden: de
Supabase-URL en de publieke sleutel staan als standaardwaarde in `web/src/lib/env.ts`.

---

## 2. Lokaal draaien (5 minuten)

1. Installeer [Node.js 22 LTS](https://nodejs.org) (versie 20.9 of hoger).
2. Open een terminal in de map van de repo en voer uit:

   ```bash
   cd web
   npm install
   npm run dev
   ```

3. Open <http://localhost:3000>. Op je telefoon (zelfde wifi): `http://<ip-van-je-computer>:3000`.

Productieversie lokaal testen: `npm run build` en daarna `npm start`.

---

## 3. Online zetten met Vercel (gratis)

1. Ga naar <https://vercel.com>, log in met GitHub en kies **Add New → Project**.
2. Kies de repository `camperdashboard`.
3. Zet **Root Directory** op `web`. Framework wordt automatisch herkend (Next.js).
4. Onder **Environment Variables** (allemaal optioneel, de standaardwaarden werken):

   | Naam | Waarde |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | het definitieve adres, bijv. `https://vrijstaan.nl` |
   | `ORS_API_KEY` | optioneel: gratis sleutel van <https://openrouteservice.org> (anders wordt OSRM gebruikt) |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | alleen als je een ander Supabase-project gebruikt |

5. Klik **Deploy**. Na ±3 minuten staat de site online. Elke push naar `main` zet automatisch een nieuwe versie live.
6. Eigen domein: in Vercel **Settings → Domains** het domein toevoegen en de DNS-records volgen.

> De site werkt ook op elk ander platform dat Node.js draait (`npm run build && npm start`, poort 3000).

---

## 4. Supabase instellen voor inloggen (eenmalig, 3 minuten)

In het [Supabase-dashboard](https://supabase.com/dashboard/project/qkrmthrhwmmmwswmfgwc):

1. **Authentication → URL Configuration**
   - *Site URL*: je domein, bijv. `https://vrijstaan.nl`
   - *Redirect URLs*: voeg toe `https://vrijstaan.nl/admin` en `http://localhost:3000/admin`
2. **Authentication → Emails → SMTP Settings** (aanbevolen): koppel een eigen mailprovider
   (bijv. Resend, Postmark of Brevo). De ingebouwde mail van Supabase verstuurt maar een paar mails per uur.

### Je beheeraccount aanmaken

1. Ga naar `/admin` en kies **Nog geen account? Aanmaken**.
2. Gebruik **patrickdereuver98@gmail.com** (dit adres is vooraf uitgenodigd) en kies een wachtwoord van minstens 10 tekens.
3. Klik op de bevestigingslink in je mail en log in. Je bent automatisch beheerder.

Een extra beheerder toevoegen (SQL-editor in Supabase):

```sql
insert into private.admin_invites (email, role) values ('collega@voorbeeld.nl', 'support');
-- 'admin' = alles, 'support' = support-rol
```

Daarna maakt die persoon zelf een account aan op `/admin`.

---

## 5. De beheeromgeving (`/admin`)

| Pagina | Wat je er doet |
|---|---|
| **Overzicht** | Aantal plekken online/concept, volledigheid per veld, scrape-voortgang, bezoekcijfers (alleen met toestemming), toestemmingen |
| **Plekken** | Zoeken, filteren, elke plek bewerken. Ja/Nee/Onbekend per voorziening. Status handmatig vastzetten. Wat je hier invult wordt nooit door de pipeline overschreven |
| **Support** | Berichten van het contactformulier. Antwoorden, interne notities, status en prioriteit, standaardantwoorden. De klant leest het antwoord via een persoonlijke link (knop "Mail de klant") |
| **Inzendingen** | Nieuwe plekken, correcties en eigenaarsclaims van bezoekers. Controleer ze en verwerk ze in Plekken |
| **Reviews** | Reviews goedkeuren, afwijzen of verwijderen. Alleen goedgekeurde reviews zijn zichtbaar |
| **FAQ** | Vragen toevoegen, bewerken, verbergen en ordenen. Verschijnt op `/veelgestelde-vragen` |
| **Logs** | Systeemfouten, alle wijzigingen door beheerders (auditlog), data-imports en cookietoestemmingen |
| **Instellingen** | Contactadres, mededeling bovenaan de site, publicatiedrempel en knoppen voor de pipeline |

---

## 6. Hoe de data werkt

**Regel nummer één: er wordt niets verzonnen.** Elk veld komt uit een bron, en wat niet bekend is blijft leeg
(de site toont dan "onbekend" of laat het weg).

1. **OpenStreetMap** (wekelijks, per provincie): alle campings, camperplaatsen en camperparkeerplaatsen met
   naam, ligging, contact en voorzieningen zoals ze op de kaart staan, plus losse loos- en waterpunten.
2. **Website van de plek** (continu, ±20 sites per minuut): de scraper leest de homepage en maximaal vijf
   relevante subpagina's (tarieven, faciliteiten, info) en haalt alleen letterlijk genoemde feiten op:
   prijs per nacht, voorzieningen, aantal plekken, maximale lengte, seizoen, honden, reserveren, foto's.
   Ontkenningen ("geen honden") gaan altijd voor. `robots.txt` wordt gerespecteerd.
3. **Volgorde van gezag**: wat jij in beheer invult > de eigen website (voor prijs en seizoen) > OpenStreetMap.
   Komt een waarde van een website en staat die er bij een volgende controle niet meer, dan wordt hij gewist.
4. **Publiceren**: een plek gaat automatisch online als:
   - er een website of telefoonnummer is, én
   - minstens twee van de drie beslisfeiten bekend zijn: prijs, openingsperiode en stroom, én
   - de gewogen score minstens 70% is. Gewichten (20 punten): prijs 3, openingsperiode 3, stroom 2, contact 2,
     foto 2, water 1,5, lozen 1,5, toilet 1, honden 1, beschrijving 1, echte naam 1, douche 0,5, aantal plekken 0,5.
   Wifi, maximale lengte, ondergrond en reserveren worden getoond maar tellen niet mee. Drempel aanpassen kan in **Instellingen**.

Automatische taken (pg_cron in Supabase):

| Taak | Wanneer |
|---|---|
| `osm-regions` / `osm-collect` / `osm-staging` | Elke paar minuten; elke provincie wordt eens per 7 dagen ververst |
| `scrape` | Elke 15 seconden een batch van 8 websites, zolang er werk in de wachtrij staat |
| `scrape-enqueue` | Elk half uur: nieuwe plekken met een website worden ingepland |

Rijtijden en afstanden zijn echt berekend over de weg, via OpenRouteService (met `ORS_API_KEY`) of de
openbare OSRM-server van de OpenStreetMap-gemeenschap.

---

## 7. Checklist voordat je live gaat

- [ ] Domein koppelen en `NEXT_PUBLIC_SITE_URL` instellen (stap 3)
- [ ] Site URL en redirect-URL's in Supabase Auth (stap 4) en eigen SMTP
- [ ] Beheeraccount aanmaken (stap 4)
- [ ] In **Instellingen** het echte contactadres invullen (nu staat er `hallo@vrijstaan.nl`)
- [ ] Bedrijfsgegevens (naam, KvK-nummer, adres) toevoegen aan `web/src/app/(site)/privacy/page.tsx`
      en `voorwaarden/page.tsx`, en de teksten laten nalezen door een jurist
- [ ] Optioneel: OpenRouteService-sleutel voor eigen rijtijden-quotum

---

## 8. Problemen oplossen

| Probleem | Oplossing |
|---|---|
| "Geen beheertoegang" na inloggen | Je e-mailadres staat niet in `private.admin_invites`, of het account bestond al vóór de uitnodiging. Voeg het toe met `insert into public.admins (user_id, email, role) select id, email, 'admin' from auth.users where email = '...';` |
| Bevestigingsmail komt niet aan | Controleer de spammap; stel eigen SMTP in (stap 4) |
| Rijtijden "niet beschikbaar" | De routeserver is tijdelijk onbereikbaar; de site valt terug op hemelsbrede afstand en zegt dat er eerlijk bij. Met `ORS_API_KEY` heb je een tweede bron |
| Pipeline lijkt stil te staan | **Admin → Logs → Systeem en fouten** en **Data-imports**. Knop **Nieuwe websites lezen** in Instellingen plant ze opnieuw in |
| Database opnieuw opzetten in een ander project | Voer `web/supabase/schema.sql` en daarna `web/supabase/seed.sql` uit, deploy `web/supabase/functions/pipeline` (zonder JWT-controle), zet een geheime sleutel in `public.internal_secrets` (`name = 'pipeline_key'`) en pas de projectnaam in `private.call_pipeline` aan |
