// Adressen aanvullen via de PDOK Locatieserver (Kadaster, BAG). Alleen een adres dat vlak bij het punt van de plek ligt:
// een camperplaats in een weiland heeft vaak geen eigen adres, en dan blijft het veld leeg (nooit verzinnen).
// https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse

export const PDOK_REVERSE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse";
/** Verder weg dan dit is het waarschijnlijk niet het adres van de plek zelf */
export const MAX_METERS = 75;

export type PdokDoc = {
  straatnaam?: string;
  huisnummer?: number | string;
  huisletter?: string;
  huisnummertoevoeging?: string;
  postcode?: string;
  woonplaatsnaam?: string;
  afstand?: number;
};

export function reverseUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    type: "adres",
    rows: "1",
    distance: String(MAX_METERS),
    fl: "straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,afstand",
  });
  return `${PDOK_REVERSE}?${q}`;
}

/** Straat en postcode uit het dichtstbijzijnde adres, of null als het te ver weg of onvolledig is */
export function addressFrom(doc: PdokDoc | undefined): { street: string; postcode: string; afstand: number } | null {
  if (!doc || typeof doc.afstand !== "number" || doc.afstand > MAX_METERS) return null;
  const street = doc.straatnaam?.trim();
  const nr = doc.huisnummer != null ? String(doc.huisnummer).trim() : "";
  const pc = doc.postcode?.replace(/\s/g, "").toUpperCase();
  if (!street || !nr || !pc || !/^\d{4}[A-Z]{2}$/.test(pc)) return null;
  // Geen huisnummertoevoeging: op een camping is "16-0004" een losse standplaats of chalet, niet het adres van de plek
  return { street: `${street} ${nr}${doc.huisletter ?? ""}`, postcode: `${pc.slice(0, 4)} ${pc.slice(4)}`, afstand: Math.round(doc.afstand) };
}
