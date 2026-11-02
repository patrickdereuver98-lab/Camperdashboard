/**
 * Feiten voor SEO-titels, de deelafbeelding (/api/og) en AI-marketingteksten (Mission Control, tab Marketing).
 * Spelregels: nooit data verzinnen (onbekend laten we weg), "inclusief toeslagen" alleen als het totaal voor
 * 2 personen echt vaststaat (nightTotal), vertrektijd is het kernfeit.
 */
import { cardPrice, departureLong, eur } from "./format";
import { nightTotal, TOTAL_PERSONS } from "./trip-extras";
import { KIND_LABEL, type Place } from "./types";

export type MarketingPlace = Pick<
  Place,
  | "slug"
  | "name"
  | "town"
  | "province"
  | "kind"
  | "priceEur"
  | "priceFrom"
  | "priceExtras"
  | "touristTaxIncluded"
  | "departure"
  | "checkoutUntil"
  | "departureCheck"
> &
  Partial<
    Pick<Place, "description" | "power" | "water" | "dumpStation" | "toilet" | "shower" | "wifi" | "dogs" | "maxLengthM" | "capacity" | "surface" | "ratingAvg" | "ratingCount">
  >;

export type AllInPrice = {
  /** "€ 24,70", "vanaf € 18", "Gratis" */
  amount: string;
  /** Volledige zin-deel: "€ 24,70 per nacht voor 2 personen, inclusief toeslagen" */
  text: string;
  /** Alle toeslagen (toeristenbelasting, stroom) zitten erin */
  allIn: boolean;
};

/** De prijs met alle toeslagen als die vaststaat; anders de bekende prijs met de eerlijke vermelding; undefined = onbekend */
export function allInPrice(p: MarketingPlace): AllInPrice | undefined {
  if (p.priceEur === 0) return { amount: "Gratis", text: "gratis", allIn: true };
  const t = nightTotal(p);
  if (t.total !== undefined) {
    const amount = `${t.from ? "vanaf " : ""}${eur(t.total)}`;
    return { amount, text: `${amount} per nacht voor ${TOTAL_PERSONS} personen, inclusief toeslagen`, allIn: true };
  }
  const price = cardPrice(p);
  if (!price) return undefined;
  return { amount: price.value, text: `${price.value}${price.perNight ? " per nacht" : ""}, toeslagen niet volledig bekend`, allIn: false };
}

/** "uiterlijk 12:00", "geen vaste vertrektijd"; undefined als we het niet (leesbaar) weten */
export function departureFact(p: MarketingPlace): string | undefined {
  const long = departureLong(p);
  if (long === "Onbekend" || long === "Vaste vertrektijd") return undefined;
  // Na "Vertrektijd:" is "geen vaste vertrektijd" dubbel
  return long === "Geen vaste vertrektijd" ? "geen vaste tijd" : long[0].toLowerCase() + long.slice(1);
}

/** "Camperplaats De Proef", zonder dubbel woord als de naam al met de soort begint */
export function labeledName(p: Pick<Place, "name" | "kind">): string {
  const kind = p.kind ? KIND_LABEL[p.kind] : "Camperplaats";
  return p.name.toLowerCase().startsWith(kind.toLowerCase()) ? p.name : `${kind} ${p.name}`;
}

/** Paginatitel: "Camperplaats De Proef in Ede: € 24,70 incl. toeslagen" (de layout voegt de merknaam toe) */
export function seoTitle(p: MarketingPlace): string {
  const price = allInPrice(p);
  const base = `${labeledName(p)} in ${p.town}`;
  if (!price) return base;
  return `${base}: ${price.amount}${price.allIn && p.priceEur !== 0 ? " incl. toeslagen" : ""}`;
}

/**
 * Omschrijving voor zoekresultaten: "Camperplaats De Proef in Ede: € 24,70 per nacht voor 2 personen, inclusief
 * toeslagen. Vertrektijd: uiterlijk 12:00." Wat onbekend is, laten we weg.
 */
export function seoDescription(p: MarketingPlace): string {
  const price = allInPrice(p);
  const dep = departureFact(p);
  const parts = [`${labeledName(p)} in ${p.town} (${p.province})${price ? `: ${price.text}` : ""}.`];
  if (dep) parts.push(`Vertrektijd: ${dep}.`);
  parts.push("Bekijk voorzieningen, foto's, reviews en de route.");
  return parts.join(" ");
}

/** Pad van de deelafbeelding voor een plek */
export function ogImagePath(slug: string): string {
  return `/api/og?slug=${encodeURIComponent(slug)}`;
}

