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
2. Open een terminal in de map van de repo en voer uit: `node start.mjs`. Dat installeert de pakketten als dat
   nodig is, start de server en opent de browser. In VS Code kan het ook via *Terminal → Run Build Task*
   (Ctrl+Shift+B). Liever met de hand:

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
   - *Redirect URLs*: voeg toe `https://vrijstaan.nl/admin`, `https://vrijstaan.nl/auth/callback`,
     `http://localhost:3000/admin` en `http://localhost:3000/auth/callback`
2. **Authentication → Emails → SMTP Settings** (aanbevolen): koppel een eigen mailprovider
   (bijv. Resend, Postmark of Brevo). De ingebouwde mail van Supabase verstuurt maar een paar mails per uur.

### Inloggen voor bezoekers (Google, Apple, Facebook, inloglink)

Bezoekers loggen in op `/inloggen`. De inloglink per e-mail werkt meteen (wel eigen SMTP instellen, zie hierboven:
de ingebouwde mail haalt een drukke lancering niet). De drie diensten zet je aan in **Authentication → Sign In /
Providers**. Bij elke dienst vul je als *redirect/callback URL* in:
`https://qkrmthrhwmmmwswmfgwc.supabase.co/auth/v1/callback`

| Dienst | Waar maak je de sleutels | Wat vul je in bij Supabase |
|---|---|---|
| Google | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth client ID (type *Web application*) | Client ID en Client Secret |
| Apple | [Apple Developer](https://developer.apple.com/account/resources/identifiers) → Services ID met *Sign in with Apple* + een Key | Services ID, Team ID, Key ID en de .p8-sleutel |
| Facebook | [Meta for Developers](https://developers.facebook.com/apps) → app met *Facebook Login*, alleen `email` en `public_profile` | App ID en App Secret |

Staat een dienst nog niet aan, dan krijgt de bezoeker een nette melding en kan die met e-mail inloggen.
Zet bij Facebook de app op **Live** vóór de lancering, anders kunnen alleen testers inloggen.

Veiligheid: alleen een **bevestigd** e-mailadres uit `private.admin_invites` wordt beheerder. Gewone accounts
zien in `/admin` alleen "Geen beheertoegang".

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
| **Dubbelen** | Kaart en lijst van plekken die binnen 50/150/500 m van elkaar liggen, met een zekerheid (afstand + gelijkende naam). Kies per paar welke plek blijft, of selecteer alle "hoog" en voeg ze in één keer samen. Lege velden worden aangevuld, reviews en foto's verhuizen mee en de oude link stuurt permanent door. "Geen dubbel" verbergt een paar voorgoed |
| **Reviews** | Reviews goedkeuren, afwijzen of verwijderen. Alleen goedgekeurde reviews zijn zichtbaar |
| **Foto's** | Foto's van bezoekers goedkeuren of afwijzen, met per inzender hoeveel foto's eerder zijn goedgekeurd/afgewezen. Na 3 goedgekeurde en 0 afgewezen foto's (en een account van minstens een dag oud) is iemand "vertrouwd" en gaan diens foto's automatisch online. Aanpassen: `update site_settings set value = '{"auto_approve_min_approved": 5, "min_account_age_days": 7}' where key = 'trust';` |
| **FAQ** | Vragen toevoegen, bewerken, verbergen en ordenen. Verschijnt op `/veelgestelde-vragen` |
| **Logs** | Systeemfouten, alle wijzigingen door beheerders (auditlog), data-imports en cookietoestemmingen |
| **Statistieken** | Bezoeken per dag, populaire pagina's, zoekopdrachten en plekken (alleen bezoekers die toestemming gaven) |
| **Instellingen** | Contactadres, mededeling bovenaan de site, publicatiedrempel, websitefoto's aan/uit en knoppen voor de pipeline |

---

## 6. Hoe de data werkt

**Regel nummer één: er wordt niets verzonnen.** Elk veld komt uit een bron, en wat niet bekend is blijft leeg
(de site toont dan "onbekend" of laat het weg).

1. **OpenStreetMap** (wekelijks, per provincie): alle campings, camperplaatsen en camperparkeerplaatsen met
   naam, ligging, contact en voorzieningen zoals ze op de kaart staan, plus losse loos- en waterpunten.
2. **Website van de plek** (continu, ±14 sites per minuut): de scraper leest de homepage en maximaal zes
   relevante subpagina's (tarieven, faciliteiten, info) en haalt alleen letterlijk genoemde feiten op:
   prijs per nacht, voorzieningen, aantal plekken, maximale lengte, seizoen, honden, reserveren, foto's.
   Ontkenningen ("geen honden") gaan altijd voor. `robots.txt` wordt gerespecteerd.
3. **Volgorde van gezag**: wat jij in beheer invult > de eigen website (voor prijs en seizoen) > OpenStreetMap.
   Komt een waarde van een website en staat die er bij een volgende controle niet meer, dan wordt hij gewist.
4. **Vertrektijden (de kern)**: de scraper leest ook aankomst- en vertrektijden, slagboomtijden en "per 24 uur".
   Een plek krijgt *Geen vaste vertrektijd* alleen als de website dat letterlijk zegt; de zin zelf wordt bewaard en op de
   site getoond met de datum. Tijden voor chalets, verhuur, arrangementen of de receptie tellen niet mee.
   De site verdeelt de plekken over drie pagina's: **Zonder vertrektijd** (`/zonder-vertrektijd`), **Uitslapers**
   (vaste vertrektijd 12:00 of later, `/uitslapers`) en **Overige** (`/overige-plekken`: 11:00 tot 12:00, vóór 11:00 of
   onbekend). De zin van de website zie je in **Beheer → Plekken**; op de site staat alleen de datum van de laatste update.
5. **Prijzen**: de laagste nachtprijs voor een kampeerplek ("vanaf"), de hoogste genoemde prijs, en losse toeslagen
   (toeristenbelasting, stroom, per persoon, kind, hond, douche, water, lozen, extra auto) precies zoals de website ze noemt.
6. **Publiceren**: een plek gaat automatisch online als:
   - er een website of telefoonnummer is, én
   - minstens twee van de vier beslisfeiten bekend zijn: vertrekregel, openingsperiode, stroom en prijs, én
   - de gewogen score de drempel haalt (nu 45%). Gewichten (20 punten): vertrekregel 4, openingsperiode 3, prijs 2,
     stroom 2, contact 2, foto 1,5, water 1, lozen 1, toilet 1, honden 1, beschrijving 0,5, echte naam 0,5,
     douche 0,25, aantal plekken 0,25.
   Drempel aanpassen kan in **Instellingen**.
7. **Foto's**: foto's van de websites van plekken worden getoond, altijd met de bron ("website domein.nl"). Vraagt een
   rechthebbende via **Meld inhoud** om verwijdering, haal de foto dan weg bij de plek (Beheer → Plekken). Alles uitzetten
   kan in **Instellingen**; dan blijven alleen Wikimedia Commons, eigen uploads en foto's met toestemming over.

Automatische taken (pg_cron in Supabase):

| Taak | Wanneer |
|---|---|
| `osm-regions` / `osm-collect` / `osm-staging` | Elke paar minuten; elke provincie wordt eens per 7 dagen ververst |
| `scrape` | Elke 15 seconden een batch van 8 websites, zolang er werk in de wachtrij staat |
| `scrape-enqueue` | Elk half uur: nieuwe plekken met een website worden ingepland |
| `scrape-refresh` | Elk half uur de 10 plekken die het langst (minstens 30 dagen) niet gelezen zijn; zo is elke website eens per maand opnieuw aan de beurt |

Rijtijden en afstanden zijn echt berekend over de weg, via OpenRouteService (met `ORS_API_KEY`) of de
openbare OSRM-server van de OpenStreetMap-gemeenschap.

---

## 7. Checklist voordat je live gaat

- [ ] Domein koppelen en `NEXT_PUBLIC_SITE_URL` instellen (stap 3)
- [ ] Site URL en redirect-URL's in Supabase Auth (stap 4) en eigen SMTP
- [ ] Google, Apple en Facebook aanzetten in Supabase Auth (stap 4) en Facebook-app op Live
- [ ] Beheeraccount aanmaken (stap 4)
- [ ] In **Instellingen** het echte contactadres invullen (nu staat er `hallo@vrijstaan.nl`)
- [ ] Bedrijfsgegevens (naam, adres, KvK, btw) invullen in `web/src/lib/company.ts` (privacy, voorwaarden en
      disclaimer gebruiken die automatisch) en de teksten laten nalezen door een jurist
- [ ] Optioneel: OpenRouteService-sleutel voor eigen rijtijden-quotum

### Drukte op de eerste dag (verbindingen en caching)

De website opent zelf **geen** databaseverbindingen: alle data loopt via de Supabase REST-API (PostgREST), die
een eigen pool van verbindingen beheert. Bij veel bezoekers houden drie lagen de database rustig:

1. **Next.js-cache** (`"use cache"` in `web/src/lib/places.ts`): de lijst met plekken wordt hoogstens eens per
   paar minuten opgehaald, ongeacht het aantal bezoekers. Detailpagina's halen alleen hun eigen plek op.
2. **CDN-cache van Vercel** (`s-maxage` op `/api/places` en `/api/towns`): de kaart- en zoekdata komt van de edge.
3. **Vangnet**: bij een 429/5xx probeert de site het één keer opnieuw en valt daarna terug op de snapshot.

Heb je ooit een directe Postgres-verbinding nodig (scripts, migraties, eigen server-code), gebruik dan de
**Supavisor-pooler in transaction mode (poort 6543)**, nooit `db.<ref>.supabase.co:5432`. Het gratis project heeft
maar 60 verbindingen. Zie `web/.env.example` voor het formaat.

- [ ] Vóór de lancering in Supabase → Reports controleren dat het aantal verbindingen ruim onder de 60 blijft

---

## 8. Problemen oplossen

| Probleem | Oplossing |
|---|---|
| "Geen beheertoegang" na inloggen | Je e-mailadres staat niet in `private.admin_invites`, of het account bestond al vóór de uitnodiging. Voeg het toe met `insert into public.admins (user_id, email, role) select id, email, 'admin' from auth.users where email = '...';` |
| Bevestigingsmail komt niet aan | Controleer de spammap; stel eigen SMTP in (stap 4) |
| Rijtijden "niet beschikbaar" | De routeserver is tijdelijk onbereikbaar; de site valt terug op hemelsbrede afstand en zegt dat er eerlijk bij. Met `ORS_API_KEY` heb je een tweede bron |
| Pipeline lijkt stil te staan | **Admin → Logs → Systeem en fouten** en **Data-imports**. Knop **Nieuwe websites lezen** in Instellingen plant ze opnieuw in |
| Database opnieuw opzetten in een ander project | Voer `web/supabase/schema.sql` en daarna `web/supabase/seed.sql` uit, deploy `web/supabase/functions/pipeline` (zonder JWT-controle), zet een geheime sleutel in `public.internal_secrets` (`name = 'pipeline_key'`) en pas de projectnaam in `private.call_pipeline` aan |


## Scraper uitrollen (edge function `pipeline`)

De functie in Supabase bestaat uit één regel die de code uit GitHub haalt, vastgezet op een commit:

```ts
import "https://raw.githubusercontent.com/patrickdereuver98-lab/Camperdashboard/<commit>/web/supabase/functions/pipeline/index.ts";
```

Supabase bundelt die code bij het uitrollen; daarna hangt de functie niet meer van GitHub af. Nieuwe versie: commit en
push de wijziging in `web/supabase/functions/pipeline/`, zet de nieuwe commit in die regel en rol uit met
`verify_jwt` uit (de functie controleert zelf de `x-pipeline-key`).

## Meer plekken vinden

- **Websites zoeken** (automatisch, cron `discover`, eigen edge function `discover`): voor plekken zonder website
  probeert de functie adressen uit de
  naam (zoals `campingdekraai.nl`). Een site telt alleen als de pagina de naam én de plaats, postcode of het
  telefoonnummer noemt. Gevonden sites worden daarna gewoon gescraped. Resultaat per plek: `places.sources->'discovery'`.
- **Doe mee** (`/doe-mee`): deel deze link in de Facebookgroep. Leden vullen de vertrektijd in van plekken waar die
  nog onbekend is. Alles komt binnen in **Beheer → Inzendingen**; pas de plek daarna aan in **Beheer → Plekken**.
