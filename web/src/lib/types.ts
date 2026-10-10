export type Price = "gratis" | "betaald";

export interface Place {
  slug: string;
  name: string;
  /** Geen naam in de bron: `name` is afgeleid van de woonplaats. */
  unnamed?: boolean;
  town: string;
  province: string;
  lat: number;
  lng: number;
  price?: Price;
  /** Prijs per nacht in euro, als die bekend is. */
  priceEur?: number;
  priceText?: string;
  power?: boolean;
  /** true = welkom, false = niet toegestaan, undefined = onbekend */
  dogs?: boolean;
  water?: boolean;
  spots?: number;
  hours?: string;
  website?: string;
  phone?: string;
}

export const PROVINCES = [
  "Drenthe",
  "Flevoland",
  "Friesland",
  "Gelderland",
  "Groningen",
  "Limburg",
  "Noord-Brabant",
  "Noord-Holland",
  "Overijssel",
  "Utrecht",
  "Zeeland",
  "Zuid-Holland",
] as const;
