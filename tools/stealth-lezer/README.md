# Stealth-lezer

Leest websites van plekken die de gewone scraper niet of nauwelijks kon lezen, met
[Scrapling](https://github.com/D4Vinci/Scrapling) in stealth-modus (besluit eigenaar 25 oktober 2026,
[bronnenbeleid §3a](../../docs/bronnenbeleid.md)).

## Hoe het werkt

1. `private.enqueue_stealth` (cron `stealth-enqueue`, dagelijks 05:23) zet plekken in `private.stealth_queue`, in deze
   volgorde: onleesbaar (`website_error`), weinig gegevens (minder dan 3 velden), zonder prijs of vertrektijd, en
   herlezen na 30 dagen.
2. De workflow `Stealth-lezer` draait elk uur 50 minuten. `lezer.py` vraagt plekken op (`stealth_batch`), haalt de
   startpagina op met een echte browser die Cloudflare-controles oplost, en vraagt de pipeline welke subpagina's
   (`stealth_plan`, `stealth_deeper`). Die keuze is dezelfde als bij de gewone scraper (`pages.ts`).
3. `stealth_apply` leest alles uit met de gewone extractor en schrijft via `apply_stealth` → `apply_scrape`. Beheer gaat
   voor, en bij een haperende site wordt niets gewist.
4. Wat de lezer vond staat in `places.sources.stealth`. Zolang dat zonder fout is, plant de gewone scraper de plek
   niet meer in.

## Grenzen (bronnenbeleid §3a)

- Hoogstens 1 verzoek per 5 seconden per host, startpagina plus 7 subpagina's en 2 PDF's per site.
- Geen inlogpagina's: een adres als `/inloggen` of een pagina met een wachtwoordveld en weinig tekst slaat hij over.
- Bij 429 stopt hij met de plek; de wachtrij probeert het na een uur opnieuw, hoogstens drie keer.
- `robots.txt` wordt gelezen en vastgelegd (`sources.stealth.robots_disallows`), maar niet gevolgd.
- Vraagt een eigenaar te stoppen: `select public.apply_stealth('<place_id>', '{}', 'geblokkeerd: <reden>')`. Dan
  leest geen enkele lezer de plek meer.

## Instellen

GitHub → Settings → Secrets and variables → Actions:

- `PIPELINE_KEY`: de waarde van `internal_secrets.pipeline_key`.
- `STEALTH_PROXIES` (optioneel): proxy-adressen gescheiden door komma's. Zonder proxy's leest hij vanaf het IP van
  GitHub.

## Lokaal

```sh
pip install -r tools/stealth-lezer/requirements.txt pytest && scrapling install
python -m pytest -q tools/stealth-lezer
PIPELINE_URL=… PIPELINE_KEY=… STEALTH_MINUTES=5 python tools/stealth-lezer/lezer.py
```
