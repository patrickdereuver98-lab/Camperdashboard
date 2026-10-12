// Websites zoeken voor plekken zonder website in OpenStreetMap.
//
// Veel Nederlandse campings en camperplaatsen gebruiken hun naam als domein ("Camping De Kraai" → campingdekraai.nl).
// We proberen een paar van zulke adressen en accepteren er alleen één als de pagina zelf de kenmerkende woorden uit de
// naam én de plaats, de postcode of het telefoonnummer noemt. Geen zoekmachine, geen gok: anders blijft het veld leeg.

export type Candidate = { id: string; name: string; town?: string; postcode?: string; phone?: string };

/** Woorden die in veel namen voorkomen en dus niets zeggen over welke plek het is */
const GENERIC = new Set([
  "camping", "minicamping", "mini", "kleine", "boerencamping", "natuurcamping", "vakantiepark", "recreatiepark", "park",
  "camperplaats", "camperplaatsen", "camperpark", "camperplek", "camperstandplaats", "campers", "camper", "stellplatz",
  "jachthaven", "passantenhaven", "haven", "marina", "boerderij", "hoeve", "erf", "landgoed", "parkeerplaats", "p",
  "de", "het", "den", "der", "t", "aan", "op", "in", "bij", "en", "van", "the", "and", "vof", "bv",
]);

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " en ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Kenmerkende woorden uit de naam (zonder "camping", "de" enz.) */
export function keyWords(name: string): string[] {
  return fold(name)
    .split(" ")
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
}

/** Mogelijke domeinen, de waarschijnlijkste eerst. Nooit alleen de plaatsnaam (dat is meestal de gemeente). */
export function domains(name: string, town?: string): string[] {
  const words = fold(name).split(" ").filter(Boolean);
  const key = keyWords(name);
  if (!key.length) return [];
  const all = words.join("");
  const noArticle = words.filter((w) => !["de", "het", "t", "den"].includes(w)).join("");
  const keyOnly = key.join("");
  const dashed = words.join("-");
  const townKey = town ? fold(town).replace(/\s/g, "") : "";
  const out = [all, noArticle, dashed, keyOnly, `camping${keyOnly}`, `camperplaats${keyOnly}`]
    .filter((d) => d.length >= 5 && d.length <= 50 && d !== townKey)
    .flatMap((d) => [`${d}.nl`]);
  if (keyOnly.length >= 6) out.push(`${all}.com`);
  return [...new Set(out)].slice(0, 7);
}

/** Klopt deze pagina bij de plek? Kenmerkende naamwoorden plus plaats, postcode of telefoon. */
export function matches(c: Candidate, html: string): boolean {
  const text = ` ${fold(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )} `;
  // Domein te koop of geparkeerd
  if (/domein (is )?te koop|domain (is )?for sale|this domain|parked|deze domeinnaam/.test(text)) return false;
  // De naam zelf moet op de pagina staan, met of zonder lidwoord ("camping de kraai" of "camping kraai")
  const name = fold(c.name);
  const bare = name.replace(/\b(de|het|t|den)\b /g, "");
  if (!keyWords(c.name).length || !(text.includes(` ${name} `) || text.includes(` ${bare} `))) return false;
  const town = c.town ? fold(c.town) : "";
  const pc = c.postcode?.replace(/\s/g, "").slice(0, 4);
  const phone = c.phone?.replace(/\D/g, "").slice(-8);
  const digits = text.replace(/\s/g, "");
  return (
    (town.length >= 3 && text.includes(` ${town} `)) ||
    (!!pc && new RegExp(`\\b${pc}\\s?[a-z]{2}\\b`).test(text)) ||
    (!!phone && phone.length === 8 && digits.includes(phone))
  );
}
