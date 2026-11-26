Je bent een senior product designer en merkstrateeg (15+ jaar, mobiele consumentenapps, reis en kaarten,
toegankelijk ontwerp voor een oudere doelgroep). Je doet een volledige, kritische UI-, UX-, merk- en
logo-analyse van VrijStaan en levert één bestand `plan.md` op. Dat plan voert een AI-programmeur (Claude
Code) daarna stap voor stap uit in de codebase. Wees dus concreet tot op de pixel, de kleurcode en de
zin: elk punt moet zonder terugvragen te bouwen zijn.

# 1. Wat je krijgt

- **Screenshots** (bijlagen en in de zip, map `screenshots/`): telefoon 390 × 844 in licht en donker,
  plus desktop 1440 × 900. Per scherm `-boven` (wat je eerst ziet zonder scrollen) en `-volledig` (hele
  pagina). Schermen: 01 start, 02 zoeken (lijst), 04 zonder vertrektijd, 05 plekpagina met volledige
  gegevens, 06 plekpagina met onbekende vertrektijd, 08 mijn reis, 09 provinciepagina (Zeeland),
  10 doe mee, 11 plek aanmelden, 12 niet gevonden. De kaartschermen (zoeken op de kaart, Dichtbij)
  ontbreken omdat de kaart in de screenshot-omgeving niet laadde; beoordeel die op basis van de
  beschrijving in de documenten en zeg wat je nog wilt zien.
- **Documenten** (zip, map `documenten/`): PRD (doel, doelgroep, belofte, succesmaat), App Flow (alle
  schermen en paden), UI/UX Design Brief, stijlgids, tekststijl en de kleurtokens uit `globals.css`.
- **Logo** (zip, map `logo/`): `icon.svg` (bron), app-icoon 512 px, maskable-icoon en deelafbeelding `og.png`.

Lees eerst alles. Open de zip met je code-tool als dat nodig is.

# 2. Het product in het kort

**VrijStaan** (vrijstaan.nl) is een gratis camperplaatsengids voor Nederland, als mobiele website (PWA,
Next.js). De belofte in deze volgorde:

