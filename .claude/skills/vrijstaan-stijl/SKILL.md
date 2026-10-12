---
name: vrijstaan-stijl
description: Huisstijl voor teksten en ontwerp van VrijStaan. Gebruik bij elke wijziging aan zichtbare tekst (pagina's, knoppen, FAQ, meldingen) of aan het uiterlijk van de site, zodat alles klinkt alsof een mens het schreef en het thema "natuur & vrijheid" consequent blijft.
---

# VrijStaan: schrijven en ontwerpen

Lees ook `docs/specs/04-ui-ux-brief.md` (thema staat vast) en de algemene skill `frontend-design`.

## Schrijven

Schrijf zoals een camperaar het aan een andere camperaar vertelt: gewoon Nederlands, je-vorm, korte zinnen,
één boodschap per zin. Lezers zijn vaak 55+ en lezen op een telefoon, onderweg.

Doen:
- Zeg wat iets is of doet. "Hier mag je vertrekken wanneer je wilt", niet "Ervaar ultieme vrijheid".
- Knoppen zeggen wat er gebeurt: "Zoeken", "Bewaren", "Route openen". Dezelfde handeling heet overal hetzelfde.
- Onbekend is "Onbekend" of "Weten we nog niet". Nooit gokken.
- Getallen als cijfers ("12 plekken", "11:00").
- Foutmeldingen: wat er misging en wat je kunt doen. Geen excuses, geen vaagheid.

Niet doen (dit verraadt een tekstgenerator):
- Gedachtestreepjes (— of –) als stijlmiddel; gebruik een punt of komma.
- Middenpunten als scheiding ("A · B · C") en pijltjes in knoppen of links ("Bekijk →").
- Labels in HOOFDLETTERS boven koppen, of één woord in de kop anders gekleurd of cursief.
- Rijtjes van drie bijvoeglijke naamwoorden of drie korte zinnetjes achter elkaar ("Rustig. Eerlijk. Buiten.").
- Woorden als: ontdek, ervaar, naadloos, moeiteloos, zorgeloos, uniek, perfect, ultiem, jouw ideale, duik in,
  eerlijk (als verkooppraatje), transparant, "niet alleen ... maar ook", "of je nu ... of ...".
- Uitroeptekens en retorische vragen in lopende tekst.
- Uitleg over onze werkwijze of bronnen bij elk gegeven. Per pagina staat bovenaan "Laatste update: <datum>";
  dat is genoeg. Alleen een foto krijgt een kleine bronvermelding (auteursrecht).

## Ontwerpen

- Thema vast: zandpapier, bosgroen, avondzon, meerblauw, Fraunces + Inter, bosachtige donkere modus.
- Diepte met schaduw in lagen (`shadow-low`, `shadow-raised`, `shadow-float` uit `globals.css`), niet met randen om alles heen.
  Belangrijk ligt hoger: zoekkaart en sheets het hoogst, kaarten laag, achtergrondvlakken plat.
- Afronding volgt de hiërarchie: grote vlakken ruimer (24–28 px), kaarten 16–20 px, knoppen 12 px, chips rond.
- Beweging alleen als antwoord op een handeling (openen, bewaren, wisselen) plus één moment op de startpagina.
  Gebruik de veren uit `motion` (zie bestaande componenten) en respecteer `prefers-reduced-motion`.
- Tikdoelen minstens 44 px, tekst minstens 14 px, contrast minstens 4,5:1 in licht en donker.
- Controleer elke wijziging op iPhone-formaat, licht en donker, met een screenshot.
