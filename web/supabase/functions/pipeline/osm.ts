// OpenStreetMap → VrijStaan-velden

/** Overpass-query per provincie (ISO 3166-2, bv. NL-GE) */
export function placesQuery(region: string) {
  return `[out:json][timeout:110];
area["ISO3166-2"="${region}"]->.r;
(
  nwr["tourism"="caravan_site"](area.r);
  nwr["tourism"="camp_site"]["motorhome"!="no"]["tents"!="only"](area.r);
  nwr["amenity"="parking"]["motorhome"~"^(yes|designated)$"](area.r);
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

export function yesNo(v?: string): boolean | undefined {
  if (!v) return undefined;
  if (/^(yes|designated|customers|true|1|hot|wlan|wifi|leashed|free|included|only)$/i.test(v.trim())) return true;
  if (/^(no|false|0|none)$/i.test(v.trim())) return false;
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

function kind(t: Tags): string {
  const name = t.name ?? "";
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
  if (t.access === "private" || t.disused === "yes") return null;

  const fee = yesNo(t.fee);
  const price = parsePrice(t.charge) ?? (fee === false ? 0 : undefined);
  const capacity = Number(t["capacity:motorhome"] ?? t["capacity:caravans"] ?? t.capacity);
  const maxlength = Number((t.maxlength ?? "").replace(",", "."));
  const description = t["description:nl"] ?? t.description;

  const row: Record<string, unknown> = {
    osm_type: e.type,
    osm_id: e.id,
    name: t.name ?? t["name:nl"],
    kind: kind(t),
    lat,
    lng,
    street: t["addr:street"] ? `${t["addr:street"]} ${t["addr:housenumber"] ?? ""}`.trim() : undefined,
    postcode: t["addr:postcode"],
    town: t["addr:city"],
    description: description && description.length >= 25 ? description : undefined,
    price_eur: price,
    power: yesNo(t.power_supply ?? t.electricity),
    water: yesNo(t.drinking_water ?? t.water_point),
    dump_station: yesNo(t.sanitary_dump_station),
    toilet: yesNo(t.toilets),
    shower: yesNo(t.shower),
    wifi: t.internet_access ? !/^no$/i.test(t.internet_access) : undefined,
    dogs: yesNo(t.dog),
    capacity: Number.isFinite(capacity) && capacity > 0 && capacity < 2000 ? Math.round(capacity) : undefined,
    max_length_m: Number.isFinite(maxlength) && maxlength > 3 && maxlength < 25 ? maxlength : undefined,
    surface: surface(t.surface),
    reservation: t.reservation ? /^(yes|required|recommended)$/.test(t.reservation) : undefined,
    website: url(t.website ?? t["contact:website"] ?? t.url),
    phone: t.phone ?? t["contact:phone"],
    email: t.email ?? t["contact:email"],
    ...season(t.opening_hours),
    ...image(t),
  };
  for (const k of Object.keys(row)) if (row[k] === undefined || row[k] === "") delete row[k];
  return row;
}
