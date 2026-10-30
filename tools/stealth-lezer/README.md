# Stealth-lezer

Leest websites van plekken die de gewone scraper niet of nauwelijks kon lezen, met
[Scrapling](https://github.com/D4Vinci/Scrapling) in stealth-modus (besluit eigenaar 25 oktober 2026,
[bronnenbeleid §3a](../../docs/bronnenbeleid.md)).

## Hoe het werkt

1. `private.enqueue_stealth` (cron `stealth-enqueue`, dagelijks 05:23) zet plekken in `private.stealth_queue`, in deze
   volgorde: onleesbaar (`website_error`), weinig gegevens (minder dan 3 velden), zonder prijs of vertrektijd, en
   herlezen na 30 dagen.
2. De workflow `Stealth-lezer` draait één lezerproces van 5,5 uur met zes browsers tegelijk (`STEALTH_PARALLEL`), die
   samen één klok per host delen, en een aparte job start daarna de volgende run zolang de wachtrij niet leeg is
   (GitHub slaat geplande runs bij openbare repositories vaak over; het uurrooster blijft als vangnet). Tot 30 oktober
   waren dat acht losse lezers, elk op een eigen deel van de hosts. `lezer.py` vraagt plekken op (`stealth_batch`), haalt de
   startpagina op met een echte browser die Cloudflare-controles oplost, en vraagt de pipeline welke subpagina's
   (`stealth_plan`, `stealth_deeper`). Die keuze is dezelfde als bij de gewone scraper (`pages.ts`).
3. `stealth_apply` leest alles uit met de gewone extractor en schrijft via `apply_stealth` → `apply_scrape`. Beheer gaat
   voor, en bij een haperende site wordt niets gewist.
4. Wat de lezer vond staat in `places.sources.stealth`. Zolang dat zonder fout is, plant de gewone scraper de plek
   niet meer in.

## Grenzen (bronnenbeleid §3a)

- Hoogstens 1 verzoek per 5 seconden per host (plus 0 tot 2,5 s spreiding), startpagina plus 15 subpagina's en 4 PDF's
  per site.
- Tijdelijke fouten (time-out, 5xx) en 429: drie nieuwe pogingen met exponentiële wachttijd; bij 429 wacht de hele host
  (Retry-After gaat voor). Blijft het misgaan, dan gaat de plek terug in de wachtrij. Ook aanroepen naar de pipeline
  krijgen bij 429/5xx nieuwe pogingen.
- Geen inlogpagina's: een adres als `/inloggen` of een pagina met een wachtwoordveld en weinig tekst slaat hij over.
- `robots.txt` wordt gelezen en vastgelegd (`sources.stealth.robots_disallows`), maar niet gevolgd.
- Vraagt een eigenaar te stoppen: `select public.apply_stealth('<place_id>', '{}', 'geblokkeerd: <reden>')`. Dan
  leest geen enkele lezer de plek meer.

## Aanmelden en instellen

Er hoeft geen geheim in GitHub te staan. De workflow heeft `id-token: write` en vraagt GitHub om een ondertekend
OIDC-token met publiek `vrijstaan-pipeline`. De pipeline controleert handtekening, uitgever en vervaldatum, en daarna
dat het token van `stealth-lezer.yml` op `main` van deze repository komt, gestart door het rooster of met de hand
(`stealthClaimsOk` in `stealth.ts`). Zo'n token geeft alleen toegang tot de stealth-acties, niet tot de rest van de
pipeline.

Optioneel (GitHub → Settings → Secrets and variables → Actions):

- `STEALTH_PROXIES`: proxy-adressen gescheiden door komma's. Zonder proxy's leest hij vanaf het IP van GitHub.
- `PIPELINE_KEY`: alleen nodig om de lezer buiten GitHub Actions te draaien (lokaal).

## Lokaal

```sh
pip install -r tools/stealth-lezer/requirements.txt pytest && scrapling install
python -m pytest -q tools/stealth-lezer
PIPELINE_URL=… PIPELINE_KEY=… STEALTH_MINUTES=5 python tools/stealth-lezer/lezer.py
```
