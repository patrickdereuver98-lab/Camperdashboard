// OpenStreetMap → VrijStaan-velden

/** Overpass-query per provincie (ISO 3166-2, bv. NL-GE) */
export function placesQuery(region: string) {
  return `[out:json][timeout:110];
area["ISO3166-2"="${region}"]->.r;
(
  nwr["tourism"="caravan_site"](area.r);
  nwr["motorhome"~"^(yes|designated)$",i](area.r);
);
out center tags;`;
}

export function pointsQuery(region: string) {
  return `[out:json][timeout:60];
area["ISO3166-2"="${region}"]->.r;
(
  nwr["amenity"="sanitary_dump_station"](area.r);
  nwr["amenity"="water_point"](area.r);
);
out center tags;`;
}

export const REGIONS: Record<string, string> = {
  "NL-DR": "Drenthe", "NL-FL": "Flevoland", "NL-FR": "Friesland", "NL-GE": "Gelderland",
  "NL-GR": "Groningen", "NL-LI": "Limburg", "NL-NB": "Noord-Brabant", "NL-NH": "Noord-Holland",
  "NL-OV": "Overijssel", "NL-UT": "Utrecht", "NL-ZE": "Zeeland", "NL-ZH": "Zuid-Holland",
};

type Tags = Record<string, string>;

const MONTHS: Record<string, string> = {
  jan: "januari", feb: "februari", mar: "maart", apr: "april", may: "mei", jun: "juni",
  jul: "juli", aug: "augustus", sep: "september", oct: "oktober", nov: "november", dec: "december",
};

// ── Strikte OSM-booleans ────────────────────────────────────────────────────
//
// OSM-waarden zijn vrije tekst. We kennen alleen een vaste lijst waarden toe aan true/false; al het andere
// ("unknown", "?", tikfouten) wordt `undefined` (onbekend), zodat de site nooit iets beweert dat niet in de bron staat.
// Meervoudige waarden ("yes;fee") gebruiken de eerste waarde.

type BoolKind = "generic" | "shower" | "internet" | "dog" | "power" | "reservation" | "fee";

const TRUE_GENERIC = ["yes", "true", "1", "designated", "customers", "permissive", "limited", "seasonal", "only", "public"];
const FALSE_GENERIC = ["no", "false", "0", "none", "private"];

const EXTRA_TRUE: Record<BoolKind, string[]> = {
  generic: [],
  shower: ["hot", "cold", "outdoor", "indoor", "fee"],
  internet: ["wlan", "wifi", "wired", "terminal", "service"],
  dog: ["leashed", "unleashed", "outside", "inside"],
  power: ["cee", "cee_blue", "cee_16a", "schuko", "230v", "16a", "6a", "10a", "fee"],
  reservation: ["required", "recommended"],
  fee: [],
};
const EXTRA_FALSE: Record<BoolKind, string[]> = {
  generic: [],
  shower: [],
  internet: [],
  dog: [],
  power: [],
  // "members_only" / "willing_to_accept" zeggen niets over gewoon reserveren: onbekend
  reservation: [],
  // "fee=free" betekent: geen kosten
  fee: ["free", "gratis"],
};

export function osmBool(raw: string | undefined, kind: BoolKind = "generic"): boolean | undefined {
  if (raw == null) return undefined;
  const v = raw.split(";")[0].trim().toLowerCase().replace(/\s+/g, "_");
  if (!v) return undefined;
  if (FALSE_GENERIC.includes(v) || EXTRA_FALSE[kind].includes(v)) return false;
  if (TRUE_GENERIC.includes(v) || EXTRA_TRUE[kind].includes(v)) return true;
  return undefined;
}

/** Eerste bekende waarde uit meerdere tags (bv. power_supply of electricity) */
function firstBool(t: Tags, keys: string[], kind: BoolKind = "generic") {
  for (const k of keys) {
    const b = osmBool(t[k], kind);
    if (b !== undefined) return b;
  }
  return undefined;
}

// ── Toelating en naam ──────────────────────────────────────────────────────

/** Alleen echte camperplekken: tourism=caravan_site of expliciet motorhome=yes/designated */
export function isMotorhomePlace(t: Tags): boolean {
  if (t.tourism === "caravan_site") return true;
  return /^(yes|designated)$/i.test((t.motorhome ?? "").split(";")[0].trim());
}

