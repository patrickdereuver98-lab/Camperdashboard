# Extractor tegen 224 voorbeeldfragmenten (281 controles)

## Slagingspercentage per veld

| veld | goed | totaal | % |
|---|---|---|---|
| vertrek | 60 | 89 | 67% |
| toegang | 2 | 2 | 100% |
| aankomst | 6 | 8 | 75% |
| prijs | 61 | 75 | 81% |
| toeslagen | 17 | 24 | 71% |
| voorzieningen | 27 | 44 | 61% |
| seizoen | 30 | 39 | 77% |
| **totaal** | 203 | 281 | 72% |

## Alle controles

| id | invoer | veld | verwacht | code gaf | uitkomst |
|---|---|---|---|---|---|
| V01 seizoensgasten vrij | Voor seizoensgasten gelden geen vaste vertrektijden. | dep | "-" | "-" | goed |
| V02 jaarplaats komen en gaan | Op onze jaarplaatsen voor campers kunt u komen en gaan wanneer u wilt. | dep | "-" | "-" | goed |
| V03 seizoenplek vrij | Houders van een seizoenplek hebben vrije aankomst- en vertrektijden. | dep | "-" | "vrij" | **FOUT** |
| V04 chalets | Chalets: uitchecken vóór 10:00 uur. | dep | "-" | "-" | goed |
| V05 safaritenten | De safaritenten dienen om 10.00 uur verlaten te zijn. | dep | "-" | "-" | goed |
| V06 trekkershut | De trekkershut moet u uiterlijk 10.30 uur verlaten. | dep | "-" | "-" | goed |
| V07 huisjes | In onze huisjes is het vertrek op vrijdag voor 10 uur. | dep | "-" | "-" | goed |
| V08 groepen | Groepen vertrekken uiterlijk 11:00 uur. | dep | "-" | "-" | goed |
| V09 dagrecreatie | Dagrecreatie: uitchecken vóór 13:00 uur. | dep | "-" | "vast 13:00" | **FOUT** |
| V10 receptietijd | De receptie is geopend van 9.00 tot 12.00 uur. Uw vertrek kunt u hier melden. | dep | "-" | "-" | goed |
| V11 slagboom nacht | De slagboom is gesloten tussen 23.00 en 7.00 uur; vertrekken kan dan niet. | dep | "-" | "-" | goed |
| V12 slagboom open | De slagboom is geopend van 07:30 tot 23:00 uur. | dep | "-" | "-" | goed |
| V12 slagboom open | De slagboom is geopend van 07:30 tot 23:00 uur. | access_hours | "07:30–23:00" | "07:30–23:00" | goed |
| V13 sanitair schoonmaak | Op de dag van vertrek wordt het sanitair om 11.00 uur schoongemaakt. | dep | "-" | "vast 11:00" | **FOUT** |
| V14 24 uur bereikbaar | Onze camperplaats is 24 uur per dag bereikbaar. | dep | "-" | "-" | goed |
| V14 24 uur bereikbaar | Onze camperplaats is 24 uur per dag bereikbaar. | access_24h | true | true | goed |
| V15 24 uur parkeren | Campers mogen hier maximaal 24 uur parkeren. | dep | "-" | "-" | goed |
| V16 uitchecken in overleg | Uitchecken in overleg. | dep | "-" | "-" | goed |
| V17 late check-out betaald | Late check-out tegen betaling € 10. | dep | "-" | "-" | goed |
| V18 vast + late check-out | Uitchecken vóór 11:00 uur. Late check-out tot 17:00 uur tegen betaling van € 10. | dep | "vast 11:00" | "vast 11:00" | goed |
| V19 hoogseizoen andere tijd | Vertrek voor 12.00 uur, in het hoogseizoen 10.30 uur. | dep | "vast 12:00" of "-" | "-" | goed |
| V20 aankomst en vertrek één zin | Aankomst vanaf 13:00 en vertrek tot 11:00. | dep | "vast 11:00" | "vast 11:00" | goed |
| V20 aankomst en vertrek één zin | Aankomst vanaf 13:00 en vertrek tot 11:00. | checkin_from | "13:00" | "13:00" | goed |
| V21 tabel kolommen | Aankomst Vertrek 13:00 11:00 | dep | "vast 11:00" | "-" | **FOUT** |
| V21 tabel kolommen | Aankomst Vertrek 13:00 11:00 | checkin_from | "13:00" | leeg | **FOUT** |
| V22 tabel rijen | Aankomst vanaf 13:00 uur Vertrek voor 11:00 uur | dep | "vast 11:00" | "vast 11:00" | goed |
| V22 tabel rijen | Aankomst vanaf 13:00 uur Vertrek voor 11:00 uur | checkin_from | "13:00" | "13:00" | goed |
| V23 tabs en regels (platte tekst) | Aankomst 13:00 Vertrek 11:00 | dep | "vast 11:00" | "vast 11:00" | goed |
| V23 tabs en regels (platte tekst) | Aankomst 13:00 Vertrek 11:00 | checkin_from | "13:00" | "13:00" | goed |
| V24 11u | Vertrek voor 11u. | dep | "vast 11:00" | "vast 11:00" | goed |
| V25 11 uur | Vertrek uiterlijk 11 uur. | dep | "vast 11:00" | "vast 11:00" | goed |
| V26 11.00u | Vertrektijd: 11.00u | dep | "vast 11:00" | "vast 11:00" | goed |
| V27 half twaalf | Vertrekken graag voor half twaalf. | dep | "vast 11:30" | "-" | **FOUT** |
| V28 12:00 's middags | Uitchecken vóór 12:00 's middags. | dep | "vast 12:00" | "vast 12:00" | goed |
| V29 tussen 10 en 12 | Vertrek tussen 10 en 12 uur. | dep | "vast 12:00" | "-" | **FOUT** |
| V30 Abreise bis 11 Uhr | Abreise bis 11 Uhr. | dep | "vast 11:00" | "vast 11:00" | goed |
| V31 Anreise/Abreise | Anreise ab 14 Uhr, Abreise bis 11 Uhr. | dep | "vast 11:00" | "vast 11:00" | goed |
| V31 Anreise/Abreise | Anreise ab 14 Uhr, Abreise bis 11 Uhr. | checkin_from | "14:00" | "14:00" | goed |
| V32 check-out before 11 am | Check-out before 11 am. | dep | "vast 11:00" | "-" | **FOUT** |
| V33 departure by noon | Departure by noon. | dep | "vast 12:00" | "-" | **FOUT** |
| V34 AM/PM | Check-out: 11:00 AM. Check-in: 2:00 PM. | dep | "vast 11:00" | "vast 11:00" | goed |
| V34 AM/PM | Check-out: 11:00 AM. Check-in: 2:00 PM. | checkin_from | "14:00" | leeg | **FOUT** |
| V35 geen vaste tijd, wel voor 12 | Wij kennen geen vaste vertrektijd, wel graag voor 12 uur weg. | dep | "-" of "vast 12:00" | "-" | goed |
| V36 camping 12, camperplaats 10 | Camping: vertrek voor 12:00 uur. Camperplaats: vertrek voor 10:00 uur. | dep | "vast 10:00" | "vast 10:00" | goed |
| V37 camperplaats vrij, camping 11 | Op de camperplaats gelden geen vaste vertrektijden. Op de camping vertrekt u voor 11.00 uur. | dep | "vrij" | "vrij" | goed |
| V38 camperplaats 11, camping vrij | Camperplaatsen: vertrek uiterlijk 11:00 uur. Voor het kampeerveld hanteren wij geen vaste vertrektijden. | dep | "vast 11:00" | "-" | **FOUT** |
| V39 kampeerplaats 12, chalet 10 | Kampeerplaatsen: vertrek vóór 12.00 uur. Chalets: vertrek vóór 10.00 uur. | dep | "vast 12:00" | "vast 12:00" | goed |
| V40 chalet 10, kampeerplaats 12 | Chalets: vertrek vóór 10.00 uur. Kampeerplaatsen: vertrek vóór 12.00 uur. | dep | "vast 12:00" | "vast 12:00" | goed |
| V41 vertrekken wanneer u wilt zonder camper | U kunt vertrekken wanneer u wilt. | dep | "-" | "-" | goed |
| V42 camperplaats vertrekken wanneer u wilt | Op onze camperplaats kunt u vertrekken wanneer u wilt. | dep | "vrij" | "vrij" | goed |
| V43 aankomsttijd is vertrektijd | De aankomsttijd is ook de vertrektijd. | dep | "per24" | "per24" | goed |
| V44 € per 24 uur campers | Tarief voor campers: € 14 per 24 uur. | dep | "per24" | "per24" | goed |
| V45 opgeleverd | Op de vertrekdag dient de plaats om 12.00 uur schoon te zijn opgeleverd. | dep | "vast 12:00" | "vast 12:00" | goed |
| V46 later vertrekken tot 18 | Wilt u later vertrekken? Dat kan tot 18.00 uur voor € 7,50. | dep | "-" | "-" | goed |
| V47 extra nacht na 11 | Vertrek vóór 11.00 uur; bij vertrek na 11.00 uur rekenen wij een extra nacht. | dep | "vast 11:00" | "vast 11:00" | goed |
| V48 aankomst na, vertrek voor | Aankomst na 14.00 uur, vertrek voor 12.00 uur. | dep | "vast 12:00" | "vast 12:00" | goed |
| V48 aankomst na, vertrek voor | Aankomst na 14.00 uur, vertrek voor 12.00 uur. | checkin_from | "14:00" | "14:00" | goed |
| V49 check-out venster | Check-out 10:00 - 12:00 | dep | "vast 12:00" | "vast 12:00" | goed |
| V50 zondag later | Vertrektijd: 12:00 uur (op zondag 16:00 uur). | dep | "vast 12:00" | "vast 12:00" | goed |
| V51 niet vóór 7 uur | Vertrekken vóór 7.00 uur is niet toegestaan in verband met de nachtrust. | dep | "-" | "vast 07:00" | **FOUT** |
| V52 vroeg vertrek afrekenen | Bij vertrek vóór 9.00 uur graag de avond ervoor afrekenen. | dep | "-" | "vast 09:00" | **FOUT** |
| V53 stilte | Tussen 23.00 en 7.00 uur is het stil op de camping; aankomen of vertrekken is dan niet mogelijk. | dep | "-" | "-" | goed |
| V54 jederzeit | An- und Abreise jederzeit möglich. | dep | "vrij" | "vrij" | goed |
| V55 no fixed check-out | No fixed check-out time. | dep | "vrij" | "vrij" | goed |
| V56 motorhomes leave any time | Motorhomes can leave at any time. | dep | "vrij" | "vrij" | goed |
| V57 check-out time is 12:00 | Check-out time is 12:00. | dep | "vast 12:00" | "vast 12:00" | goed |
| V58 haakjes camperplaatsen | Vertrek uiterlijk 10.30 uur (camperplaatsen 12.00 uur). | dep | "vast 12:00" | "vast 10:30" | **FOUT** |
| V59 twee vensters | Aankomst tussen 14:00 en 20:00 uur. Vertrek tussen 8:00 en 11:00 uur. | dep | "vast 11:00" | "vast 11:00" | goed |
| V59 twee vensters | Aankomst tussen 14:00 en 20:00 uur. Vertrek tussen 8:00 en 11:00 uur. | checkin_from | "14:00" | "14:00" | goed |
| V60 sleutel chalet | Op de dag van vertrek dient u vóór 11:00 uur de sleutel van het chalet in te leveren. | dep | "-" | "vast 11:00" | **FOUT** |
| V61 kopje + alinea | Vertrek Voor 11.00 uur | dep | "vast 11:00" | "vast 11:00" | goed |
| V62 seizoenplaats einddatum | Seizoenplaats: vertrek uiterlijk 31 oktober vóór 12.00 uur. | dep | "-" | "-" | goed |
| V63 bus vertrekt | De bus naar het strand vertrekt om 10.15 uur. | dep | "-" | "vast 10:15" | **FOUT** |
| V64 veerboot | De veerboot vertrekt elke dag om 9.30 uur vanaf de haven. | dep | "-" | "vast 09:30" | **FOUT** |
| V65 wandeling vertrek | Wandeling met de boswachter: vertrek 10.00 uur vanaf de parkeerplaats. | dep | "-" | "vast 10:00" | **FOUT** |
| V66 camperplaats verlaten | Wij verzoeken u de camperplaats voor 11.00 uur te verlaten. | dep | "vast 11:00" | "vast 11:00" | goed |
| V67 of in overleg | Vertrek vóór 11:00 uur of in overleg later. | dep | "vast 11:00" | "vast 11:00" | goed |
| V68 dagtarief na 12 | Vertrek is mogelijk tot 12:00 uur, daarna geldt het dagtarief van € 5. | dep | "vast 12:00" | "vast 12:00" | goed |
| V69 Ferienhäuser (DE verhuur) | Ferienhäuser: Abreise bis 10 Uhr. | dep | "-" | "vast 10:00" | **FOUT** |
| V70 Mietunterkünfte + Stellplatz | Mietunterkünfte: Abreise bis 10 Uhr. Stellplätze: Abreise bis 12 Uhr. | dep | "vast 12:00" | "vast 10:00" | **FOUT** |
| V71 cabins (EN verhuur) | Cabins and mobile homes: check-out by 10:00. | dep | "-" | "vast 10:00" | **FOUT** |
| V72 Rezeption | Die Rezeption ist von 9 bis 12 Uhr geöffnet, auch am Abreisetag. | dep | "-" | "-" | goed |
| V73 Abreise spätestens 12 Uhr | Wir bitten Sie, den Platz am Abreisetag bis spätestens 12 Uhr zu verlassen. | dep | "vast 12:00" | "vast 12:00" | goed |
| V74 Frühstück/Abfahrt bus | Abfahrt des Busses nach Amsterdam um 9.30 Uhr. Abreise der Gäste nach Absprache. | dep | "-" | "-" | goed |
| V75 stacaravan, toerplaats | Stacaravans verlaat u voor 10.00 uur, toeristische plaatsen voor 12.00 uur. | dep | "vast 12:00" | "-" | **FOUT** |
| V76 twee pagina's tegenstrijdig vast | Vertrek voor 11.00 uur. ⏎ Vertrek uiterlijk 12.00 uur. | dep | "-" | "vast 11:00" | **FOUT** |
| V77 twee pagina's vrij en vast | Bij ons gelden geen vaste vertrektijden. ⏎ Huisregels: vertrek voor 11.00 uur. | dep | "-" | "-" | goed |
| V78 12.00u punt-zinseinde | U dient de plaats vóór 12.00 uur te verlaten, tenzij anders overeengekomen. | dep | "vast 12:00" | "vast 12:00" | goed |
| V79 uitchecktijd in FAQ-vraag | Hoe laat moet ik uitchecken? Uiterlijk om 11.00 uur. | dep | "vast 11:00" | "-" | **FOUT** |
| V80 kinderclub | Kinderclub: verzamelen en vertrek om 10.30 uur bij het speelveld. | dep | "-" | "vast 10:30" | **FOUT** |
| V81 middag 12 uur 's | De plek dient vóór 12 uur 's middags leeg te zijn. | dep | "vast 12:00" | "-" | **FOUT** |
| V82 kwart over | Vertrek uiterlijk kwart voor twaalf. | dep | "vast 11:45" | "-" | **FOUT** |
| V83 annuleren voor vertrek | Annuleren kan tot 14 dagen voor aankomst. Vertrek eerder dan gepland geeft geen recht op restitutie. | dep | "-" | "-" | goed |
| V84 winterstalling ophalen | Winterstalling: caravans ophalen op zaterdag, vertrek tussen 9.00 en 12.00 uur. | dep | "-" | "vast 12:00" | **FOUT** |
| V85 parkeerplaats auto | Auto's van bezoekers moeten de parkeerplaats voor 12.00 uur verlaten. | dep | "-" | "vast 12:00" | **FOUT** |
| V86 per24 betalen | Op de camperplaats betaalt u per 24 uur vanaf aankomst. | dep | "per24" | "per24" | goed |
| V87 jaarplaats tijd | Jaarplaatsen: vertrek uiterlijk 12.00 uur op de laatste dag van het seizoen. | dep | "-" | "vast 12:00" | **FOUT** |
| V88 vertrek 10-11 marktdag | Op marktdagen (dinsdag) moet de camperplaats om 7.00 uur leeg zijn. | dep | "-" | "vast 07:00" | **FOUT** |
| P01 vanaf € 15 | Camperplaats vanaf € 15 per nacht. | price_eur | 15 | 15 | goed |
| P02 zomer/winter | Camperplaats: zomer € 20 per nacht, winter € 15 per nacht. | price_eur | 15 | 15 | goed |
| P02 zomer/winter | Camperplaats: zomer € 20 per nacht, winter € 15 per nacht. | price_note | /20/ | "vanaf € 15,00 per nacht; hoogste genoemde tarief € 20,00" | goed |
| P03 laag/hoogseizoen | Camper incl. 2 personen: laagseizoen € 18,50 per nacht, hoogseizoen € 24,50 per nacht. | price_eur | 18.5 | 18.5 | goed |
| P04 alleen per persoon | Tarief: € 7,50 per persoon per nacht. | price_eur | leeg | leeg | goed |
| P04 alleen per persoon | Tarief: € 7,50 per persoon per nacht. | extra:Per persoon | [7.5,"per persoon per nacht"] | [7.5,"per persoon per nacht"] | goed |
| P05 pppn + camper | Volwassenen € 6,00 p.p.p.n. Camper € 8,00 per nacht. | price_eur | 8 | 8 | goed |
| P05 pppn + camper | Volwassenen € 6,00 p.p.p.n. Camper € 8,00 per nacht. | extra:Per persoon | [6,"per persoon per nacht"] | [6,"per persoon per nacht"] | goed |
| P06 2 personen incl. | Kampeerplaats 2 personen incl. stroom € 27,50 per nacht. | price_eur | 27.5 | 27.5 | goed |
| P07 tent vóór camper | Tent € 12 per nacht. Camper € 22 per nacht. | price_eur | 22 | 22 | goed |
| P08 caravan + toeslagen | Caravan € 20,00 per nacht Hond € 2,50 per nacht Kind t/m 12 jaar € 3,00 Douche € 0,50 Toeristenbelasting € 1,45 p.p.p.n. | price_eur | 20 | 20 | goed |
| P08 caravan + toeslagen | Caravan € 20,00 per nacht Hond € 2,50 per nacht Kind t/m 12 jaar € 3,00 Douche € 0,50 Toeristenbelasting € 1,45 p.p.p.n. | extra:Hond | [2.5,"per nacht"] | [2.5,"per nacht"] | goed |
| P08 caravan + toeslagen | Caravan € 20,00 per nacht Hond € 2,50 per nacht Kind t/m 12 jaar € 3,00 Douche € 0,50 Toeristenbelasting € 1,45 p.p.p.n. | extra:Kind | [3,null] | [3,null] | goed |
| P08 caravan + toeslagen | Caravan € 20,00 per nacht Hond € 2,50 per nacht Kind t/m 12 jaar € 3,00 Douche € 0,50 Toeristenbelasting € 1,45 p.p.p.n. | extra:Douche | [0.5,null] | [0.5,null] | goed |
| P08 caravan + toeslagen | Caravan € 20,00 per nacht Hond € 2,50 per nacht Kind t/m 12 jaar € 3,00 Douche € 0,50 Toeristenbelasting € 1,45 p.p.p.n. | extra:Toeristenbelasting | [1.45,"per persoon per nacht"] | [1.45,"per persoon per nacht"] | goed |
| P09 kWh | Stroom: € 0,50 per kWh. | price_eur | leeg | leeg | goed |
| P09 kWh | Stroom: € 0,50 per kWh. | extra:Stroom | [0.5,"per kWh"] | leeg | **FOUT** |
| P10 stroom per nacht | Camperplaats € 14 per nacht. Stroom € 3 per nacht. | price_eur | 14 | 14 | goed |
| P10 stroom per nacht | Camperplaats € 14 per nacht. Stroom € 3 per nacht. | extra:Stroom | [3,"per nacht"] | [3,"per nacht"] | goed |
| P11 gratis mits diner | Gratis overnachten voor campers, mits u dineert in ons restaurant. | price_eur | leeg | leeg | goed |
| P12 gratis camperplaats | Gratis camperplaats aan de haven. | price_eur | 0 | 0 | goed |
| P13 gratis met camper | U kunt hier gratis overnachten met uw camper. | price_eur | 0 | 0 | goed |
| P14 borg + camper | Borg sleutel slagboom € 20. Camper € 16 per nacht. | price_eur | 16 | 16 | goed |
| P15 alleen borg | Sleutel sanitair: borg € 10. | price_eur | leeg | leeg | goed |
| P16 €15,- | Camperplaats €15,- per nacht. | price_eur | 15 | 15 | goed |
| P17 15 euro | Een overnachting kost 15 euro. | price_eur | 15 | 15 | goed |
| P18 EUR 15 | Camperplaats: EUR 15 per nacht. | price_eur | 15 | leeg | **FOUT** |
| P19 15,00 p.n. | Camper 15,00 p.n. | price_eur | 15 | leeg | **FOUT** |
| P20 duizendtal + nacht | Seizoenplaats € 1.250,00. Camperplaats € 17,50 per nacht. | price_eur | 17.5 | 17.5 | goed |
| P21 alleen seizoenplaats | Seizoenplaats camper € 1.250,- | price_eur | leeg | leeg | goed |
| P22 jaarplaats | Jaarplaats camper: € 2.450 per jaar. | price_eur | leeg | leeg | goed |
| P23 tarieven 2025 én 2026 | Tarieven 2025: camper € 16 per nacht. Tarieven 2026: camper € 18 per nacht. | price_eur | 18 | 16 | **FOUT** |
| P24 arrangement | Arrangement: 3 nachten camperplaats incl. diner € 65. | price_eur | leeg | 65 | **FOUT** |
| P25 dagtarief parkeren + nacht | Parkeren dagtarief € 6 per dag. Camper overnachten € 12 per nacht. | price_eur | 12 | 12 | goed |
| P26 alleen dagparkeren | Dagtarief campers: € 7,50 per dag, overnachten is niet toegestaan. | price_eur | leeg | 7.5 | **FOUT** |
| P27 ACSI | Met de ACSI CampingCard betaalt u € 21 per nacht. Normaal tarief camperplaats € 32 per nacht. | price_eur | 32 | 32 | goed |
| P28 week/maand | Camperplaats € 90 per week, € 300 per maand. | price_eur | leeg | leeg | goed |
| P29 incl. toeristenbelasting | Camperplaats: € 17,50 per nacht inclusief stroom, water en toeristenbelasting. | price_eur | 17.5 | 17.5 | goed |
| P29 incl. toeristenbelasting | Camperplaats: € 17,50 per nacht inclusief stroom, water en toeristenbelasting. | tourist_tax_included | true | leeg | **FOUT** |
| P30 excl. toeristenbelasting | Camper € 15 per nacht exclusief toeristenbelasting van € 1,60 p.p.p.n. | price_eur | 15 | 15 | goed |
| P30 excl. toeristenbelasting | Camper € 15 per nacht exclusief toeristenbelasting van € 1,60 p.p.p.n. | tourist_tax_included | false | false | goed |
| P30 excl. toeristenbelasting | Camper € 15 per nacht exclusief toeristenbelasting van € 1,60 p.p.p.n. | extra:Toeristenbelasting | [1.6,"per persoon per nacht"] | [1.6,"per persoon per nacht"] | goed |
| P31 per camper per nacht | € 12,50 per camper per nacht. | price_eur | 12.5 | 12.5 | goed |
| P32 12 euro per nacht | Overnachten: 12 euro per nacht, incl. 2 personen. | price_eur | 12 | 12 | goed |
| P33 extra persoon, hond gratis | Camperplaats € 18 per nacht. Extra persoon € 4 per nacht. Hond gratis. | price_eur | 18 | 18 | goed |
| P33 extra persoon, hond gratis | Camperplaats € 18 per nacht. Extra persoon € 4 per nacht. Hond gratis. | extra:Per persoon | [4,"per nacht"] | [4,"per nacht"] | goed |
| P33 extra persoon, hond gratis | Camperplaats € 18 per nacht. Extra persoon € 4 per nacht. Hond gratis. | dogs | true | true | goed |
| P34 bouwstenen | Volwassene € 6,50 per nacht Kind € 3,50 per nacht Camper € 7,00 per nacht Auto € 2,50 per nacht | price_eur | 7 | 7 | goed |
| P34 bouwstenen | Volwassene € 6,50 per nacht Kind € 3,50 per nacht Camper € 7,00 per nacht Auto € 2,50 per nacht | extra:Per persoon | [6.5,"per nacht"] | leeg | **FOUT** |
| P34 bouwstenen | Volwassene € 6,50 per nacht Kind € 3,50 per nacht Camper € 7,00 per nacht Auto € 2,50 per nacht | extra:Kind | [3.5,"per nacht"] | [3.5,"per nacht"] | goed |
| P35 Duits | Stellplatz: 15 € pro Nacht inkl. Strom. | price_eur | 15 | 15 | goed |
| P36 Engels | Motorhome pitch: €18 per night. | price_eur | 18 | 18 | goed |
| P37 lengte | Camper tot 7 meter € 15 per nacht, langer dan 7 meter € 20 per nacht. | price_eur | 15 | 15 | goed |
| P38 wasmachine | Wasmachine € 5 per keer. Camper € 19,00 per nacht. | price_eur | 19 | 19 | goed |
| P39 fietsverhuur | Verhuur fietsen € 12,50 per dag. | price_eur | leeg | leeg | goed |
| P40 hond alleen | Hond: € 2 per nacht. | price_eur | leeg | leeg | goed |
| P40 hond alleen | Hond: € 2 per nacht. | extra:Hond | [2,"per nacht"] | leeg | **FOUT** |
| P40 hond alleen | Hond: € 2 per nacht. | dogs | true | true | goed |
| P41 per 24 uur | Camperplaats: € 10 per 24 uur. | price_eur | 10 | 10 | goed |
| P41 per 24 uur | Camperplaats: € 10 per 24 uur. | dep | "per24" | "per24" | goed |
| P42 prijs per nacht haakjes | Prijs per nacht: € 22,- (2 pers., camper, stroom). | price_eur | 22 | 22 | goed |
| P43 trekkershut + camper | Trekkershut € 45 per nacht. Camper € 20 per nacht. | price_eur | 20 | 20 | goed |
| P44 chalet | Chalet vanaf € 65 per nacht. | price_eur | leeg | leeg | goed |
| P45 douchemunt | Douchemunt € 1. Camperplaats € 13. | price_eur | 13 | 13 | goed |
| P46 tabel met pipes | Kampeerplaats € 25,00 Extra persoon € 5,00 Hond € 3,00 Toeristenbelasting € 1,20 p.p.p.n. | price_eur | 25 | 25 | goed |
| P46 tabel met pipes | Kampeerplaats € 25,00 Extra persoon € 5,00 Hond € 3,00 Toeristenbelasting € 1,20 p.p.p.n. | extra:Per persoon | [5,null] | [5,null] | goed |
| P46 tabel met pipes | Kampeerplaats € 25,00 Extra persoon € 5,00 Hond € 3,00 Toeristenbelasting € 1,20 p.p.p.n. | extra:Hond | [3,null] | [3,null] | goed |
| P46 tabel met pipes | Kampeerplaats € 25,00 Extra persoon € 5,00 Hond € 3,00 Toeristenbelasting € 1,20 p.p.p.n. | extra:Toeristenbelasting | [1.2,"per persoon per nacht"] | [1.2,"per persoon per nacht"] | goed |
| P47 kamer met ontbijt | Kamer met ontbijt € 60 per nacht. | price_eur | leeg | leeg | goed |
| P48 lozen en water | Lozen van grijs water en chemisch toilet: € 3 per keer. Water tanken € 1 per 100 liter. | price_eur | leeg | leeg | goed |
| P48 lozen en water | Lozen van grijs water en chemisch toilet: € 3 per keer. Water tanken € 1 per 100 liter. | extra:Lozen | [3,"per keer"] | leeg | **FOUT** |
| P48 lozen en water | Lozen van grijs water en chemisch toilet: € 3 per keer. Water tanken € 1 per 100 liter. | extra:Water | [1,"per 100 liter"] | [3,"per keer"] | **FOUT** |
| P49 kost € incl stroom | Overnachten kost € 12,50, inclusief stroom. | price_eur | 12.5 | 12.5 | goed |
| P50 per nacht betaalt u | Per nacht betaalt u € 16 voor een camper met 2 personen. | price_eur | 16 | leeg | **FOUT** |
| P51 17,50 euro per nacht | Camperplaats: 17,50 euro per nacht. | price_eur | 17.5 | 17.5 | goed |
| P52 p.n. | Tarief camper: € 20,- p.n. | price_eur | 20 | 20 | goed |
| P53 hoog/laag met data | Staanplaats camper hoogseizoen (1 juli - 31 augustus): € 27,50; laagseizoen: € 19,50. | price_eur | 19.5 | 27.5 | **FOUT** |
| P54 reserveringskosten | Reserveringskosten € 15 per boeking. Camper € 21 per nacht. | price_eur | 21 | 21 | goed |
| P55 kinderen gratis | Camperplaats € 15 per nacht, kinderen tot 4 jaar gratis. | price_eur | 15 | 15 | goed |
| P56 korting lang verblijf | Camperplaats per nacht: € 10. Vanaf de vierde nacht betaalt u € 8 per nacht. | price_eur | 10 | 10 | goed |
| P57 alleen tarieven vorig jaar | Tarieven 2025: camperplaats € 16 per nacht. | price_eur | 16 of leeg | 16 | goed |
| P58 stroom € 3 vóór camper | Stroom € 3 per nacht. Camperplaats € 14 per nacht. | price_eur | 14 | 14 | goed |
| P59 toeristenbelasting pppn alleen | Toeristenbelasting: € 1,75 per persoon per nacht. | price_eur | leeg | leeg | goed |
| P59 toeristenbelasting pppn alleen | Toeristenbelasting: € 1,75 per persoon per nacht. | extra:Toeristenbelasting | [1.75,"per persoon per nacht"] | leeg | **FOUT** |
| P60 honden € 2 en tent | Kleine tent € 9,50 per nacht, hond € 2,00 per nacht. | price_eur | leeg | leeg | goed |
| P61 gratis voor kinderen | Kinderen tot 3 jaar kunnen gratis overnachten. | price_eur | leeg | leeg | goed |
| P62 gratis parkeren ≠ overnachten | Gratis parkeren voor campers overdag; overnachten € 10 per nacht. | price_eur | 10 | 0 | **FOUT** |
| P63 2e camper | Camperplaats € 22 per nacht. Douche € 0,50 per 5 minuten. | price_eur | 22 | 22 | goed |
| P63 2e camper | Camperplaats € 22 per nacht. Douche € 0,50 per 5 minuten. | extra:Douche | [0.5,null] | [0.5,null] | goed |
| P64 3 cijfers week zonder woord | Camperplaats laagseizoen 7 nachten € 70. | price_eur | leeg | 70 | **FOUT** |
| P65 toeristenbelasting bedrag > | Camper € 19,50 per nacht + toeristenbelasting € 2,10 p.p.p.n. | price_eur | 19.5 | 19.5 | goed |
| P65 toeristenbelasting bedrag > | Camper € 19,50 per nacht + toeristenbelasting € 2,10 p.p.p.n. | tourist_tax_included | false | false | goed |
| P65 toeristenbelasting bedrag > | Camper € 19,50 per nacht + toeristenbelasting € 2,10 p.p.p.n. | extra:Toeristenbelasting | [2.1,"per persoon per nacht"] | [2.1,"per persoon per nacht"] | goed |
| P66 caravan zonder camper tarief | Caravan of camper met 2 personen: € 24,00 per nacht. Bijzettentje € 4,00 per nacht. | price_eur | 24 | 24 | goed |
| P67 12,5 komma enkel | Camperplaats € 12,5 per nacht. | price_eur | 12.5 | 12.5 | goed |
| P68 prijs boven 75 | Camperplaats met privé sanitair € 79 per nacht in het hoogseizoen. | price_eur | 79 of leeg | leeg | goed |
| P69 stacaravan huur per nacht | Onze stacaravan huurt u al voor € 55 per nacht. | price_eur | leeg | 55 | **FOUT** |
| P70 sauna | Sauna € 12,50 per persoon. Camperplaats € 17 per nacht. | price_eur | 17 | 17 | goed |
| P71 dagrecreatie entree | Entree dagrecreatie: € 6 per dag. | price_eur | leeg | 6 | **FOUT** |
| P72 visvergunning per dag | Visvergunning € 7,50 per dag. | price_eur | leeg | 7.5 | **FOUT** |
| P73 zwembad per dag | Toegang zwembad voor niet-kampeerders € 5,00 per dag. | price_eur | leeg | 5 | **FOUT** |
| P74 strandhuisje dag | Strandbed € 8 per dag. | price_eur | leeg | 8 | **FOUT** |
| S01 1 april t/m 31 oktober | De camping is geopend van 1 april t/m 31 oktober. | season | "1 april – 31 oktober" | "1 april – 31 oktober" | goed |
| S01 1 april t/m 31 oktober | De camping is geopend van 1 april t/m 31 oktober. | open_all_year | false | false | goed |
| S02 hele jaar geopend | Wij zijn het hele jaar geopend. | open_all_year | true | true | goed |
| S03 winter gesloten | In de winter zijn wij gesloten. | open_all_year | false of leeg | leeg | goed |
| S03 winter gesloten | In de winter zijn wij gesloten. | season | leeg | leeg | goed |
| S04 receptie zondag dicht | De receptie is gesloten op zondag. | open_all_year | leeg | leeg | goed |
| S04 receptie zondag dicht | De receptie is gesloten op zondag. | season | leeg | leeg | goed |
| S05 receptie april-oktober | Receptie geopend van april tot oktober. | open_all_year | leeg | leeg | goed |
| S05 receptie april-oktober | Receptie geopend van april tot oktober. | season | leeg | leeg | goed |
| S06 seizoen streepje | Seizoen: 15 maart - 1 november. | season | "15 maart – 1 november" | "15 maart – 1 november" | goed |
| S06 seizoen streepje | Seizoen: 15 maart - 1 november. | open_all_year | false | false | goed |
| S07 numeriek | Open van 01-04 t/m 31-10. | season | "1 april – 31 oktober" | "1 april – 31 oktober" | goed |
| S08 tot en met met jaar | Geopend: 1 april tot en met 30 september 2026. | season | "1 april – 30 september" | "1 april – 30 september" | goed |
| S09 restaurant heel jaar, camping seizoen | Het restaurant is het hele jaar geopend. De camping is open van 1 april tot 1 oktober. | season | "1 april – 1 oktober" | "1 april – 1 oktober" | goed |
| S09 restaurant heel jaar, camping seizoen | Het restaurant is het hele jaar geopend. De camping is open van 1 april tot 1 oktober. | open_all_year | false | false | goed |
| S10 gesloten van-tot | De camping is gesloten van 1 november tot 15 maart. | open_all_year | false of leeg | leeg | goed |
| S10 gesloten van-tot | De camping is gesloten van 1 november tot 15 maart. | season | leeg | leeg | goed |
| S11 openingstijden receptie | Openingstijden receptie: maandag t/m vrijdag 9.00 - 17.00 uur. | open_all_year | leeg | leeg | goed |
| S11 openingstijden receptie | Openingstijden receptie: maandag t/m vrijdag 9.00 - 17.00 uur. | season | leeg | leeg | goed |
| S12 maandag tot zaterdag | Geopend van maandag tot zaterdag. | open_all_year | leeg | leeg | goed |
| S12 maandag tot zaterdag | Geopend van maandag tot zaterdag. | season | leeg | leeg | goed |
| S13 zwembad | Het zwembad is open van 1 mei tot 1 september. | open_all_year | leeg | leeg | goed |
| S13 zwembad | Het zwembad is open van 1 mei tot 1 september. | season | leeg | leeg | goed |
| S14 maanden zonder dag | Geopend van april t/m oktober. | season | "april – oktober" | "april – oktober" | goed |
| S15 Duits jaarrond | Ganzjährig geöffnet. | open_all_year | true | true | goed |
| S16 Duits met punten | Geöffnet vom 1. April bis 31. Oktober. | season | "1 april – 31 oktober" | leeg | **FOUT** |
| S17 Engels | Open from April 1st to October 31st. | season | "1 april – 31 oktober" | leeg | **FOUT** |
| S18 niet het hele jaar | Wij zijn niet het hele jaar open; van november tot maart zijn wij dicht. | open_all_year | false of leeg | true | **FOUT** |
| S19 sanitair heel jaar | Het sanitairgebouw is het hele jaar geopend en verwarmd. | open_all_year | leeg | true | **FOUT** |
| S20 hele jaar terecht | U kunt het hele jaar door bij ons terecht met uw camper. | open_all_year | true | leeg | **FOUT** |
| S21 winkel in menu en camping | Camperplaats geopend van 15 maart tot en met 31 oktober. | season | "15 maart – 31 oktober" | "15 maart – 31 oktober" | goed |
| S22 jaarplaatsen heel jaar | De jaarplaatsen zijn het hele jaar open; toeristische plaatsen van 1 april tot 1 oktober. | open_all_year | false of leeg | true | **FOUT** |
| S23 afkortingen | Geopend: 1 apr. t/m 30 sept. | season | "1 april – 30 september" | "1 april – 30 september" | goed |
| S24 hele jaar m.u.v. | De camperplaats is het hele jaar open, behalve tijdens de kermis in augustus. | open_all_year | true of leeg | true | goed |
| S25 seizoenplaats periode | Seizoenplaats: van 1 april tot 1 oktober, € 1.450. | season | leeg of "1 april – 1 oktober" | "1 april – 1 oktober" | goed |
| S26 winkel | De campingwinkel is open van 1 juli tot 31 augustus. | season | leeg | "1 juli – 31 augustus" | **FOUT** |
| S26 winkel | De campingwinkel is open van 1 juli tot 31 augustus. | open_all_year | leeg | false | **FOUT** |
| S27 voorseizoen | Voorseizoen: 1 april tot 1 juli. Hoogseizoen: 1 juli tot 1 september. | season | leeg | "1 april – 1 juli" | **FOUT** |
| F01 geen stroom | Er is geen stroom op de camperplaats. | power | false | false | goed |
| F02 stroom op aanvraag | Stroom op aanvraag. | power | true | true | goed |
| F03 honden niet toegestaan | Honden zijn niet toegestaan. | dogs | false | false | goed |
| F04 honden welkom mits aangelijnd | Honden welkom, mits aangelijnd. | dogs | true | true | goed |
| F05 lozen grijs water niet mogelijk | Lozen van grijs water is niet mogelijk. | dump_station | false of leeg | true | **FOUT** |
| F06 ampère en waterkraan | Elke plaats heeft 10 ampère stroom en een eigen waterkraan. | power | true | true | goed |
| F06 ampère en waterkraan | Elke plaats heeft 10 ampère stroom en een eigen waterkraan. | water | true | true | goed |
| F07 geen wifi | Geen wifi op het terrein. | wifi | false | false | goed |
| F08 gratis wifi | Gratis wifi op de hele camping. | wifi | true | true | goed |
| F09 wifi niet beschikbaar | Wifi is helaas niet beschikbaar. | wifi | false of leeg | true | **FOUT** |
| F10 huisdieren helaas niet | Huisdieren zijn helaas niet welkom. | dogs | false | leeg | **FOUT** |
| F11 geen honden in sanitair | Honden zijn van harte welkom. Geen honden in het sanitairgebouw. | dogs | true | false | **FOUT** |
| F12 geen servicestation | Er is geen servicestation voor het lozen van afvalwater. | dump_station | false of leeg | true | **FOUT** |
| F13 zonder/met stroom tarief | Camperplaats zonder stroom € 12 per nacht, met stroom € 15 per nacht. | power | true | false | **FOUT** |
| F14 stroom niet aanwezig | Stroom is niet aanwezig. | power | false of leeg | true | **FOUT** |
| F15 water tappen | Water tappen kan bij het sanitairgebouw. | water | true | true | goed |
| F16 geen drinkwater | Geen drinkwater aanwezig. | water | false | false | goed |
| F17 Hunde willkommen | Hunde sind willkommen. | dogs | true | true | goed |
| F18 Hunde nicht erlaubt | Hunde sind nicht erlaubt. | dogs | false | leeg | **FOUT** |
| F19 kein Strom | Kein Strom am Platz. | power | false | false | goed |
| F20 huisdieren toegestaan: nee | Huisdieren toegestaan nee Stroom ja | dogs | false | true | **FOUT** |
| F20 huisdieren toegestaan: nee | Huisdieren toegestaan nee Stroom ja | power | true | true | goed |
| F21 niet toegestaan te lozen | Het is niet toegestaan afvalwater op het terrein te lozen. | dump_station | false of leeg | true | **FOUT** |
| F22 honden nee | Honden: nee | dogs | false | false | goed |
| F23 deels geen elektriciteit | Geen elektriciteit op de plaatsen aan het water; alle andere plaatsen hebben 6A stroom. | power | true of leeg | false | **FOUT** |
| F24 stroom tabel nee | Stroom nee Wifi nee Lozen nee Water nee | power | false of leeg | true | **FOUT** |
| F24 stroom tabel nee | Stroom nee Wifi nee Lozen nee Water nee | wifi | false of leeg | true | **FOUT** |
| F24 stroom tabel nee | Stroom nee Wifi nee Lozen nee Water nee | dump_station | false of leeg | true | **FOUT** |
| F24 stroom tabel nee | Stroom nee Wifi nee Lozen nee Water nee | water | false of leeg | leeg | goed |
| F25 honden hoogseizoen niet | Honden zijn in juli en augustus niet toegestaan. | dogs | leeg | leeg | goed |
| F26 stroomstoring / waterpret | Veel waterpret voor kinderen in ons zwembad. Bij stroomuitval is de slagboom handmatig te openen. | power | leeg | leeg | goed |
| F26 stroomstoring / waterpret | Veel waterpret voor kinderen in ons zwembad. Bij stroomuitval is de slagboom handmatig te openen. | water | leeg | leeg | goed |
| F27 dogs not allowed | Dogs are not allowed. | dogs | false | leeg | **FOUT** |
| F28 max 2 honden | Maximaal 2 honden per plaats. | dogs | true | true | goed |
| F29 chemisch toilet legen | U kunt uw chemisch toilet legen bij het servicepunt. | dump_station | true | true | goed |
| F29 chemisch toilet legen | U kunt uw chemisch toilet legen bij het servicepunt. | toilet | leeg | leeg | goed |
| F30 lozen grijs kan, cassette niet | Vuilwater lozen kan, het legen van de cassette is niet mogelijk. | dump_station | true of leeg | true | goed |
| F31 wifi tegen betaling | Wifi tegen betaling: € 2 per dag. | wifi | true | true | goed |
| F32 honden verboden op strand | Op het strand zijn honden niet toegestaan van 1 mei tot 1 oktober. Op de camping zijn honden welkom. | dogs | true | false | **FOUT** |
| F32 honden verboden op strand | Op het strand zijn honden niet toegestaan van 1 mei tot 1 oktober. Op de camping zijn honden welkom. | season | leeg | leeg | goed |
| F33 geen stroom in winter | In de winter is er geen stroom beschikbaar. | power | leeg of true | false | **FOUT** |
| F34 hondenvrij veld | Wij hebben een hondenvrij veld en een veld waar honden welkom zijn. | dogs | true | true | goed |
| F35 stroom incl | Alle camperplaatsen zijn voorzien van elektra (16A), water en afvoer. | power | true | true | goed |

