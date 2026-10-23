export type PlaceKind = "camperplaats" | "camping" | "parkeerplaats" | "boerderij" | "jachthaven";

export interface PriceExtra {
  label: string;
  amount: number;
  unit?: string;
}

export interface Photo {
  url: string;
  credit?: string;
  /** De rechthebbende gaf toestemming (vastgelegd in beheer) */
  permission?: boolean;
  /** Licentie en bronpagina, bv. bij Wikimedia Commons */
  license?: string;
  source?: string;
}

/** Een gepubliceerde plek. Ontbrekende velden betekenen: onbekend. */
export interface Place {
  id: string;
  slug: string;
  name: string;
  kind?: PlaceKind;
  lat: number;
  lng: number;
  street?: string;
  postcode?: string;
  town: string;
  province: string;
  description?: string;
  descriptionSource?: string;
  priceEur?: number;
  priceNote?: string;
  /** De prijs is het laagste genoemde tarief ("vanaf") */
  priceFrom?: boolean;
  touristTaxIncluded?: boolean;
  power?: boolean;
  water?: boolean;
  dumpStation?: boolean;
  toilet?: boolean;
  shower?: boolean;
  wifi?: boolean;
  dogs?: boolean;
  capacity?: number;
  maxLengthM?: number;
  surface?: string;
  openAllYear?: boolean;
  season?: string;
  reservation?: boolean;
  /** Reserveren als drie keuzes, letterlijk van de website; leeg = onbekend */
  reservationRule?: "verplicht" | "mogelijk" | "niet_nodig";
  maxStayNights?: number;
  /** vrij = geen vaste vertrektijd, per24 = je betaalt per 24 uur, vast = vertrek uiterlijk checkoutUntil */
  departure?: "vrij" | "per24" | "vast";
  checkoutUntil?: string;
  /**
   * Controle van de vertrekregel door beheer of eigenaar. Een regel uit een bron is genoeg voor Zonder vertrektijd
   * (besluit 18 oktober 2026); "bevestigd" sorteert alleen eerder. "voorwaardelijk" = soms toch een tijd (bv. bij
   * drukte), "afgewezen" = klopt niet; beide staan bij Overige.
   */
  departureCheck?: "bevestigd" | "voorwaardelijk" | "afgewezen";
  departureCheckedAt?: string;
  departureCheckedBy?: "beheer" | "eigenaar";
  checkinFrom?: string;
  /** Laatste aankomsttijd (HH:MM) */
  checkinUntil?: string;
  /** Toegangstijden van slagboom of poort, bv. "07:30–23:00" */
  accessHours?: string;
  access24h?: boolean;
  /** Letterlijke zin(nen) uit de bron waarop de tijden zijn gebaseerd */
  timesNote?: string;
  /** Losse toeslagen zoals de website ze noemt */
  priceExtras?: PriceExtra[];
  website?: string;
  phone?: string;
  email?: string;
  imageUrl?: string;
  imageCredit?: string;
  photos: Photo[];
  ratingAvg?: number;
  ratingCount: number;
  completeness: number;
  verifiedAt?: string;
  updatedAt?: string;
}

/** Lichte variant voor zoeken en kaarten (zonder lange teksten). */
export type PlaceSummary = Pick<
  Place,
  | "id"
  | "slug"
  | "name"
  | "kind"
  | "lat"
  | "lng"
  | "town"
  | "province"
  | "priceEur"
  | "priceFrom"
  | "touristTaxIncluded"
  | "power"
  | "water"
  | "dumpStation"
  | "toilet"
  | "shower"
  | "wifi"
  | "dogs"
  | "capacity"
  | "maxLengthM"
  | "openAllYear"
  | "season"
  | "departure"
  | "checkoutUntil"
  | "departureCheck"
  | "priceExtras"
  | "imageUrl"
  | "ratingAvg"
  | "ratingCount"
  | "completeness"
  | "imageCredit"
  | "checkinFrom"
  | "checkinUntil"
  | "access24h"
  | "accessHours"
>;

export interface Review {
  id: string;
  authorName: string;
  rating: number;
  scoreLocation?: number;
  scoreQuiet?: number;
  scoreFacilities?: number;
  scoreValue?: number;
  title?: string;
  body: string;
  vehicle?: string;
  visitedMonth?: string;
  createdAt: string;
}

export interface Town {
  name: string;
  province: string;
  lat: number;
  lng: number;
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

export const KIND_LABEL: Record<PlaceKind, string> = {
  camperplaats: "Camperplaats",
  camping: "Camping",
  parkeerplaats: "Camperparkeerplaats",
  boerderij: "Bij de boer",
  jachthaven: "Jachthaven",
};
