# Screenshot-QA UX-audit (27 november 2026)

Offline build (`VRIJSTAAN_OFFLINE=1`, snapshot-data), Chromium, cookiebalk zichtbaar waar die bij een eerste bezoek
staat. De screenshots zelf staan niet in de repository (data wisselt dagelijks, zie besluit over T49); ze zijn
opnieuw te maken met de formaten hieronder.

Per scherm zijn de vragen uit plan B §51 beantwoord: wat zie ik eerst, wat moet ik eerst doen, is de primaire actie
duidelijk, is er ruis, is het scanbaar, logisch gegroepeerd, kleur met betekenis, niets dubbel, en kan een oudere
gebruiker het zonder uitleg.

## Formaten

| Formaat | Licht | Donker |
|---|---|---|
| 320 × 700 | alle gewijzigde schermen | |
| 390 × 844 | alle gewijzigde schermen | plekpagina (twee plekken), Mijn reis |
| 430 × 932 | alle gewijzigde schermen | |
| 820 × 1180 (tablet) | alle gewijzigde schermen | |
| 1440 × 900 | alle gewijzigde schermen | plekpagina, Mijn reis |

Horizontaal schuiven gemeten op elk formaat: overal 0, behalve Mijn reis met stops op 320 px (19 px). Dat kwam niet
door deze ronde (de rij met nachten en drie knoppen paste nooit) en is opgelost met `flex-wrap`; er is een e2e-test
voor bij gekomen (`small-screens.spec.ts`).

## Per scherm

| Scherm | Eerst gezien | Primaire actie | Bevindingen |
|---|---|---|---|
| Plek, geen vaste vertrektijd (390) | Foto, naam, dan "Geen vaste vertrektijd" groot in groen met de uitleg; prijs en de drie regels nog boven de vouw | Route openen (vaste balk) | Goed. Prijs komt pas in de balk na scrollen; naam verschijnt in de kop |
| Plek, onbekende vertrektijd (390, licht en donker) | "Vertrektijd onbekend" in gewone tekstkleur met één knop Vertrektijd doorgeven | Route openen | Geen foutkleur; Onbekend gedempt in de regels |
| Plek (1440, licht en donker) | Naam, dan vertrektijd naast Route openen in de zijkolom | Route openen (enige gevulde knop) | Vertrektijd volledig in beeld zonder scrollen (getest in `place-decision.spec.ts`) |
| Plek (820) | Beslisblok, daaronder Route openen en contact | Route openen | Geen vaste balk en geen zijkolom op tablet, dus de actiekaart staat in de kolom |
| Dichtbij (390, 1440) | Vraag "Waar kun je vannacht staan?" en Gebruik mijn locatie | Gebruik mijn locatie | Bestaande illustratie; geen wijziging nodig |
| Mijn reis (alle formaten) | Volgende stop met Route openen | Route openen | 320 px opgelost (zie boven) |
| Doe mee (390, 1440) | Vraag als kop, dan Een plek verbeteren met Plek zoeken | Plek zoeken | Eén gevulde knop; aanmelden als tekstlink; eigenaren onderaan |
| Plek aanmelden (390, 1440) | "Stap 1 van 4, Welke plek wil je aanmelden?" | Volgende | Voortgangsbalk decoratief; stapkop krijgt focus |

## Toegankelijkheid

- axe in `e2e/a11y.spec.ts` op alle gewijzigde schermen (licht en donker, telefoon en groot scherm): 0 meldingen.
- Huisregels in dezelfde spec: tekst ≥ 14 px, tikdoelen ≥ 44 px, geen horizontaal schuiven op 320 px met tekst op
  200% (`small-screens.spec.ts`).
- Toetsenbord: menu Meer met Escape, sheets met focusval, focus naar de kop van een nieuwe stap, Enter in een
  tekstveld van Plek aanmelden gaat naar de volgende stap.

## Scorecard (plan B §52, 1 tot 5)

| Thema | Score | Toelichting |
|---|---|---|
| Hiërarchie | 5 | Vertrek, prijs, aankomst/open/reserveren in die volgorde, op elk formaat |
| Scanbaarheid | 4 | Koppen en regels label · waarde; de plekpagina blijft lang, maar zonder springlinks |
| Rust | 4 | Eén gevulde knop per scherm; de cookiebalk bij een eerste bezoek blijft het drukste element |
| Vertrouwen | 5 | Onbekend rustig, verouderd als signaal, laatste update zichtbaar |
| Actie | 5 | Route openen altijd binnen bereik |
| Mobiel | 5 | 320 tot 430 px zonder zijwaarts schuiven |
| Toegankelijkheid | 4 | axe schoon; echte schermlezertest op een telefoon nog te doen (testweek) |
| Consistentie | 4 | Woordenboek doorgevoerd; bouwstenen voor de hele site na de livegang |
| Performance | 4 | Geen extra bibliotheken; meting op productie volgt (LANCERING 3.3) |
| Merk | 5 | Kleuren, Geist en toon ongewijzigd |

Geen thema onder 4 op Hiërarchie, Scanbaarheid, Rust of Actie: klaar voor review.

## Bekende afwijkingen

- Het kaartpaneel in de kaartweergave van Zoeken valt op een kleine telefoon deels achter de tabbalk (melding uit fase
  E). Hoort bij de kaartronde C5.
- **Al bestaande race, niet uit deze ronde:** heel soms staan na het laden kort twee koppen in de pagina (de
  Suspense-fallback van `Header` en de echte kop tegelijk). In de laatste volledige run 1 keer op 356 tests
  (`theme.spec.ts`); 40 herhalingen daarna waren groen. Op `main` (8422374) apart gebouwd en getest: daar faalt
  dezelfde test ook, zelfs vaker. Voorstel: los onderzoeken na deze PR (bijvoorbeeld de kop zonder `usePathname` in
  Suspense renderen).
