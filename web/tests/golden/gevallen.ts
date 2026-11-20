// Gouden set (dataplan november 2026, spoor 1.1; review R69): echte pagina's van camperplaatsen en campings met wat
// er volgens die pagina letterlijk klopt. Opgehaald op 20 november 2026 met pg_net (zelfde User-Agent als de lezer),
// alleen de tekst rond tarieven en tijden bewaard (paginas/<naam>.txt). De verwachting gaat over wat op déze pagina
// staat, niet over wat elders op de site staat.
//
// Velden:
// - vertrek: "vast" | "vrij" | "per24" of null (de pagina zegt niets bruikbaars: leeg laten)
// - tijd: vertrektijd bij "vast"
// - prijs: nachtprijs (laagste camper- of kampeerplaatsprijs) of null
// - extrasWel / extrasNiet: toeslagen die er wel of juist niet (met dat etiket) mogen staan
// - lengte / nachten: maximale camperlengte en maximaal aantal nachten
// - todo: bekend verschil dat nog open staat (de test meldt het, maar faalt er niet op)

export type Extra = { label: string; amount: number };
export type Geval = {
  naam: string;
  url: string;
  vertrek?: "vast" | "vrij" | "per24" | null;
  tijd?: string;
  vertrekNiet?: "vast" | "vrij" | "per24";
  aankomst?: string;
  prijs?: number | null;
  extrasWel?: Extra[];
  extrasNiet?: Extra[];
  lengte?: number;
  nachten?: number;
  todo?: string;
};