const FACILITIES: [keyof MarketingPlace, string][] = [
  ["power", "stroom"],
  ["water", "water innemen"],
  ["dumpStation", "lozen"],
  ["toilet", "toilet"],
  ["shower", "douche"],
  ["wifi", "wifi"],
  ["dogs", "honden welkom"],
];

/** Alleen bekende feiten, als regels voor het taalmodel. Geen persoonsgegevens (telefoon, e-mail) */
export function marketingFacts(p: MarketingPlace, url: string): string[] {
  const price = allInPrice(p);
  const dep = departureFact(p);
  const yes = FACILITIES.filter(([k]) => p[k] === true).map(([, l]) => l);
  const no = FACILITIES.filter(([k]) => p[k] === false).map(([, l]) => l);
  return [
    `Naam: ${p.name}`,
    `Soort: ${p.kind ? KIND_LABEL[p.kind] : "Camperplaats"}`,
    `Plaats: ${p.town} (${p.province})`,
    `Prijs: ${price ? price.text : "onbekend"}`,
    `Vertrektijd: ${dep ?? "onbekend"}`,
    yes.length ? `Wel: ${yes.join(", ")}` : "",
    no.length ? `Niet: ${no.join(", ")}` : "",
    p.maxLengthM ? `Maximale lengte camper: ${String(p.maxLengthM).replace(".", ",")} m` : "",
    p.capacity ? `Aantal plekken: ${p.capacity}` : "",
    p.surface ? `Ondergrond: ${p.surface}` : "",
    p.ratingAvg && p.ratingCount ? `Gemiddelde score: ${p.ratingAvg.toFixed(1).replace(".", ",")} uit ${p.ratingCount} reviews` : "",
    p.description ? `Eigen beschrijving van de plek: ${p.description.slice(0, 600)}` : "",
    `Link: ${url}`,
  ].filter(Boolean);
}

export const MARKETING_PROMPT =
  "Schrijf 2 Facebook-posts en 2 Google Ads teksten voor camperplaats {naam}. Doelgroep: Nederlandse camperaars van " +
  "55+. Tone of voice: Nuchter, feitelijk, betrouwbaar. Benadruk de exacte prijs, vertrektijd en sfeer. Geen emojis, " +
  "geen hippe marketing-jargon, gebruik uitsluitend feiten. Gebruik alleen de feiten hieronder; wat 'onbekend' is " +
  "noem je niet en vul je niet zelf in. Spreek de lezer aan met je en jij, nooit met u. Schrijf gewoon Nederlands " +
  "met korte zinnen, zonder uitroeptekens en zonder superlatieven als 'de beste' of 'uniek'. Google Ads: kop " +
  "hoogstens 30 tekens, omschrijving hoogstens 90 tekens. Retourneer strict JSON: " +
  "{ facebook: [tekst, tekst], googleAds: [{ headline, description }, { headline, description }] }.";

export function marketingText(p: MarketingPlace, url: string): string {
  return [MARKETING_PROMPT.replace("{naam}", p.name), "", "Feiten:", ...marketingFacts(p, url).map((f) => `- ${f}`)].join("\n");
}

export type MarketingCopy = { facebook: string[]; googleAds: { headline: string; description: string }[] };

// Emoji en pictogrammen weghalen: de doelgroep wil ze niet en de prompt verbiedt ze, maar een model houdt zich daar
// niet altijd aan
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const clean = (s: string, max: number) => s.replace(EMOJI, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim().slice(0, max);

/** Antwoord van het model controleren: precies 2 posts en 2 advertenties, zonder emoji, binnen de lengtes */
export function parseMarketing(raw: string): MarketingCopy | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { facebook, googleAds } = data as { facebook?: unknown; googleAds?: unknown };
  if (!Array.isArray(facebook) || !Array.isArray(googleAds)) return null;
  const posts = facebook.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => clean(x, 1200));
  const ads = googleAds
    .filter((x): x is { headline: string; description: string } => !!x && typeof x === "object" && typeof x.headline === "string" && typeof x.description === "string")
    .map((x) => ({ headline: clean(x.headline, 30), description: clean(x.description, 90) }))
    .filter((x) => x.headline && x.description);
  if (posts.length < 2 || ads.length < 2) return null;
  return { facebook: posts.slice(0, 2), googleAds: ads.slice(0, 2) };
}

/** JSON-schema voor geminiJson (lib/gemini.ts): 2 posts en 2 advertenties */
export const MARKETING_SCHEMA = {
  type: "OBJECT",
  properties: {
    facebook: { type: "ARRAY", items: { type: "STRING" } },
    googleAds: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { headline: { type: "STRING" }, description: { type: "STRING" } }, required: ["headline", "description"] },
    },
  },
  required: ["facebook", "googleAds"],
};
