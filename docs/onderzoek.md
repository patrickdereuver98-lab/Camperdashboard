# Onderzoek: VrijStaan als "booking.com voor camperaars"

## Doelgroep

Camperaars in Nederland: veel 50-plussers en gepensioneerden, maar ook een groeiende groep jonge stellen en gezinnen
in (huur)campers en buscampers. Ze plannen voor een deel vooraf, maar beslissen vaak **onderweg, op de telefoon**
waar ze die avond staan. Een smartphone of tablet is dus het hoofdapparaat.

Wat ze meteen willen weten, op volgorde van belang (Campercontact-gids, camperforum.nl-discussies, ANWB-kampeergidsen):

1. **Mag ik hier staan en is er plek?** Type plek, aantal plekken, openingsperiode, reserveren ja/nee
2. **Wat kost het?** Prijs per nacht, en of toeristenbelasting en stroom inbegrepen zijn
3. **Service:** water innemen, grijs- en zwartwater/chemisch toilet lozen, stroom
4. **Comfort:** toilet, douche, wifi, honden toegestaan
5. **Geschikt voor mijn camper?** Maximale lengte, ondergrond (verhard of gras), vlak
6. **Omgeving:** rustig, aan het water, natuur, afstand tot centrum en winkels
7. **Hoe kom ik er?** Rij-afstand en reistijd, route
8. **Kan ik het vertrouwen?** Recente reviews, foto's, actuele informatie

Bronnen: [Campercontact: camperplaatsen kiezen](https://www.campercontact.com/nl/content/camperplaatsen),
[Camperforum: wat vinden jullie belangrijk op een camperplaats?](https://camperforum.nl/viewtopic.php?p=1418126)

## Wat we leren van Booking.com, Trivago en Airbnb

| Patroon | Toepassing bij VrijStaan |
|---|---|
| Altijd zichtbaar zoekveld (bestemming eerst) | Sticky zoekbalk met suggesties voor woonplaats en provincie; zoeken rond een plaats sorteert op afstand |
| Resultaatkaart: grote foto, naam, locatie + afstand, scorebadge, 2–3 kernvoorzieningen, prijs rechtsonder | Zelfde hiërarchie; prijs "per nacht" altijd zichtbaar; geen nep-urgentie |
| Filters op mobiel in een apart scherm met live teller ("Toon 128 plekken") | Bottom sheet met teller, applied-filter-chips boven de lijst (Baymard: gekozen filters moeten zichtbaar blijven) |
| Wisselen tussen lijst en kaart met één knop | Zwevende kaart/lijst-knop; op de kaart een sleepbare sheet |
| Detailpagina: fotogalerij, scorekaart met subscores, "populairste voorzieningen", huisregels, FAQ, omgeving | Fotogalerij met swipe, score met subscores (locatie, rust, voorzieningen, prijs/kwaliteit), voorzieningenraster, praktische info (seizoen, max lengte, reserveren), route met echte rijtijd |
| Verlanglijst / vergelijken | "Mijn reis": bewaren, ordenen, nachten, totale route met echte rij-afstand |
| Vertrouwen: geverifieerde reviews, "laatst bijgewerkt" | Gemodereerde reviews; per plek "gegevens gecontroleerd op" en bron |

Bron filters op mobiel: [Baymard: mobile filtering options](https://baymard.com/mcommerce-usability/benchmark/mobile-page-types/filtering-options)

## Data

- **Basis:** OpenStreetMap (`tourism=caravan_site`, `tourism=camp_site` + `motorhome=*`, `amenity=parking` + `motorhome=designated`).
  Relevante tags: `power_supply`, `sanitary_dump_station`, `water_point`/`drinking_water`, `toilets`, `shower`,
  `internet_access`, `dog`, `capacity`, `maxlength`, `fee`/`charge`, `opening_hours`, `website`, `phone`.
  Bron: [OSM wiki tourism=caravan_site](https://wiki.openstreetmap.org/wiki/Tag:tourism=caravan_site)
- **Verrijking:** de website van de plek zelf (JSON-LD, meta-tags en tekst), met respect voor `robots.txt`.
  We scrapen **niet** bij concurrenten zoals Park4Night of Campercontact; hun voorwaarden verbieden dat.
- **Kwaliteitsdrempel:** een plek wordt alleen gepubliceerd als minstens **80% van de 15 kernvelden** expliciet bekend is.
  "Niet vermeld" telt niet als bekend.

## Rij-afstanden

`open-distance.com` bestaat niet (het domein heeft geen DNS, oktober 2026). Alternatieven:

- **OpenRouteService:** gratis sleutel, 2.000 routes per dag, profiel `driving-hgv` met voertuigafmetingen.
  [Plans](https://openrouteservice.org/plans/)
- **FOSSGIS OSRM** (`routing.openstreetmap.de`): zonder sleutel, fair use, bronvermelding verplicht.
  [About](https://routing.openstreetmap.de/about.html)

De site gebruikt ORS als er een sleutel is ingesteld, anders FOSSGIS, en cachet elke route in de database.
