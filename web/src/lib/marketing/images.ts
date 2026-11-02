/**
 * Beeldsjablonen (plan §3.4): vaste teksten plus feiten uit de openbare plekgegevens. Geen vrije tekst uit de URL,
 * zodat niemand met deze openbare route beelden in onze huisstijl met eigen tekst kan maken.
 */
import { factDate, nl, PUBLIC_MIN, type Facts } from "./facts";

export const FORMATS = {
  square: { w: 1080, h: 1080, label: "Vierkant 1:1 (tijdlijn)" },
  portrait: { w: 1080, h: 1350, label: "Staand 4:5 (Instagram)" },
  story: { w: 1080, h: 1920, label: "Story 9:16 (Stories, Reels-omslag)" },
} as const;
export type ImageFormat = keyof typeof FORMATS;

export const TEMPLATES = {
  cijfers: "Cijfers",
  vertrektijd: "Vertrektijd vooraf",
  provincie: "Provincie",
  app: "Op je beginscherm",
  "doe-mee": "Doe mee",
  carrousel: "Carrousel (5 dia's)",
} as const;
export type ImageTemplate = keyof typeof TEMPLATES;

export type Slide = { kicker?: string; big?: string; title: string; lines: string[]; footer: string };

const pub = (n: number) => n >= PUBLIC_MIN;

/** De inhoud van één beeld; null als het sjabloon met deze feiten niets eerlijks te zeggen heeft */
export function slideFor(template: ImageTemplate, facts: Facts, opts: { province?: string; slide?: number } = {}): Slide | null {
  const stand = `Stand ${factDate(facts.measured_at)} · vrijstaan.nl`;
  const d = facts.departure;
  switch (template) {
    case "cijfers":
      return {
        kicker: "Camperplaatsen in Nederland",
        big: nl(facts.places),
        title: "plekken met prijs, vertrektijd en voorzieningen",
        lines: [
          pub(d.known) ? `${nl(d.known)} met bekende vertrektijd` : "",
          pub(d.uitslapers) ? `${nl(d.uitslapers)} waar je tot 12:00 of later mag blijven` : "",
          pub(facts.facilities.power) ? `${nl(facts.facilities.power)} met stroom` : "",
        ].filter(Boolean),
        footer: stand,
      };
    case "vertrektijd":
      return {
        kicker: "Geen verrassingen bij het vertrek",
        title: "Zie hoe laat je weg moet, voordat je rijdt",
        lines: [pub(d.known) ? `Bij ${nl(d.known)} camperplaatsen staat de vertrektijd erbij` : "Bij elke plek staat de vertrektijd, als we hem weten", "Filter op uitslapers: vertrek 12:00 of later"],
        footer: stand,
      };
    case "provincie": {
      const p = facts.provinces.find((x) => x.province === opts.province);
      if (!p || !pub(p.places)) return null;
      return { kicker: "Camperplaatsen in", big: p.province, title: `${nl(p.places)} plekken met prijs en vertrektijd`, lines: ["Zoek op de kaart, filter op vertrektijd en voorzieningen"], footer: stand };
    }
    case "app":
      return {
        kicker: "Gratis, zonder account",
        title: "Zet VrijStaan op je beginscherm",
        lines: ["1. Open vrijstaan.nl op je telefoon", "2. Tik op Delen of het menu", "3. Kies Zet op beginscherm"],
        footer: "vrijstaan.nl",
      };
    case "doe-mee":
      return {
        kicker: "Doe mee",
        title: "Weet jij hoe laat je weg moet?",
        lines: ["Meld de vertrektijd van jouw camperplaats", "Dan weet de volgende camperaar het ook"],
        footer: "vrijstaan.nl/doe-mee",
      };
    case "carrousel": {
      const slides: Slide[] = [
        { kicker: "Voor camperaars", title: "Hoe laat moet je weg? Dat zie je hier vooraf", lines: ["Swipe"], footer: "vrijstaan.nl" },
        slideFor("cijfers", facts)!,
        slideFor("vertrektijd", facts)!,
        { kicker: "Prijs zonder verrassingen", title: "Wat een nacht kost, met de toeslagen erbij", lines: ["Toeristenbelasting en stroom: als we ze weten, staan ze erbij", "Weten we iets niet, dan staat er onbekend"], footer: stand },
        slideFor("app", facts)!,
      ];
      const i = Math.min(Math.max(1, opts.slide ?? 1), slides.length) - 1;
      return { ...slides[i], footer: `${i + 1}/${slides.length} · ${slides[i].footer}` };
    }
  }
}
