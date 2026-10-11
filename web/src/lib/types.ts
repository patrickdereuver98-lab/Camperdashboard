export type PlaceKind = "camperplaats" | "camping" | "parkeerplaats" | "boerderij" | "jachthaven";

export interface Photo {
  url: string;
  credit?: string;
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
  maxStayNights?: number;
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
  | "imageUrl"
  | "ratingAvg"
  | "ratingCount"
  | "completeness"
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