## verify() na R18

| id | pagina | citaat | claim | gewenst | verify() | checkQuote().confirmed | uitkomst |
|---|---|---|---|---|---|---|---|
| Q01 chalets (R18) | Onze chalets: uitchecken voor 10 uur. | Onze chalets: uitchecken voor 10 uur. | vast 10:00 | afwijzen | afwijzen | false | goed |
| Q02 noodlijn 24 uur (R18) | Wij zijn bereikbaar 24 uur per dag via de noodlijn. | bereikbaar 24 uur per dag via de noodlijn | vrij  | afwijzen | afwijzen | false | goed |
| Q03 afgekapt citaat chalets | In onze chalets en lodges is het vertrek vóór 10.00 uur. | het vertrek vóór 10.00 uur | vast 10:00 | afwijzen | overnemen {"d":"vast","t":"10:00"} | true | **FOUT** |
| Q04 afgekapt citaat seizoensgasten | Voor seizoensgasten gelden geen vaste vertrektijden. | gelden geen vaste vertrektijden | vrij  | afwijzen | overnemen {"d":"vrij"} | true | **FOUT** |
| Q05 afgekapt citaat hoogseizoen | Vertrek voor 12.00 uur, in het hoogseizoen voor 10.30 uur. | Vertrek voor 12.00 uur | vast 12:00 | afwijzen | overnemen {"d":"vast","t":"12:00"} | true | **FOUT** |
| Q06 bus vertrekt | De bus naar het strand vertrekt om 10.15 uur. | De bus naar het strand vertrekt om 10.15 uur. | vast 10:15 | afwijzen | overnemen {"d":"vast","t":"10:15"} | true | **FOUT** |
| Q07 niet vóór 7 uur | Vertrekken vóór 7.00 uur is niet toegestaan in verband met de nachtrust. | Vertrekken vóór 7.00 uur is niet toegestaan in verband met de nachtrust. | vast 07:00 | afwijzen | overnemen {"d":"vast","t":"07:00"} | true | **FOUT** |
| Q08 Ferienhäuser | Ferienhäuser: Abreise bis 10 Uhr. | Ferienhäuser: Abreise bis 10 Uhr. | vast 10:00 | afwijzen | overnemen {"d":"vast","t":"10:00"} | true | **FOUT** |
| Q09 afgekapt: late check-out | Late check-out tot 14.00 uur kost € 10; uitchecken tot 14.00 uur is dan toegestaan. | uitchecken tot 14.00 uur | vast 14:00 | afwijzen | overnemen {"d":"vast","t":"14:00"} | true | **FOUT** |
| Q10 echte zin | Wij verzoeken u de camperplaats voor 11.00 uur te verlaten. | Wij verzoeken u de camperplaats voor 11.00 uur te verlaten. | vast 11:00 | overnemen | overnemen {"d":"vast","t":"11:00"} | true | goed |
| Q11 verkeerde tijd | Vertrek vóór 11.30 uur. | Vertrek vóór 11.30 uur. | vast 11:00 | afwijzen | afwijzen | null (geen inzending) | goed |
| Q12 per24 uit max 24 uur parkeren | Campers mogen hier maximaal 24 uur parkeren. | Campers mogen hier maximaal 24 uur parkeren. | per24  | afwijzen | afwijzen | false | goed |
| Q13 vrij: afgekapt 'vertrekken wanneer u wilt' (jaarplaats) | Op uw jaarplaats met camper kunt u komen en vertrekken wanneer u wilt. | met camper kunt u komen en vertrekken wanneer u wilt | vrij  | afwijzen | overnemen {"d":"vrij"} | true | **FOUT** |
| Q14 citaat over twee zinnen geplakt | Kampeerplaatsen: aankomst vanaf 13.00 uur. Chalets: vertrek vóór 10.00 uur. Honden welkom. | vertrek vóór 10.00 uur. Honden welkom | vast 10:00 | afwijzen | overnemen {"d":"vast","t":"10:00"} | true | **FOUT** |
| Q15 sanitair schoonmaak | Op de dag van vertrek wordt het sanitair om 11.00 uur schoongemaakt. | Op de dag van vertrek wordt het sanitair om 11.00 uur schoongemaakt. | vast 11:00 | afwijzen | overnemen {"d":"vast","t":"11:00"} | true | **FOUT** |

verify(): 5 van 15 goed.
