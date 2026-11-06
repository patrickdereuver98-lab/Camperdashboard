/**
 * Contentstudio (plan §3.3): onderwerpen, kanalen, de prompt voor Gemini en de controle achteraf. De controle is code,
 * geen model: elk getal moet uit de feitenbank komen, geen emoji, geen uitroeptekens, geen superlatieven, binnen de
 * lengte van het kanaal.
 */
import { allowedNumbers, factDate, factLines, type Facts } from "./facts";
import type { Channel, Pillar } from "./db-types";

export const PILLARS: Record<Pillar, { label: string; brief: string }> = {
  app: { label: "Wat de app doet", brief: "Leg uit wat VrijStaan is: camperplaatsen in heel Nederland met prijs, vertrektijd en voorzieningen, gratis, zonder account te gebruiken, op je beginscherm te zetten." },
  cijfers: { label: "Cijfers", brief: "Gebruik een of twee publieke cijfers uit de feitenbank om te laten zien hoeveel VrijStaan al weet." },
  hoe: { label: "Hoe werkt het", brief: "Leg één functie stap voor stap uit: zoeken op de kaart, Dichtbij (plekken in de buurt), Mijn reis (route en kosten), of de app op je beginscherm zetten." },
  regio: { label: "Seizoen en regio", brief: "Richt je op één provincie of regio en het seizoen. Gebruik het aantal plekken in die provincie als dat publiek mag." },
  "doe-mee": { label: "Doe mee", brief: "Vraag camperaars mee te helpen: een vertrektijd melden, een foto toevoegen of een review schrijven. Leg uit dat anderen daar direct iets aan hebben." },
  nieuw: { label: "Nieuw", brief: "Vertel over iets nieuws in de app of over de plekken die deze maand zijn gecontroleerd of toegevoegd." },
};

export const CHANNELS: Record<Channel, { label: string; max: number; hashtags: [number, number]; note: string }> = {
  instagram: { label: "Instagram", max: 2200, hashtags: [3, 5], note: "Eerste regel is de haak (wordt afgekapt na ±125 tekens). Daarna 3 tot 6 korte zinnen. Link in bio noemen, niet in de tekst." },
  tiktok: { label: "TikTok", max: 2200, hashtags: [3, 5], note: "Korte caption van hoogstens 150 tekens. Geef daarnaast de tekst die in beeld komt (overlay), hoogstens 8 woorden." },
  facebook: { label: "Facebook", max: 3000, hashtags: [0, 2], note: "Langere post (3 tot 6 zinnen) met de link aan het eind. Geschikt voor groepen van camperaars: informatief, niet verkoperig." },
  "google-ads": { label: "Google Ads", max: 90, hashtags: [0, 0], note: "Titel is de kop (hoogstens 30 tekens), body is de omschrijving (hoogstens 90 tekens). Geen hashtags." },
};

export type Variant = { title: string; body: string; hashtags: string[]; overlay?: string };

export const CONTENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    variants: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { title: { type: "STRING" }, body: { type: "STRING" }, hashtags: { type: "ARRAY", items: { type: "STRING" } }, overlay: { type: "STRING" } },
        required: ["title", "body", "hashtags"],
      },
    },
  },
  required: ["variants"],
};

export const SYSTEM =
  "Je schrijft social-mediateksten voor VrijStaan (vrijstaan.nl), een gratis website en app met camperplaatsen in " +
  "Nederland. Doel: camperaars leren de app kennen en gaan hem gebruiken. Het gaat over de app, niet over één " +
  "camperplaats. Toon: nuchter, feitelijk, betrouwbaar, zoals een camperaar het aan een andere camperaar vertelt. " +
  "Spreek de lezer aan met je en jij, nooit met u. Gewoon Nederlands, korte zinnen. Geen emoji, geen uitroeptekens, " +
  "geen superlatieven (beste, uniek, ultiem, perfect, geweldig), geen marketingjargon, geen Engelse woorden behalve " +
  "'app'. Gebruik alleen getallen uit de feitenbank, precies zoals ze daar staan; verzin nooit een getal, percentage " +
  "of review.";