// Namen die niets zeggen: die behandelen we als ontbrekend (de database maakt er "Camperplaats <plaats>" van)
const GENERIC_NAME =
  /^(p\d*|parking|parkeerplaats|parkeren|camper(plaats|plaatsen|parking|park|s)?|campers|motorhome(s| parking)?|stellplatz|wohnmobil(stellplatz)?|caravan(site)?|camping|aire|yes|no|naam|onbekend|unknown|\W*)$/i;

function cleanName(v?: string): string | undefined {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 120 || GENERIC_NAME.test(s)) return undefined;
  return s;
}

/** Beste naam uit OSM, of undefined (dan genereert ingest_osm een naam met de dichtstbijzijnde plaats) */
export function placeName(t: Tags): string | undefined {
  for (const k of ["name:nl", "name", "official_name", "alt_name", "short_name", "brand"]) {
    const n = cleanName(t[k]);
    if (n) return n;
  }
  return undefined;
}

export function parsePrice(v?: string): number | undefined {
  if (!v) return undefined;
  // Alleen een prijs per nacht/dag; tarieven per uur, persoon, week enz. zijn geen nachtprijs
  if (/\/\s*(?:h|hour|uur|min|person|persoon|pp|week|month|year|kwh)\b|per\s*(?:hour|uur|person|persoon)/i.test(v)) return undefined;
  if (/^\s*(?:0|free|gratis|none|no)\s*$/i.test(v)) return 0;
  const m = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:eur|€)|(?:€|eur)\s*(\d{1,3}(?:[.,]\d{1,2})?)/i.exec(v);
  const n = m ? Number((m[1] ?? m[2]).replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 && n < 150 ? n : undefined;
}

function season(oh?: string): { open_all_year?: boolean; season?: string } {
  if (!oh) return {};
  const v = oh.trim();
  if (/^24\/7$/.test(v) || /^(jan|mo)[a-z]*\s*-\s*(dec|su)[a-z]*$/i.test(v) || /^week 0?1-5[23]$/i.test(v))
    return { open_all_year: true };
  const m = /^([A-Z][a-z]{2})(?:\s*(\d{1,2}))?\s*-\s*([A-Z][a-z]{2})(?:\s*(\d{1,2}))?/.exec(v);
  if (m && MONTHS[m[1].toLowerCase()] && MONTHS[m[3].toLowerCase()]) {
    const from = `${m[2] ? `${Number(m[2])} ` : ""}${MONTHS[m[1].toLowerCase()]}`;
    const to = `${m[4] ? `${Number(m[4])} ` : ""}${MONTHS[m[3].toLowerCase()]}`;
    return { open_all_year: false, season: `${from} – ${to}` };
  }
  return {};
}

/** check_in / check_out / maxstay / opening_hours=24/7 (OSM-wiki): alleen als het er letterlijk staat */
function times(t: Tags): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const clock = (v?: string, last = false) => {
    const all = [...(v ?? "").matchAll(/(\d{1,2}):(\d{2})/g)];
    const m = last ? all[all.length - 1] : all[0];
    return m && Number(m[1]) < 24 ? `${m[1].padStart(2, "0")}:${m[2]}` : undefined;
  };
  // "-18:00" of "06:00-10:00": vertrekken kan uiterlijk tot de laatste tijd
  const out_ = clock(t.check_out, true);
  if (out_) Object.assign(out, { departure: "vast", checkout_until: out_ });
  const in_ = t.check_in && !t.check_in.trim().startsWith("-") ? clock(t.check_in) : undefined;
  if (in_) out.checkin_from = in_;
  const stay = /^(\d{1,3})\s*(nights?|days?|nachten|dagen)$/i.exec(t.maxstay ?? "") ?? /^(\d{1,3})\s*(hours?|h|uur)$/i.exec(t.maxstay ?? "");
  if (stay) {
    const n = Number(stay[1]);
    const nights = /hour|^h$|uur/i.test(stay[2]) ? Math.floor(n / 24) : n;
    if (nights >= 1 && nights <= 60) out.max_stay_nights = nights;
  }
  if (/^24\/7$/.test((t.opening_hours ?? "").trim())) out.access_24h = true;
  return out;
}

