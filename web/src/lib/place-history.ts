// Geschiedenis per plek (tabel place_history, migratie 20261118100000_plekgeschiedenis.sql): namen van velden en
// bronnen, en hoe een oude of nieuwe waarde in beheer wordt getoond.

export type HistoryRow = {
  id: number;
  ts: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  actor_email: string | null;
  revert_of: number | null;
};

export const FIELD_LABEL: Record<string, string> = {
  name: "Naam",
  kind: "Soort",
  operator: "Beheerder",
  status: "Status",
  merged_into: "Samengevoegd met",
  lat: "Breedtegraad",
  lng: "Lengtegraad",
  street: "Straat",
  postcode: "Postcode",
  town: "Plaats",
  province: "Provincie",
  description: "Beschrijving",
  price_eur: "Prijs per nacht",
  price_note: "Toelichting prijs",
  price_extras: "Toeslagen",
  tourist_tax_included: "Toeristenbelasting inbegrepen",
  power: "Stroom",
  power_note: "Toelichting stroom",
  water: "Drinkwater",
  dump_station: "Afvalwater lozen",
  toilet: "Toilet",
  shower: "Douche",
  wifi: "Wifi",
  dogs: "Honden toegestaan",
  capacity: "Aantal plekken",
  max_length_m: "Max. lengte",
  surface: "Ondergrond",
  open_all_year: "Hele jaar open",
  season: "Seizoen",
  reservation: "Reserveren mogelijk",
  reservation_rule: "Reserveerregel",
  max_stay_nights: "Max. nachten",
  departure: "Vertrekken",
  checkout_until: "Vertrek uiterlijk",
  checkin_from: "Aankomst vanaf",
  checkin_until: "Aankomst tot",
  access_hours: "Slagboom/poort open",
  access_24h: "Dag en nacht toegang",
  times_note: "Bron vertrektijden",
  website: "Website",
  phone: "Telefoon",
  email: "E-mail",
};

export const SOURCE_LABEL: Record<string, string> = {
  beheer: "Beheer",
  osm: "OpenStreetMap",
  website: "Website",
  pdok: "PDOK",
  ontdekken: "Website zoeken",
  samenvoegen: "Samenvoegen",
  eigenaar: "Eigenaar",
  "doe-mee": "Doe mee",
  pipeline: "Pipeline",
  systeem: "Systeem",
};

const DEPARTURE: Record<string, string> = { vrij: "Geen vaste vertrektijd", per24: "Per 24 uur", vast: "Vaste vertrektijd" };
const STATUS: Record<string, string> = { published: "Online", draft: "Concept", hidden: "Verborgen" };

/** Waarde zoals beheer hem leest. Leeg is "Onbekend"; lange tekst wordt ingekort. */
export function formatHistoryValue(field: string, value: unknown, max = 120): string {
  if (value === null || value === undefined || value === "") return "Onbekend";
  if (typeof value === "boolean") return value ? "Ja" : "Nee";
  if (field === "price_eur" && typeof value === "number") return `€ ${value.toFixed(2).replace(".", ",")}`;
  if (field === "max_length_m" && typeof value === "number") return `${String(value).replace(".", ",")} m`;
  if (field === "departure" && typeof value === "string") return DEPARTURE[value] ?? value;
  if (field === "status" && typeof value === "string") return STATUS[value] ?? value;
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** De nieuwste wijziging per veld: alleen die kan worden teruggezet (de server controleert het ook). */
export function revertableIds(rows: HistoryRow[]): Set<number> {
  const seen = new Set<string>();
  const ids = new Set<number>();
  for (const r of [...rows].sort((a, b) => b.id - a.id)) {
    if (seen.has(r.field)) continue;
    seen.add(r.field);
    ids.add(r.id);
  }
  return ids;
}
