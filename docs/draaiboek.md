# Draaiboek: als er iets misgaat

> Voor Patrick en voor agents. Wat je doet bij een kapotte uitrol, hoe je de database terugzet, wat er bewaakt wordt
> en welke instellingen buiten de code liggen. Bijgewerkt: 16 oktober 2026.

## 1. Een uitrol terugdraaien

**De site (Vercel).** Elke push naar `main` is een nieuwe deployment. Is de site kapot:

1. Vercel → project → **Deployments** → de laatste deployment die wel werkte → **⋯ → Instant Rollback**. Binnen een
   minuut staat de oude versie weer live. De database verandert hierdoor niet.
2. Daarna de oorzaak terugdraaien in git, zodat de volgende push hem niet terugbrengt:
   `git revert <commit>` op een branch, PR naar `acceptatie`, dan naar `main`. Nooit force-pushen op `main`.
3. Na de revert staat de rollback in Vercel niet meer vast: de nieuwe deployment van `main` neemt het over.

**De database (migraties).** Een migratie op de live database draai je niet terug met Vercel. Daarom:

- Schrijf bij elke migratie in `web/supabase/migrations/` onderaan als commentaar de omgekeerde SQL (`drop function`,
  `alter table ... drop column`, de oude versie van een functie).
- Ging er data verloren, zet dan de tabel terug uit de laatste back-up (§2), niet de hele database.

**Edge functions (scraper).** De functie `pipeline` haalt zijn code uit een vaste commit op GitHub (zie
`HANDLEIDING.md`, "Scraper uitrollen"). Terugdraaien betekent de vorige commit in de importregel zetten en opnieuw
uitrollen.

## 2. Back-up en database terugzetten

Het gratis Supabase-plan heeft geen back-ups die je zelf kunt terugzetten. Daarom draait elke zondag de
workflow **Back-up** (`.github/workflows/backup.yml`):

- een dump van de schema's `public` en `private`;
- een **hersteltest**: de dump gaat in een lege Postgres met PostGIS en per tabel wordt het aantal rijen vergeleken
  met de bron. Wijkt iets af, dan faalt de workflow en krijg je een mail van GitHub;
- de dump wordt versleuteld (AES-256) en 30 dagen bewaard als artifact. De repository is openbaar en de dump bevat
  e-mailadressen, dus nooit onversleuteld opslaan.

**Eenmalig instellen** (GitHub → Settings → Secrets and variables → Actions → **Secrets**):

| Geheim | Waar vandaan |
|---|---|
| `SUPABASE_DB_URL` | Supabase → **Connect** → *Session pooler* (de regel met `postgresql://postgres.<project>:<wachtwoord>@...:5432/postgres`) |
| `BACKUP_PASSPHRASE` | Zelf verzinnen: een lange willekeurige zin. Bewaar hem ook in je wachtwoordmanager; zonder deze zin is de back-up waardeloos |

Daarna één keer handmatig starten: Actions → **Back-up** → *Run workflow*, en kijken of hij groen wordt.

**Terugzetten.**

1. Actions → Back-up → de run van de gewenste datum → artifact downloaden en uitpakken.
2. `gpg --decrypt vrijstaan-<datum>.dump.gpg > vrijstaan.dump` (vraagt om de zin).
3. Eén tabel terugzetten (bijvoorbeeld reviews), eerst in een tijdelijk schema om te vergelijken:
   `pg_restore --no-owner --no-privileges --data-only --table=reviews --dbname="$SUPABASE_DB_URL" vrijstaan.dump`.
   Leeg de tabel vooraf alleen als je zeker weet dat de back-up beter is dan wat er nu staat.
4. Alles terugzetten in een **nieuw** Supabase-project: eerst de migraties uit `web/supabase/migrations/` (zodat rollen,
   rechten en extensies kloppen), daarna `pg_restore --no-owner --no-privileges --data-only`.

## 3. Bewaking