1. **Vertrektijd eerst**: per plek zie je of je zonder vaste vertrektijd kunt staan ("Geen vaste
   vertrektijd", "Per 24 uur", "Vertrek uiterlijk 12:00"). Geen enkele concurrent heeft dit als veld of
   filter. Er zijn drie vertrekgroepen: zonder vertrektijd (bosgroen), uitslapers met vertrek 12:00 of
   later (meerblauw), overige/onbekend (neutraal of grijs).
2. **Echte prijs**: nachtprijs met alle toeslagen (toeristenbelasting, stroom), anders staat er
   "+ toeslagen".
3. **Actuele gegevens**: "Laatste update: datum" bovenaan; ouder dan 12 maanden = "mogelijk verouderd".

Huidige cijfers: ±2.373 plekken, bij ±1.684 is de vertrektijd bekend. Livegang 1 januari 2027.
Hoofdmaat van succes: doorkliks per week naar de website of het telefoonnummer van een plek ("VrijStaan
helpt kiezen"). Concurrenten: Campercontact, park4night, ACSI (deels betaald, tijden alleen in vrije
tekst, advertenties en tracking). VrijStaan: gratis, geen advertenties, geen tracking van derden.

**Doelgroep**: Nederlandse camperaars van 40+ (ontwerp getoetst aan 65-jarigen), op een smartphone,
vaak onderweg, laat op de dag, wisselend licht. De vraag is "waar sta ik vannacht?". Tweede groep: wie
thuis vooruit plant (bewaren, reis met stops, rijtijden). Derde groep: eigenaren van plekken (claimen,
gegevens aanvullen). Kernpaden: start → Dichtbij of zoeken → plekpagina → Route/website/bellen; en
bewaren → Mijn reis.

**Merk en toon**: thema "natuur & vrijheid", drie woorden: **rustig, eerlijk, buiten**. Een professionele
reisgids, geen speelse app. Nederlands, je-vorm, korte gewone zinnen, geen marketingtaal, geen emoji,
geen uitroeptekens, geen nepurgentie. Onbekend heet "Onbekend": we verzinnen nooit data.

**Logo**: "Camper bij de klokzon" (gekozen 2 november 2026): camper op een heuvel voor de zakkende
avondzon, die tegelijk een klok is (de vertrektijd). Kleuren bosgroen, avondzon en zandpapier. Kleine
variant (≤ 32 px) zonder heuvel, met volledig groen vlak en grondlijn.

# 3. Vaste kaders (niet ter discussie, wel binnen werken)

Je mag elk kader bevragen, maar zet zo'n voorstel apart in hoofdstuk "Ter beslissing" met argumenten.
Alle andere aanbevelingen blijven binnen deze kaders:

- **Kleuren staan vast**: zandpapier `#F5F0E6`, surface `#FFFCF6`, sunken `#EDE6D8`, inkt `#1F2B24` /
  `#46524A` / `#5C665E`, bosgroen `#1F4E37`, avondzon `#B9592A`, meerblauw `#2F6F7E`, alert `#A8321D`.
  Donker thema "avond in het bos" (tokens in `kleurtokens-globals.css`). Kleur is betekenis: bosgroen =
  geen vaste vertrektijd en hoofdactie, meerblauw = uitslapers en water, avondzon alleen voor de
  hoofdactie op de start en de gekozen plek op de kaart. Eén accent per scherm.
- **Eén lettertype**: Geist (koppen 600, tekst 400). Afgewezen: Fraunces en andere serifs ("te AI,
  te kinderlijk").
- **Toegankelijkheid**: WCAG 2.1 AA in licht en donker, tekst minimaal 14 px (basis 16 px), tikdoelen
  minimaal 44 × 44 px, contrast ≥ 4,5:1, kleur nooit als enige drager.
- **Anti-AI-uitstraling** (stijlgids §2): hoeken maximaal 8 px (sheets 16 px), randen van 1 px in plaats
  van schaduw, geen verlopen, geen gekleurde sectievlakken, geen gevulde icoonblokjes naast elk
  gegeven, geen kopjes in hoofdletters, geen "→" in knoppen, geen getekende landschappen als
  foto-vervanging.
- **Data**: nooit iets verzinnen of suggereren dat we iets weten wat we niet weten.
- **Privacy**: geen tracking of scripts van derden, geen nieuwe externe diensten die gebruikers volgen.
- **Mobiel eerst**, Nederlands eerst. Techniek: Next.js 16, React, Tailwind 4, MapLibre-kaart.

# 4. Wat ik van je wil: de analyse

Beoordeel eerlijk en scherp. Geen complimenten als vulling; benoem wat goed is alleen als het behouden
moet blijven. Werk deze onderdelen af:

1. **Eerste indruk en merk** (5-secondentest): snapt een 60-jarige camperaar op de start binnen vijf
   seconden wat VrijStaan is en waarom het anders is? Komt "rustig, eerlijk, buiten" over? Voelt het
   betrouwbaar, of als een hobbyproject of als een AI-template? Waar wel en waar niet?
2. **Verhaal en positionering**: komt de unieke belofte (vertrektijd) sterk genoeg en vroeg genoeg over,
   op de start, in zoekresultaten, op de plekpagina en op de landingspagina's? Hoe is de koptekst,
   het ritme van de startpagina, de volgorde van de secties? Concreet herschreven teksten waar nodig.
3. **Logo en app-icoon**: leesbaarheid op 16, 32, 48, 180 en 512 px, onderscheidend vermogen tussen
   andere reis-apps op een beginscherm, symboliek (klokzon), verhouding woordmerk en beeldmerk,
   gedrag in de lichte en donkere kop, consistentie met de rest van de UI. Geef verbetervoorstellen als
   concrete SVG-aanpassingen (paden, maten, kleuren) of als heldere ontwerpopdracht, met de reden.
4. **Visueel systeem**: typografische hiërarchie, ruimte en ritme, dichtheid, uitlijning, iconen,
   kaarten en lijsten, consistentie tussen schermen, licht tegenover donker. Noem elke inconsistentie
   die je ziet (met scherm en plek).
5. **UX per scherm**: start, zoeken (lijst, chips, filterbalk), vertrekpagina's, plekpagina (volledig én
   onvolledig), Mijn reis, provinciepagina, Doe mee, Plek aanmelden, Niet gevonden, en op basis van de
   beschrijving ook kaart, Dichtbij en filtersheet. Per scherm: wat is de taak van de gebruiker, wat
   remt die af, wat ontbreekt, wat kan weg.
6. **Kernpad "vannacht een plek"**: tel de stappen en tikken van openen tot Route/bellen. Waar valt
   iemand af? Wat kan sneller zonder de rust te verliezen?
7. **Vertrouwen en eerlijkheid**: hoe gaat de UI om met onbekende gegevens, onvolledige plekken,
   ouderdom van data en foto's van websites? Werkt dat geruststellend of juist rommelig?
8. **Toegankelijkheid en ouderen**: leesbaarheid in zonlicht, tikdoelen, contrast, kleurgebruik,
   cognitieve belasting, taal. Wees specifiek waar iets de regels uit §3 overtreedt.
9. **Microcopy**: knoppen, lege toestanden, foutmeldingen, uitleg. Geef herschreven teksten in de
   VrijStaan-toon (zie `tekststijl-vrijstaan.md`).
10. **Desktop**: werkt de layout op een groot scherm, of is het een uitgerekte telefoon?
11. **Vergelijking**: wat doen Campercontact, park4night, Booking.com of Hipcamp beter op een
    vergelijkbaar scherm, en wat kan VrijStaan daarvan lenen zonder de kaders te breken?

# 5. Wat je oplevert: `plan.md`

Lever een downloadbaar Markdown-bestand `plan.md` (in het Nederlands) met precies deze opbouw:

```
# VrijStaan: UI/UX- en merkplan
## 1. Samenvatting
   (max. 10 regels: de 3 grootste problemen, de 3 grootste kansen, het oordeel in één zin)
## 2. Bevindingen per onderdeel
   (onderdelen 1 t/m 11 hierboven; per bevinding: wat je ziet, op welk scherm, waarom het een
   probleem is voor deze doelgroep, ernst: hoog / middel / laag)
## 3. Logo en merk
## 4. Actieplan
   (de taken, zie format hieronder, gesorteerd op prioriteit)
## 5. Ter beslissing voor de eigenaar
   (voorstellen die een vast kader raken, elk met voor, tegen en jouw advies)
## 6. Wat je niet moet veranderen
   (wat goed werkt en behouden moet blijven, met de reden)
## 7. Open vragen
   (wat je niet kon beoordelen en welke extra screenshots of gegevens je zou willen)
```

**Format per taak in het actieplan** (dit is het belangrijkste deel; schrijf het voor een programmeur
die het scherm niet zelf beoordeelt):

```
### T<nummer>. <korte titel>
- Prioriteit: P1 (vóór livegang) / P2 (kort daarna) / P3 (later)
- Impact: hoog/middel/laag · Moeite: S/M/L
- Scherm(en) en element: bv. "Plekpagina, beslisblok, cel Prijs" + screenshotnaam
- Nu: wat er nu staat (tekst, maat, kleur, volgorde)
- Wordt: precies wat het moet worden. Noem waarden: px, Tailwind-klassen waar mogelijk
  (bv. `text-h2`, `rounded-lg`, `border-line`), kleurtokens (`forest`, `ink-2`) of hexcodes,
  volgorde van elementen, de letterlijke nieuwe tekst
- Waarom: het probleem voor de gebruiker en welk principe of welke heuristiek dit oplost
- Klaar als: toetsbare acceptatiecriteria (bv. "op 390 px staat de eerste plek boven de vouw",
  "contrast ≥ 4,5:1 in donker", "tikdoel 44 × 44 px")
- Raakt kader: nee / ja, welk (dan hoort de taak in hoofdstuk 5)
```

Eisen aan het plan:

- Minstens 25 en hoogstens 60 taken, geen dubbele. Liever 30 scherpe taken dan 60 vage.
- Elke taak is los uit te voeren en te controleren. Geen "verbeter de hiërarchie" zonder maten.
- Gebruik alleen tokens en kleuren uit §3, of zet het voorstel in "Ter beslissing".
- Nieuwe teksten letterlijk uitschrijven, in de je-vorm, zonder emoji, uitroeptekens of
  gedachtestreepjes.
- Verzin geen functies die gegevens nodig hebben die we niet hebben (zoals live beschikbaarheid of
  boeken), tenzij als idee in "Ter beslissing".
- Zeg het eerlijk als iets op de screenshots er niet goed uitziet, ook als het in de stijlgids staat.

Begin met een korte bevestiging welke bestanden je hebt kunnen openen en lezen. Stel daarna geen
vragen meer, maar maak de volledige analyse en het `plan.md`. Zet onzekerheden in hoofdstuk 7.
