# VrijStaan: plan naar een nieuwe base version (23 oktober 2026)

Er loopt veel tegelijk: elf agentsessies en dertien open PR's. Dit plan brengt alles in kaart, legt de volgorde vast
waarin we het samenvoegen, en beschrijft wat er daarna komt: een beschrijving van de nieuwe base version, voor- en
nadelen, een review van de site vanuit de gebruiker en een designronde met Claude Design.

Het vorige plan (16 oktober) staat in [`docs/archief/plan-2026-10-16.md`](docs/archief/plan-2026-10-16.md). De
besluiten voor Patrick (§3) en de polishronde (§4 tot en met §6, codes K, P, S, N, E, C, D) blijven daar geldig tot
ze in deze ronde zijn afgevinkt.

Stand 23 oktober: §2 stap 1 tot en met 9 klaar, alles in PR #54.

Status: ✅ klaar · 🔄 bezig · ⬜ open · 👤 alleen Patrick.

---

## 1. Stand van zaken

Alle open PR's zijn gebouwd vanaf `acceptatie` (e7b068e). Elk mergt los zonder botsing, maar onderling botsen ze, vooral
op de plekpagina (`web/src/app/(site)/plek/[slug]/page.tsx`, zeven PR's), `place-ui.tsx` en de specs. `main` loopt 33
commits achter op `acceptatie`.

### 1a. Open PR's

| PR | Inhoud | Sessie | Wat nog nodig is | Botst met |
|---|---|---|---|---|
| #53 | Eigenaar vult zijn plek aan | Iets mee doen | CI groen, wacht op review | #48, #46 |
| #52 | Laatste aankomst en reserveren (pipeline en migratie) | Site progress | Migratie staat al live als `20261022092015` en `..092604`; bestandsnaam in de PR is `20261022100000` | #51, #47, #46 |
| #51 | Totaalprijs per nacht voor 2 personen | Site progress | Review | #52, #49, #47, #46 |
| #50 | Eerste 20 plekken op de server (B4), vertrektijd met één klik overnemen | Mobile UI redesign | CI groen op 3aa663d, wacht op test | geen |
| #49 | WCAG 2.1 AA afronden (P13), 38 bestanden | onbekend | Review; raakt bijna alles | #51, #47 |
| #48 | Reviews alleen met account of code per mail | Skills PRD assessment | Migratie `reviews_met_account` niet live; sessie wacht op toestemming voor SQL | #53, #47, #46, #37 |
| #47 | SEO-pagina's per provincie, plaats, eiland en vertrekgroep | onbekend | Review | #52, #51, #49, #48, #46, #37 |
| #46 | Onvolledige plekken grijs, "mogelijk verouderd" na 12 maanden | onbekend | Review | #53, #52, #51, #48, #47, #37 |
| #45 | Stand tien punten, N+1-fix Beheer → Foto's | 10 punten evaluatie | Gericht op `main` en 33 commits achter; migratie `user_trust_lijst` niet live | geen |
| #44 | Implementatieplan: contactregel en OSM-ronde (één regel) | afgerond | Mergen | geen |
| #37 | PRD bijgewerkt na vragenronde, ook `CLAUDE.md` | Skills PRD assessment | Review | #48, #47, #46 (docs) |
| #43 | Dependabot: drie kleine updates | | Mergen als CI groen is | geen |
| #40 | Dataplan Fase 0: bronnenlaag, bronnenbeleid, MCP-server (2.935 regels) | | Voorstel: buiten deze base houden, apart beoordelen | geen |
| #28 | TypeScript 5.9 naar 7.0 | | Voorstel: niet in deze base; later apart | |

### 1b. Sessies

| Sessie | Branch | Staat | Voorstel |
|---|---|---|---|
| Iets mee doen | `claude/eigenaar-aanvullen` | wacht op merge #53 | stoppen na opname |
| Site progress | `claude/externe-bronnen` (#51, #52) | wacht op toestemming SQL | stoppen na opname |
| Mobile UI redesign en foto's | `claude/mobile-ui-photos-ux-axxlae` (#50) | wacht op test | stoppen na opname |
| Skills PRD assessment | `claude/prd-bijwerken` (#37, #48) | wacht op toestemming SQL | stoppen na opname |
| 10 punten evaluatie | `claude/duizend-gebruikers` (#45) | wacht op SQL en geheimen 👤 | stoppen na opname |
| Camperdashboard implementation plan | `claude/launch-hardening` | wacht op `NEXT_PUBLIC_SUPABASE_URL` 👤 | vraag beantwoorden, dan stoppen |
| Feature review en plan | `feature/kernbelofte-acceptatie` | vraagt om B9, al besloten | archiveren |
| Local host setup | `claude/local-host-setup-3xwg5y` | PR #6 al gemerged | archiveren |
| Tool plan, audit en feedback | `claude/brave-wright-odz441` | sessielimiet, werk gemerged | archiveren |
| Repository redesign | `redesign/nextjs` | vraagt om besluiten die al genomen zijn | archiveren |
| Claude code integration | `claude/everything-claude-code` | PR #30 gemerged | archiveren |

Archiveren en oude branches verwijderen gebeurt pas na akkoord van Patrick.

### 1c. Gaten die we eerst nalopen

| # | Wat | Aanpak |
|---|---|---|
| G1 | Drie migraties met dezelfde versie `20261022100000` (#52, #48, #45) | #52 hernoemen naar de live versies; #48 en #45 een eigen, latere tijd |
| G2 | `20261019070000_contact_beheerder.sql` staat in `acceptatie`, maar niet in de live migratielijst | In de database nagaan of de functie al live is (dan via SQL gezet); anders live zetten |
| G3 | #45 is gericht op `main` | De fix en migratie overnemen in deze ronde; de plantekst gaat op in dit plan |
| G4 | #47 en #49 passen het oude `plan.md` aan | Hun wijzigingen verwerken in `docs/archief/plan-2026-10-16.md` of in dit plan |

### 1d. Alleen Patrick 👤

Al eerder gevraagd, nog steeds open:

- Supabase SQL-editor: `web/supabase/retention.sql`, `delete_my_account` en `drop table private.probe, private.probe2;` (B5).
- GitHub: geheimen `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` en variabele `SITE_URL` (B10).
- Vercel: de waarde van `NEXT_PUBLIC_SUPABASE_URL` doorgeven (inloggen werkt niet).
- Beheeraccount (B6), bedrijfsgegevens (B8), mailprovider (B7), domein, branch protection (E5).

---

## 2. Samenvoegen tot de nieuwe base version

Werkbranch `claude/ecstatic-edison-64e02x`, vanaf `acceptatie`. Volgorde: klein en docs eerst, dan de keten op de
plekpagina, WCAG als laatste omdat die bijna alles raakt. Na elke stap `cd web && npm run check && npm test`.

| Stap | PR's | Let op | Status |
|---|---|---|---|
| 1 | #44, #43, #37 | Alleen docs en kleine updates | ✅ |
| 2 | #50 | Zoeken met de eerste 20 plekken op de server | ✅ |
| 3 | #52, dan #51, dan #46 | Migratie #52 hernoemen (G1); plekpagina en `place-ui.tsx` samenvoegen: aankomst, totaalprijs en status naast elkaar | ✅ |
| 4 | #53, dan #48 | `departure-radios.tsx` uit beide; migratie #48 hernummeren (G1) | ✅ |
| 5 | #47 | SEO-pagina's op de nieuwe plekpagina | ✅ |
| 6 | #49 | WCAG over alles heen; a11y-e2e opnieuw | ✅ plus twee fixes na het samenvoegen: tikdoelen van de SEO-links, `connection()` in `zoeken/search.tsx` |
| 7 | #45 | Alleen de N+1-fix en de migratie (G3) | ✅ |
| 8 | Controle | `npm run check && VRIJSTAAN_OFFLINE=1 npm run build`, unit-tests, Playwright (met a11y) | ✅ 226 unit-tests, 192 Playwright-tests |
| 9 | Live zetten | Migraties #48 en #45 en G2 in Supabase; edge function `pipeline` als #52 een nieuwere versie heeft dan live | ✅ `user_trust_lijst` live, G2 stond al live, pipeline v43 live. #48 pas na de deploy van `main` |
| 10 | Opruimen | Eén PR naar `acceptatie` die #44 tot en met #53 vervangt; in elke oude PR een regel "opgenomen in …"; sessies laten stoppen | ✅ #54 en #55 gemerged, #37 en #43 tot en met #53 gesloten, sessies gearchiveerd |
| 11 | Base version 👤 | Patrick test de Vercel-preview; `acceptatie` naar `main`; tag `v0.2-basis` | ✅ `main` 848536a (23 oktober), reviewmigratie live |

Bij botsingen in de docs houden we beide kanten. Bij een inhoudelijke keuze in de code (twee PR's willen iets anders op
dezelfde plek) stoppen we en vraagt de agent het aan Patrick. De specs worden bijgewerkt in dezelfde commits
(implementatieplan, schema, app flow, open punten in `docs/specs/README.md`).

---

## 3. Na de merge: rapport over de base version

Komt in dit bestand (§5) en als pagina om te delen.

- **Wat de base version is**: functies per scherm, aantal plekken live, wat in Supabase draait (migraties, edge functions,
  cron), wat nog op Patrick wacht.
- **Voor- en nadelen**: wat sterk is en wat zwak is, eerlijk en met cijfers waar die er zijn.
- **Review vanuit de gebruiker**: de site doorlopen op iPhone-formaat (Playwright, lokale build), als camperaar uit de doelgroep (40+ volgens de PRD in #37):
  zoeken, filteren, plek openen, vertrektijd en prijs lezen, bewaren, reis plannen, offline. Daarnaast de eigenaar die
  zijn plek aanvult en iemand die meedoet. Per stap: wat werkt, wat stoort, met screenshot en prioriteit.

## 4. Meedenken met Claude Design

Na het rapport een designverkenning met Claude Design van de drie hoofdschermen: start, zoeken en plekpagina. Binnen de
vaste stijlgids (`docs/stijlgids.md`, skill `vrijstaan-stijl`: zandpapier, bosgroen, avondzon, meerblauw, Geist).
Input: de bevindingen uit de gebruikersreview. Twee of drie varianten; Patrick kiest, daarna wordt de keuze een taak in
het implementatieplan.

## 5. Base version: rapport en designronde

- Rapport (wat erin zit, cijfers, sterk en zwak, gebruikersreview): https://claude.ai/artifact/2Nos9bWU62qykbAC2hKzvr
- Designcanvas met varianten: https://claude.ai/artifact/Mu311sSaEa3nn85Uh9LHjc
- Gebouwd uit de designronde: plekpagina B, zoeklijst A en de tekst van start A (implementatieplan, Mijlpaal 5).
- Nog open voor Patrick 👤: `web/supabase/retention.sql` uitvoeren (database groeit ~19 MB per dag; de Supabase-tool van
  de agents laat `delete` niet door), de oude `submit_review` droppen (README nummer 55), beheeraccount, mailprovider,
  back-upgeheimen.
- Herscrape met parser 43 klaar (23 oktober, 3.242 websites): +132 vertrektijden, 203 laatste aankomsttijden, 919 reserveringsregels; 15 verdwenen vertrektijden hersteld uit de baseline. Volgende: ronde 2 (forums, reviews, gidsen) voor de plekken zonder vertrektijd.
- Scrape-taken samengevoegd tot één (migratie `20261023210000_scrape_een_taak.sql`): een tiende van de logregels.
- Later, als de aankomsttijden gevuld zijn: zoeklijst B ("Hier kun je nog aankomen") en start B.
- Ronde 2 proef (23 oktober): 0 van 8 steekproefplekken kreeg via zoeken of een tweede leesronde een vertrektijd; de tijd staat meestal nergens. Voorstel in `docs/specs/README.md` nummer 59.
- Pipeline v48 live (24 oktober): lege startpagina wist niets meer; van de 18 teruggevallen plekken zijn er 7 weer gepubliceerd (prijs teruggezet uit de baseline), 11 blijven concept.