/** De prompt voor één onderwerp en kanaal; `note` is een extra wens van de beheerder */
export function contentPrompt(pillar: Pillar, channel: Channel, facts: Facts, note = ""): string {
  const c = CHANNELS[channel];
  const lines = factLines(facts).filter((l) => l.public);
  const provinces = facts.provinces.filter((p) => p.places >= 50).map((p) => `${p.province}: ${p.places}`);
  return [
    `Schrijf 3 verschillende varianten voor ${c.label}.`,
    `Onderwerp: ${PILLARS[pillar].label}. ${PILLARS[pillar].brief}`,
    `Kanaal: ${c.note} Hashtags: ${c.hashtags[0]} tot ${c.hashtags[1]}, zonder #-teken, in kleine letters.`,
    note.trim() ? `Extra wens: ${note.trim().slice(0, 300)}` : "",
    "",
    `Feitenbank (stand ${factDate(facts.measured_at)}):`,
    ...lines.map((l) => `- ${l.text}`),
    provinces.length ? `- Plekken per provincie: ${provinces.join(", ")}` : "",
    "- Vaste functies: zoeken op kaart en lijst, filter op vertrektijd, Dichtbij, Mijn reis met kosten, melden van vertrektijden, foto's en reviews",
    "",
    "Retourneer strict JSON: { variants: [{ title, body, hashtags, overlay }] }. title = korte interne titel (of de kop bij Google Ads).",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function parseVariants(raw: string): Variant[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const list = (data as { variants?: unknown })?.variants;
  if (!Array.isArray(list)) return null;
  const out = list
    .filter((v): v is Variant => !!v && typeof v === "object" && typeof (v as Variant).title === "string" && typeof (v as Variant).body === "string")
    .map((v) => ({
      title: v.title.trim().slice(0, 120),
      body: v.body.trim().slice(0, 3000),
      hashtags: Array.isArray(v.hashtags) ? v.hashtags.filter((h) => typeof h === "string").map((h) => h.replace(/^#/, "").trim().toLowerCase()).filter(Boolean).slice(0, 8) : [],
      ...(typeof v.overlay === "string" && v.overlay.trim() ? { overlay: v.overlay.trim().slice(0, 80) } : {}),
    }))
    .filter((v) => v.title && v.body);
  return out.length ? out.slice(0, 3) : null;
}

export type Issue = { kind: "getal" | "emoji" | "uitroepteken" | "superlatief" | "lengte" | "hashtags" | "u-vorm"; detail: string };

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
const SUPERLATIVES = /\b(beste|allerbeste|uniek\w*|ultiem\w*|perfect\w*|geweldig\w*|fantastisch\w*|revolutionair\w*|ongelooflijk\w*|must-have|game.?changer)\b/i;
const U_FORM = /\b(u|uw)\b/i;

/** "2.186" → 2186, "18,50" → 18.5, "12:00" → 12 */
function numbersIn(text: string): { raw: string; value: number }[] {
  const out: { raw: string; value: number }[] = [];
  for (const m of text.matchAll(/(?<![\w.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?::(\d{2}))?(%?)/g)) {
    const whole = Number(m[1].replace(/\./g, ""));
    const value = m[2] ? Number(`${whole}.${m[2]}`) : whole;
    out.push({ raw: m[0], value: m[4] ? NaN : value });
  }
  return out;
}

/** Problemen in een tekst. Leeg = mag op "klaar". Jaartallen (2020 tot 2035) mogen altijd. */
export function checkContent(v: Variant, channel: Channel, facts: Facts | null): Issue[] {
  const issues: Issue[] = [];
  const text = `${v.title}\n${v.body}\n${v.overlay ?? ""}`;
  if (facts) {
    // Vaste getallen (12:00, 2 personen, 24 uur) alleen in hun eigen patroon: een losse "12" moet een feit zijn (DATA-15)
    const allowed = allowedNumbers(facts, text);
    for (const n of numbersIn(text)) {
      if (Number.isInteger(n.value) && n.value >= 2020 && n.value <= 2035) continue;
      if (Number.isNaN(n.value)) issues.push({ kind: "getal", detail: `Percentage "${n.raw}" staat niet in de feitenbank` });
      else if (!allowed.has(n.value)) issues.push({ kind: "getal", detail: `"${n.raw}" staat niet in de feitenbank` });
    }
  }
  if (EMOJI.test(text)) issues.push({ kind: "emoji", detail: "Bevat emoji" });
  if (text.includes("!")) issues.push({ kind: "uitroepteken", detail: "Bevat een uitroepteken" });
  const sup = SUPERLATIVES.exec(text);
  if (sup) issues.push({ kind: "superlatief", detail: `"${sup[0]}" is een superlatief` });
  if (U_FORM.test(text)) issues.push({ kind: "u-vorm", detail: "Spreek de lezer aan met je/jij, niet met u" });
  const c = CHANNELS[channel];
  if (channel === "google-ads") {
    if (v.title.length > 30) issues.push({ kind: "lengte", detail: `Kop is ${v.title.length} tekens, hoogstens 30` });
    if (v.body.length > 90) issues.push({ kind: "lengte", detail: `Omschrijving is ${v.body.length} tekens, hoogstens 90` });
  } else if (v.body.length > c.max) {
    issues.push({ kind: "lengte", detail: `${v.body.length} tekens, hoogstens ${c.max}` });
  }
  if (v.hashtags.length > c.hashtags[1]) issues.push({ kind: "hashtags", detail: `${v.hashtags.length} hashtags, hoogstens ${c.hashtags[1]}` });
  return issues;
}

/** Tekst om te kopiëren: body, link en hashtags zoals het kanaal ze verwacht */
export function postText(v: Pick<Variant, "body" | "hashtags">, channel: Channel, link?: string | null): string {
  const tags = v.hashtags.length ? `\n\n${v.hashtags.map((h) => `#${h}`).join(" ")}` : "";
  const withLink = channel === "facebook" && link ? `${v.body}\n\n${link}` : v.body;
  return channel === "google-ads" ? v.body : `${withLink}${tags}`;
}