function kind(t: Tags): string {
  const name = placeName(t) ?? "";
  if (/boerderij|boerencamping|\bboer\b|hoeve|farm/i.test(name)) return "boerderij";
  if (/jachthaven|marina|passantenhaven/i.test(name)) return "jachthaven";
  if (t.tourism === "camp_site") return "camping";
  if (t.amenity === "parking") return "parkeerplaats";
  return "camperplaats";
}

function surface(v?: string) {
  if (!v) return undefined;
  if (/asphalt|paved|concrete|paving_stones|sett|bricks/.test(v)) return "verhard";
  if (/grass/.test(v)) return v.includes("paving") ? "gemengd" : "gras";
  if (/gravel|fine_gravel|compacted|pebblestone/.test(v)) return "grind";
  return undefined;
}

function url(v?: string) {
  if (!v) return undefined;
  const s = v.split(";")[0].trim();
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

function image(t: Tags): { image_url?: string; image_credit?: string } {
  const commons = t.wikimedia_commons ?? (t.image?.includes("commons.wikimedia.org") ? t.image : undefined);
  if (commons) {
    const file = commons.replace(/^.*(File:|Bestand:)/, "");
    if (/\.(jpe?g|png|webp)$/i.test(file))
      return {
        image_url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1280`,
        image_credit: "Wikimedia Commons",
      };
  }
  if (t.image && /^https:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(t.image)) return { image_url: t.image, image_credit: new URL(t.image).host };
  return {};
}

export function mapOsm(e: Record<string, unknown>) {
  const t = (e.tags ?? {}) as Tags;
  const lat = (e.lat ?? (e.center as { lat?: number })?.lat) as number | undefined;
  const lng = (e.lon ?? (e.center as { lon?: number })?.lon) as number | undefined;
  if (lat == null || lng == null || lat < 50.7 || lat > 53.7 || lng < 3.2 || lng > 7.3) return null;
  if (!isMotorhomePlace(t)) return null;
  if (/^(private|no)$/i.test(t.access ?? "") || osmBool(t.disused) === true || t["disused:tourism"] || t["abandoned:tourism"]) return null;

  const fee = osmBool(t.fee, "fee");
  const price = parsePrice(t.charge) ?? (fee === false ? 0 : undefined);
  const capacity = Number(t["capacity:motorhome"] ?? t["capacity:caravans"] ?? t.capacity);
  const maxlength = Number((t.maxlength ?? "").replace(",", "."));
  const description = t["description:nl"] ?? t.description;

  const row: Record<string, unknown> = {
    osm_type: e.type,
    osm_id: e.id,
    name: placeName(t),
    kind: kind(t),
    lat,
    lng,
    street: t["addr:street"] ? `${t["addr:street"]} ${t["addr:housenumber"] ?? ""}`.trim() : undefined,
    postcode: t["addr:postcode"],
    town: t["addr:city"],
    description: description && description.length >= 25 ? description : undefined,
    price_eur: price,
    power: firstBool(t, ["power_supply", "electricity"], "power"),
    water: firstBool(t, ["drinking_water", "water_point"]),
    dump_station: firstBool(t, ["sanitary_dump_station", "waste_disposal"]),
    toilet: firstBool(t, ["toilets", "toilets:access"]),
    shower: osmBool(t.shower, "shower"),
    wifi: osmBool(t.internet_access, "internet"),
    dogs: osmBool(t.dog, "dog"),
    capacity: Number.isFinite(capacity) && capacity > 0 && capacity < 2000 ? Math.round(capacity) : undefined,
    max_length_m: Number.isFinite(maxlength) && maxlength > 3 && maxlength < 25 ? maxlength : undefined,
    surface: surface(t.surface),
    reservation: osmBool(t.reservation, "reservation"),
    website: url(t.website ?? t["contact:website"] ?? t.url),
    phone: t.phone ?? t["contact:phone"],
    email: t.email ?? t["contact:email"],
    ...season(t.opening_hours),
    ...times(t),
    ...image(t),
  };
  for (const k of Object.keys(row)) if (row[k] === undefined || row[k] === "") delete row[k];
  return row;
}
