import { FACILITIES, normalize, type FacilityKey, type Filters } from "./search";
import { KIND_LABEL, type PlaceKind } from "./types";

/**
 * Filters in gewone taal (UX-audit november, Z2): "gratis texel met stroom" of "zonder vertrektijd zeeland". Haalt
 * bekende woorden uit de zoekvraag en geeft de rest terug als plaats. Niets begrepen: `patch` is leeg en `rest` is de
 * hele vraag, dan werkt het zoekvak zoals altijd. Alleen woorden uit deze lijsten; we raden nooit.
 */

export type ParsedQuery = {
  /** Wat overblijft als plaats, streek of plek ("texel") */
  rest: string;
  /** Filters die we herkenden */
  patch: Partial<Filters>;
  /** Korte namen voor in de suggestie, in leesvolgorde ("gratis", "stroom") */
  labels: string[];
};

// Langste eerst, zodat "geen vaste vertrektijd" wint van "vertrektijd"
const DEPARTURE: [string, "vrij" | "uitslapers"][] = [
  ["zonder vaste vertrektijd", "vrij"],
  ["geen vaste vertrektijd", "vrij"],
  ["zonder vertrektijd", "vrij"],
  ["geen vertrektijd", "vrij"],
  ["vrij vertrekken", "vrij"],
  ["per 24 uur", "vrij"],
  ["laat vertrekken", "uitslapers"],
  ["uitslapers", "uitslapers"],
  ["uitslapen", "uitslapers"],
];

const FACILITY_WORDS: [string, FacilityKey][] = [
  ["stroom", "power"],
  ["elektriciteit", "power"],
  ["water", "water"],
  ["drinkwater", "water"],
  ["lozen", "dumpStation"],
  ["loosplaats", "dumpStation"],
  ["afvalwater", "dumpStation"],
  ["toilet", "toilet"],
  ["wc", "toilet"],
  ["douche", "shower"],
  ["douches", "shower"],
  ["wifi", "wifi"],
  ["internet", "wifi"],
  ["honden", "dogs"],
  ["hond", "dogs"],
];

const KIND_WORDS: [string, PlaceKind][] = [
  ["camperplaats", "camperplaats"],
  ["camperplaatsen", "camperplaats"],
  ["camping", "camping"],
  ["campings", "camping"],
  ["camperparkeerplaats", "parkeerplaats"],
  ["parkeerplaats", "parkeerplaats"],
  ["boerderij", "boerderij"],
  ["bij de boer", "boerderij"],
  ["boer", "boerderij"],
  ["jachthaven", "jachthaven"],
];

/** Stapjes uit de filtersheet: "onder 12 euro" wordt de dichtstbijzijnde stap eronder (10) */
const PRICE_STEPS = [10, 15, 20, 25];

// Vulwoorden die na het weghalen van filters overblijven: "met", "en", "in", "bij", "die", "waar"
const FILLER = new Set(["met", "en", "in", "bij", "de", "het", "een", "die", "waar", "voor", "op", "omgeving", "buurt", "plek", "plekken", "camper", "campers", "welkom", "toegestaan"]);

const has = (text: string, phrase: string) => new RegExp(`(^| )${phrase}( |$)`).test(text);
const cut = (text: string, phrase: string) => text.replace(new RegExp(`(^| )${phrase}( |$)`), " ").replace(/\s+/g, " ").trim();

export function parseQuery(input: string): ParsedQuery {
  // Bedragen eerst uit de ruwe tekst, want normalize haalt € en komma's niet weg maar wel punten
  let text = ` ${normalize(input.replace(/€\s*/g, " euro ").replace(/(\d),(\d)/g, "$1.$2"))} `.replace(/\s+/g, " ").trim();
  const patch: Partial<Filters> = {};
  const labels: string[] = [];

  for (const [phrase, page] of DEPARTURE)
    if (has(text, phrase)) {
      patch.departure = page;
      labels.push(page === "vrij" ? "zonder vertrektijd" : "uitslapers");
      text = cut(text, phrase);
      break;
    }

  // Prijs: "gratis", "kosteloos", "onder/tot/max(imaal) 15 (euro)"
  if (has(text, "gratis") || has(text, "kosteloos")) {
    patch.free = true;
    labels.push("gratis");
    text = cut(cut(text, "gratis"), "kosteloos");
  } else {
    const m = /(?:^| )(?:onder|tot|max|maximaal|hooguit|minder dan)(?: euro)? (\d{1,3})(?: euro)?(?: per nacht)?(?= |$)/.exec(text);
    if (m) {
      const amount = Number(m[1]);
      const step = [...PRICE_STEPS].reverse().find((s) => s <= amount);
      if (step) {
        patch.maxPrice = step;
        labels.push(`tot € ${step}`);
      } else {
        patch.free = true;
        labels.push("gratis");
      }
      text = text.replace(m[0], " ").replace(/\s+/g, " ").trim();
    }
  }

  const facilities: FacilityKey[] = [];
  for (const [word, key] of FACILITY_WORDS)
    if (has(text, word)) {
      if (!facilities.includes(key)) facilities.push(key);
      text = cut(text, word);
    }
  if (facilities.length) {
    patch.facilities = FACILITIES.filter((f) => facilities.includes(f.key)).map((f) => f.key);
    for (const f of FACILITIES) if (facilities.includes(f.key)) labels.push(f.key === "dogs" ? "honden welkom" : f.label.toLowerCase());
  }

  const kinds: PlaceKind[] = [];
  for (const [word, kind] of KIND_WORDS)
    if (has(text, word)) {
      if (!kinds.includes(kind)) kinds.push(kind);
      text = cut(text, word);
    }
  // "camperplaats" alleen is geen filter: zo heet bijna alles. Alleen als er nog een andere soort bij staat.
  const realKinds = kinds.length === 1 && kinds[0] === "camperplaats" ? [] : kinds;
  if (realKinds.length) {
    patch.kinds = realKinds;
    for (const k of realKinds) labels.push(KIND_LABEL[k].toLowerCase());
  }

  if (has(text, "nu open") || has(text, "open")) {
    patch.openNow = true;
    labels.push("nu open");
    text = cut(cut(text, "nu open"), "open");
  }

  // Niets herkend: de vraag blijft precies zoals hij was (ook "Den Bosch" en "Sint-Maartensdijk")
  if (!labels.length) return { rest: input.trim(), patch: {}, labels: [] };
  const rest = text
    .split(" ")
    .filter((w) => w && !FILLER.has(w))
    .join(" ");
  return { rest, patch, labels };
}

/** Leesbare samenvatting voor een suggestie: "Texel, gratis, stroom" */
export function describeParsed(where: string | undefined, labels: string[]): string {
  const parts = [...(where ? [where] : []), ...labels];
  return parts.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p)).join(", ");
}

/** Korte naam van een zoekopdracht voor "Eerder gezocht": "Texel, zonder vertrektijd, gratis, stroom" */
export function filtersLabel(f: Filters): string {
  const parts: string[] = [];
  if (f.departure === "vrij") parts.push("zonder vertrektijd");
  else if (f.departure === "uitslapers") parts.push("uitslapers");
  if (f.free) parts.push("gratis");
  else if (f.maxPrice) parts.push(`tot € ${f.maxPrice}`);
  for (const fac of FACILITIES) if (f.facilities.includes(fac.key)) parts.push(fac.key === "dogs" ? "honden welkom" : fac.label.toLowerCase());
  for (const k of f.kinds) parts.push(KIND_LABEL[k].toLowerCase());
  if (f.openNow) parts.push("nu open");
  return describeParsed(f.where ?? f.province ?? "Heel Nederland", parts);
}