| Wat | Hoe | Wie krijgt bericht |
|---|---|---|
| Site online | `.github/workflows/monitor.yml`, elk uur `/`, `/zonder-vertrektijd` en `/sitemap.xml` | GitHub mailt bij een mislukte run |
| Database en data | Zelfde workflow: Supabase antwoordt en er staan minstens 1.000 plekken online | Idem |
| Database actief houden | `keepalive.yml`, dagelijks | Idem |
| Back-up en hersteltest | `backup.yml`, wekelijks | Idem |
| Fouten in de site | Tabel `app_logs`, te zien in **Beheer → Logs** | Nog niemand automatisch; kijk wekelijks |
| Pipeline | **Beheer → Overzicht** en **Logs → Data-imports** | Nog niemand automatisch |

Om de site mee te bewaken: GitHub → Settings → Secrets and variables → Actions → **Variables** → `SITE_URL` met het
adres zonder `/` aan het eind (bijvoorbeeld `https://vrijstaan.nl`). Zorg dat je in GitHub onder *Settings →
Notifications → Actions* "Notify on failed workflows only" aan hebt staan.

## 4. Kosten en limieten

| Dienst | Plan | Wat er gebeurt bij de limiet | Actie |
|---|---|---|---|
| Vercel | Hobby (gratis) | Geen rekening; bij overschrijding pauzeert Vercel functies of vraagt om een upgrade | Bij inkomsten naar Pro (Hobby is niet-commercieel, open punt 6) en daar meteen **Spend Management** met een maximum en mail instellen |
| Supabase | Free | Geen rekening; boven 500 MB database gaat het project alleen-lezen. Nu 52 MB | Bij overstap naar Pro de **Spend Cap** aan laten staan en in *Organization → Billing* een budgetmelding zetten |
| OpenRouteService | Gratis sleutel | Rijtijden vallen terug op OSRM, daarna op hemelsbreed | Niets; de site zegt het eerlijk |
| GitHub Actions | Openbare repository | Gratis | Niets |

Zet ook nu al een tweestapsverificatie aan op GitHub, Vercel en Supabase: wie daar binnenkomt, heeft de hele site.

## 5. E-mail en domein

Zodra er een eigen domein en een mailprovider zijn (nodig voor inlogmails, wachtwoord-reset en antwoorden op
tickets), zet je in de DNS van het domein:

| Record | Doel | Voorbeeld |
|---|---|---|
| SPF (`TXT` op het domein) | Welke servers mogen mailen namens het domein | `v=spf1 include:<van je mailprovider> -all` |
| DKIM (`TXT` of `CNAME`, door de provider gegeven) | Handtekening onder elke mail | Kopieer letterlijk uit de provider |
| DMARC (`TXT` op `_dmarc`) | Wat ontvangers doen met mail die SPF of DKIM niet haalt | Begin met `v=DMARC1; p=none; rua=mailto:<jouw adres>`, na twee weken zonder problemen `p=quarantine` |

Kies een provider met servers in de EU (bijvoorbeeld Postmark of Resend in de EU-regio) en vul hem in bij Supabase →
Authentication → **SMTP Settings**. Test daarna: account aanmaken, inloglink, wachtwoord vergeten.

## 6. Beveiligingsheaders

`web/next.config.ts` zet onder andere een Content-Security-Policy. Laadt de site iets van een nieuw domein (een
script, een kaartdienst, een API die de browser zelf aanroept), dan blokkeert de browser dat tot het domein in de
CSP staat. Foto's mogen van elk `https:`-adres. Controleer na een wijziging de console van de browser op meldingen
met "Content Security Policy".

## 7. Afhankelijkheden

- Dependabot (`.github/dependabot.yml`) opent elke maandag PR's naar `acceptatie`; beveiligingsupdates komen direct.
- `npm audit --omit=dev` moet 0 meldingen geven. Bekend en geaccepteerd: een melding over `braces` in de lint-tooling
  (`eslint-config-next`), alleen bij ontwikkelen, zonder oplossing van de makers.
- De kaartworker staat niet in git: `web/scripts/copy-maplibre-worker.mjs` zet hem vóór elke build en dev-start in
  `web/public/`. Na een update van `maplibre-gl` gaat dat vanzelf.
