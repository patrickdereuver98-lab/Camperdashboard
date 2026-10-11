// Bedrijfsgegevens voor de juridische pagina's (privacy, voorwaarden, disclaimer, melden).
// Vul de velden die nog null zijn één keer in vóór livegang. Zolang een veld null is, tonen de pagina's
// een zichtbare tekst als "[KvK-nummer nog invullen]".

export interface CompanyInfo {
  /** Statutaire naam of naam van de eenmanszaak */
  name: string | null;
  tradeName: string;
  /** Straat en huisnummer */
  address: string | null;
  postcode: string | null;
  city: string | null;
  kvk: string | null;
  /** Btw-identificatienummer */
  vat: string | null;
  /** Ook het contactadres in site_settings */
  email: string;
  phone: string | null;
}

export const COMPANY: CompanyInfo = {
  name: null,
  tradeName: "VrijStaan",
  address: null,
  postcode: null,
  city: null,
  kvk: null,
  vat: null,
  email: "hallo@vrijstaan.nl",
  phone: null,
};

const LABELS: Record<keyof CompanyInfo, string> = {
  name: "Naam onderneming",
  tradeName: "Handelsnaam",
  address: "Straat en huisnummer",
  postcode: "Postcode",
  city: "Plaats",
  kvk: "KvK-nummer",
  vat: "Btw-nummer",
  email: "E-mailadres",
  phone: "Telefoonnummer",
};

/** Waarde van een bedrijfsveld, of een zichtbare plaatshouder als hij nog niet is ingevuld */
export function company(key: keyof CompanyInfo): string {
  return COMPANY[key] ?? `[${LABELS[key]} nog invullen]`;
}

/** Volledig adres op één regel */
export function companyAddress(): string {
  return `${company("address")}, ${company("postcode")} ${company("city")}`;
}
