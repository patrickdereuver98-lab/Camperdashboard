// Kleine teksten voor Mijn reis, los van React zodat ze te testen zijn.
import { eur } from "@/lib/format";
import type { Extra } from "@/lib/trip-extras";

const TIME = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long" });
const DAY_YEAR = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" });

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * "vandaag om 14:05", "gisteren om 09:30", "4 november om 14:05" of "28 december 2025 om 14:05": wanneer de gegevens
 * van de server kwamen. Leeg als de datum onbekend is (oude opslag); dan zeggen we niets.
 */
export function dataDateText(iso: string | null | undefined, now: Date = new Date()): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  const day = sameDay(d, now)
    ? "vandaag"
    : sameDay(d, yesterday)
      ? "gisteren"
      : d.getFullYear() === now.getFullYear()
        ? DAY.format(d)
        : DAY_YEAR.format(d);
  return `${day} om ${TIME.format(d)}`;
}

/** Labels waarvan het bedrag bij de plek of de persoon zelf hoort, niet bij een keuze (hond, stroom, kind) */
const NOT_OPTIONAL = new Set(["Per persoon", "Toeristenbelasting"]);

/**
 * Is een toeslag die niet is meegeteld een keuze ("hangt af van je situatie": hond, kind, stroom, douche), of weten we
 * niet waar het bedrag voor geldt? Geeft de kostenberekening zelf een veld `optional` mee, dan gaat dat voor.
 */
export function isOptionalExtra(x: Extra): boolean {
  const flag = (x as Extra & { optional?: unknown }).optional;
  if (typeof flag === "boolean") return flag;
  return !!x.unit && !NOT_OPTIONAL.has(x.label);
}

/** De uitleg onder "+ toeslagen, niet meegeteld": alleen "hangt af van je situatie" als er echt een keuze bij zit */
export function surchargeNote(extras: Extra[]): string {
  const optional = extras.some(isOptionalExtra);
  const unclear = extras.some((x) => !isOptionalExtra(x));
  if (optional && unclear) return "Of je sommige betaalt hangt af van je situatie. Bij de andere zegt de plek niet waar het bedrag voor geldt.";
  if (optional) return "Of je deze betaalt hangt af van je situatie.";
  return "De plek zegt niet waar het bedrag voor geldt.";
}

/**
 * Hoe we een bedrag rekenden waarvan de plek de eenheid niet (helemaal) noemt: "toeristenbelasting € 1,20, gerekend
 * per persoon per nacht (de plek noemt geen eenheid)". Zo staat de aanname er altijd bij.
 */
export function assumedText(x: Extra): string {
  const what = x.label === "Toeristenbelasting" ? "toeristenbelasting" : x.label === "Per persoon" ? "toeslag per persoon" : x.label.toLowerCase();
  const said = x.unit ? `de plek zegt alleen "${x.unit}"` : "de plek noemt geen eenheid";
  return `${what} ${eur(x.amount)}, gerekend per persoon per nacht (${said})`;
}

/** "1 plek noemt een vanaf-prijs. Daar betaal je mogelijk meer." Leeg zonder vanaf-prijzen. */
export function fromPriceNote(stops: number | undefined): string | undefined {
  if (!stops) return undefined;
  return stops === 1
    ? "1 plek noemt alleen een vanaf-prijs. Daar betaal je mogelijk meer."
    : `${stops} plekken noemen alleen een vanaf-prijs. Daar betaal je mogelijk meer.`;
}