export const GEVALLEN: Geval[] = [
  {
    naam: "gideonse",
    url: "https://minicamping-gideonse.nl/tarieven/extra-opties/",
    vertrek: "vast",
    tijd: "11:00",
    aankomst: "13:30",
    prijs: null,
    // € 8,18 is een logé, € 3,50 is bezoek: geen kind en geen verplichte prijs per persoon
    extrasNiet: [{ label: "Kind", amount: 8.18 }, { label: "Per persoon", amount: 3.5 }],
  },
  {
    naam: "mastendol",
    url: "https://www.mastendol.nl/verblijven/tarieven-2025",
    vertrek: "vast",
    tijd: "12:00",
    prijs: 27,
    extrasWel: [{ label: "Toeristenbelasting", amount: 1.75 }, { label: "Extra persoon", amount: 4.5 }],
  },
  {
    naam: "bloemenveld",
    url: "https://www.camperplaats-bloemenveld.nl/",
    vertrek: "per24",
    prijs: 16.5,
    extrasWel: [{ label: "Extra persoon", amount: 2.5 }],
  },
  {
    naam: "kluijthoek-chalets",
    url: "https://www.kluithoek.nl/tarieven-chalets/",
    // De tijden en prijzen op deze pagina gaan over de chalets
    vertrek: null,
    prijs: null,
  },
  {
    naam: "welgelegen",
    url: "https://www.campinghoevewelgelegen.nl/tarieven-svr-camping-hoeve-welgelegen-in-hijken-midden-drenthe/",
    vertrek: "vast",
    tijd: "11:00",
    aankomst: "13:00",
    prijs: 20,
    extrasWel: [{ label: "Toeristenbelasting", amount: 1.45 }, { label: "Extra persoon", amount: 3.5 }],
    extrasNiet: [{ label: "Per persoon", amount: 1.45 }],
  },
  {
    naam: "deboerderij",
    url: "https://natuurcampingdeboerderij.nl/camping.html",
    vertrek: "vast",
    tijd: "11:00",
    aankomst: "13:00",
    // € 18 is de tent voor 2 personen; de camper kost € 20
    prijs: 20,
    extrasNiet: [{ label: "Per persoon", amount: 18 }],
  },
  {
    naam: "wondert-bb",
    url: "https://www.waarhetwondert.nl/bedbreakfast/",
    // Vakantiehuisje en B&B, geen camperplaats
    vertrek: null,
    prijs: null,
  },
  {
    naam: "wondert-campers",
    url: "https://www.waarhetwondert.nl/campers/",
    vertrek: null,
    prijs: 25,
  },
  {
    naam: "sproakstee",
    url: "https://www.campingsproakstee.nl/tarieven/",
    vertrek: null,
    // € 20 is de trekkerstent, € 69 de pipowagen
    prijs: 22.5,
    extrasNiet: [{ label: "Per persoon", amount: 1.5 }],
  },
  {
    naam: "loenensebrug",
    url: "https://www.deloenensebrug.nl/tarieven",
    vertrek: "vast",
    tijd: "11:00",
    aankomst: "14:00",
    prijs: 23,
    extrasWel: [{ label: "Extra persoon", amount: 5.5 }],
    extrasNiet: [{ label: "Per persoon", amount: 5.5 }],
  },
  {
    naam: "odahoeve",
    url: "https://www.odahoeve.nl/tarieven/",
    // "Vertrek na 12 uur (indien mogelijk) € 13": tot 12:00 is vertrekken gratis
    vertrek: "vast",
    tijd: "12:00",
    prijs: 22,
    extrasWel: [{ label: "Toeristenbelasting", amount: 1.3 }, { label: "Extra persoon", amount: 6 }],
  },
  {
    naam: "pekelder",
    url: "https://www.pekeldercampertuin.nl/huisregels/",
    // "voor de middag" is geen klokkijd: niets invullen
    vertrek: null,
  },
  {
    naam: "campsurf",
    url: "https://www.campensurfmarkermeer.nl/camperplaatsen",
    vertrek: "vast",
    tijd: "11:00",
    aankomst: "13:30",
    prijs: 20,
    extrasWel: [{ label: "Toeristenbelasting", amount: 1.25 }, { label: "Extra persoon", amount: 5 }],
  },
  {
    naam: "reterink",
    url: "https://hetreterink.nl/camping/",
    vertrek: "vast",
    tijd: "12:00",
    prijs: 29.5,
    extrasWel: [{ label: "Extra persoon", amount: 7.5 }],
  },
  {
    naam: "maastricht-marina",
    url: "https://www.maastrichtmarina.nl/",
    // 10:30 is voor de houseboats
    vertrek: "vast",
    tijd: "13:00",
    prijs: 30,
  },
  {
    naam: "vlisterhoeve",
    url: "https://www.vlisterhoeve.nl/de-camperplaats",
    vertrek: "vrij",
    prijs: null,
  },
  {
    naam: "urk",
    url: "https://www.camperpark-urk.nl/vragen",
    vertrek: "per24",
    prijs: null,
  },
  {
    naam: "zandman",
    url: "https://www.zandmanbeerze.nl/camping/camperplaats/",
    vertrek: "vrij",
    prijs: 22.5,
  },
  {
    naam: "maassluis",
    url: "https://www.ervaarmaassluis.nl/nl/locaties-overzicht/633115137/camperplaats",
    // Betalen van 12 uur tot 12 uur, hoogstens 2x24 uur: in elk geval geen "vrij"
    vertrekNiet: "vrij",
    prijs: 10.7,
    lengte: 8,
    nachten: 2,
  },
  {
    naam: "devleu",
    url: "https://devleu.nl/",
    vertrek: "vrij",
    prijs: 18,
    extrasWel: [{ label: "Extra persoon", amount: 5 }],
    extrasNiet: [{ label: "Per persoon", amount: 2.5 }],
  },
  {
    naam: "westerwijtwerd",
    url: "https://www.camperplaatswesterwijtwerd.nl/tarieven",
    vertrek: null,
    prijs: 19,
    extrasWel: [{ label: "Stroom", amount: 3 }, { label: "Extra persoon", amount: 3 }],
  },
  {
    naam: "remmelink",
    url: "https://www.boerencampingremmelink.nl/prijslijst/",
    vertrek: null,
    prijs: 21,
    extrasWel: [{ label: "Toeristenbelasting", amount: 1.75 }, { label: "Extra persoon", amount: 6 }],
  },
  {
    naam: "heiderust",
    url: "https://heiderust.nl/tarieven/",
    // De pagina is sinds de review veranderd: de zin met 12:00 staat er niet meer. Wat er nu staat is "vrij"
    vertrek: "vrij",
    prijs: null,
  },
];
