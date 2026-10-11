// Feiten uit de website van een camperplaats halen.
// Regel: alleen wat expliciet op de site staat. Ontkenningen ("geen honden") gaan voor.
// Niets wordt afgeleid of aangenomen; een veld zonder vermelding blijft leeg.

const MONTHS_NL = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const MONTH_ALIASES: Record<string, number> = {
  jan: 0, januari: 0, january: 0, januar: 0,
  feb: 1, februari: 1, february: 1, februar: 1,
  mrt: 2, maart: 2, mar: 2, march: 2, märz: 2, maerz: 2,
  apr: 3, april: 3,
  mei: 4, may: 4, mai: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  aug: 7, augustus: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11, dezember: 11,
};
const MONTH_RE = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length).join("|");

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<(br|\/p|\/li|\/tr|\/h\d|\/div)[^>]*>/gi, " . ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&euro;|&#8364;|&#x20ac;/gi, "€")
    .replace(/&amp;/g, "&")
    .replace(/&eacute;/g, "é")
    .replace(/&euml;/g, "ë")
    .replace(/&uuml;/g, "ü")
    .replace(/&auml;/g, "ä")
    .replace(/&ndash;|&mdash;|&#8211;/g, "–")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
    "i",
  );
  const m = re.exec(html);
  return (m?.[1] ?? m?.[2])?.trim();
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();
}

function flag(text: string, pos: RegExp, neg: RegExp): boolean | undefined {
  if (neg.test(text)) return false;
  if (pos.test(text)) return true;
  return undefined;
}

function jsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const item of items) if (item && typeof item === "object") out.push(item);
    } catch {
      /* ongeldige JSON-LD */
    }
  }
  return out;
}

const NOT_A_PHOTO = /logo|icon|favicon|sprite|avatar|placeholder|banner-ad|badge|flag|vlag|keurmerk|award|rating|thumb(?!nail)|emoji|pixel|spacer|map|kaart|plattegrond|qr/i;

function absolute(src: string | undefined, base: URL): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(decode(src.split(" ")[0]), base);
    if (u.protocol !== "https:") return undefined;
    if (!/\.(jpe?g|webp|png|avif)(\?|$)/i.test(u.pathname + u.search) && !/image|img|photo|foto|media|upload|wp-content/i.test(u.href)) return undefined;
    if (/\.svg($|\?)/i.test(u.pathname) || /\.gif($|\?)/i.test(u.pathname) || NOT_A_PHOTO.test(u.pathname)) return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

/** Grote foto's uit de pagina zelf (hero, slider, galerij), geen logo's of iconen */
function contentImages(html: string, base: URL): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src =
      /\sdata-(?:src|lazy-src|original)=["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\ssrcset=["']([^"']+)["']/i.exec(tag)?.[1]?.split(",").pop()?.trim() ??
      /\ssrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const w = Number(/\swidth=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    const h = Number(/\sheight=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    if ((w && w < 400) || (h && h < 250)) continue;
    if (NOT_A_PHOTO.test(tag.replace(/src(set)?=["'][^"']*["']/gi, ""))) continue;
    const url = absolute(src, base);
    if (url && !out.includes(url)) out.push(url);
    if (out.length >= 8) break;
  }
  return out;
}

function money(s: string): number {
  return Number(s.replace(/\.(?=\d{3}\b)/, "").replace(",", ".").replace(/[-–]$/, ""));
}

export function extract(pages: string[], base: URL) {
  const html = pages.join("\n");
  const text = pages.map(toText).join(" . ");
  const out: Record<string, unknown> = {};

  // ── JSON-LD ──────────────────────────────────────────────────────────────
  for (const item of jsonLd(pages[0])) {
    const type = String(item["@type"] ?? "");
    if (!/Campground|Lodging|LocalBusiness|Tourist|Organization|Place|RVPark|Hotel/i.test(type)) continue;
    if (typeof item.telephone === "string") out.phone ??= item.telephone;
    if (typeof item.email === "string") out.email ??= item.email.replace(/^mailto:/, "");
    const img = Array.isArray(item.image) ? item.image[0] : item.image;
    const imgUrl = typeof img === "string" ? img : (img as { url?: string })?.url;
    out.image_url ??= absolute(imgUrl, base);
    const addr = item.address as Record<string, string> | undefined;
    if (addr && typeof addr === "object") {
      out.street ??= addr.streetAddress;
      out.postcode ??= addr.postalCode;
    }
    if (item.petsAllowed !== undefined) out.dogs ??= item.petsAllowed === true || item.petsAllowed === "true";
    for (const f of (Array.isArray(item.amenityFeature) ? item.amenityFeature : []) as { name?: string; value?: unknown }[]) {
      const name = String(f?.name ?? "").toLowerCase();
      const v = f?.value === false || f?.value === "false" ? false : f?.value === undefined || f?.value === true || f?.value === "true" ? true : undefined;
      if (v === undefined) continue;
      if (/wifi|wi-fi|internet/.test(name)) out.wifi ??= v;
      else if (/shower|douche/.test(name)) out.shower ??= v;
      else if (/toilet/.test(name)) out.toilet ??= v;
      else if (/electric|stroom|power/.test(name)) out.power ??= v;
      else if (/pet|dog|hond|huisdier/.test(name)) out.dogs ??= v;
    }
  }

  // ── Beschrijving en foto's ──────────────────────────────────────────────
  const desc = meta(pages[0], "og:description") ?? meta(pages[0], "description");
  if (desc) {
    const d = decode(desc);
    if (d.length >= 40 && d.length <= 400 && !/cookie|javascript|lorem ipsum/i.test(d)) out.description = d;
  }
  const photos: string[] = [];
  const add = (u?: string) => u && !photos.includes(u) && photos.push(u);
  add(out.image_url as string | undefined);
  for (const p of pages) {
    add(absolute(meta(p, "og:image") ?? meta(p, "og:image:secure_url") ?? meta(p, "twitter:image"), base));
  }
  for (const p of pages) for (const u of contentImages(p, base)) add(u);
  if (photos.length) {
    out.image_url = photos[0];
    out.image_credit = base.host;
    out.photos = photos.slice(0, 8).map((url) => ({ url, credit: base.host }));
  }

  // ── Contact ──────────────────────────────────────────────────────────────
  const tel = /href=["']tel:([+\d\s()-]{8,20})["']/i.exec(html)?.[1];
  if (tel) out.phone ??= tel.trim();
  const mail = /href=["']mailto:([^"'?]+@[^"'?]+)["']/i.exec(html)?.[1];
  if (mail && !/example|domain|voorbeeld|sentry|wix/i.test(mail)) out.email ??= mail.trim();

  // ── Prijs per nacht ─────────────────────────────────────────────────────
  const AMOUNT = "(\\d{1,2}(?:[.,]\\d{2})?)(?:\\s*,-|\\s*[-–](?=\\s))?";
  const PER = "(?:per|p\\.?|\\/|pro)\\s*(?:nacht|night|dag|camper|plaats|plek|overnachting|24\\s*uur|etmaal|stellplatz|standplaats|kampeerplaats|kampeermiddel|staanplaats|pitch|motorhome|kampeerauto)";
  const prices: number[] = [];
  for (const re of [
    new RegExp(`€\\s?${AMOUNT}\\s*(?:euro\\s*)?${PER}`, "g"),
    new RegExp(`${AMOUNT}\\s*(?:euro|eur|€)\\s*${PER}`, "g"),
    // Tarieventabel: "camperplaats … € 15,00" (max. 40 tekens ertussen)
    new RegExp(`(?:camperplaats|camperplek|campertarief|camper|kampeerplaats|standplaats|staanplaats|stellplatz)[^€.]{0,40}€\\s?${AMOUNT}`, "g"),
    new RegExp(`(?:overnachting|overnachten|nachttarief|tarief per nacht|prijs per nacht|kosten per nacht|camperstandplaats)[^€.]{0,30}€\\s?${AMOUNT}`, "g"),
    // Eenheid vóór het bedrag: "tent, caravan of camper, 2 personen, per nacht* € 22,00"
    new RegExp(`(?:camper|caravan|kampeerplaats|standplaats|staanplaats)[^€.]{0,70}per (?:nacht|dag)\\*?\\s*€\\s?${AMOUNT}`, "g"),
  ])
    for (const m of text.matchAll(re)) {
      // Geen weekprijzen, prijzen per persoon/uur/kWh of losse toeslagen
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 30);
      if (/week|maand|seizoen|jaar|monat|saison|month|year/.test(m[0])) continue;
      if (/^\s*(?:euro\s*)?(?:per|p\.?|\/|pro)\s*(?:persoon|pers|p\.?p|person|uur|hour|stunde|kwh|week|maand|hond|dog|kind)/.test(after)) continue;
      if (/p\.?p\.?|per persoon|toeristenbelasting|kurtaxe|douche|stroom|kwh|hond/.test(m[0])) continue;
      prices.push(money(m[1]));
    }
  // schema.org priceRange alleen als er expliciet een nachtprijs staat ("€ 22 per nacht")
  for (const item of jsonLd(pages[0])) {
    const range = typeof item.priceRange === "string" ? item.priceRange.toLowerCase() : "";
    const m = /€\s?(\d{1,2}(?:[.,]\d{2})?)\s*(?:,-\s*)?(?:per|p\.?|\/)\s*(?:nacht|night)/.exec(range);
    if (m) prices.push(money(m[1]));
  }
  const valid = prices.filter((p) => p >= 5 && p <= 75);
  if (valid.length) {
    const sorted = [...valid].sort((a, b) => a - b);
    out.price_eur = sorted[0];
    if (sorted[sorted.length - 1] > sorted[0])
      out.price_note = `vanaf € ${sorted[0].toFixed(2).replace(".", ",")} per nacht; hoogste genoemde tarief € ${sorted[sorted.length - 1].toFixed(2).replace(".", ",")}`;
  } else if (/(gratis|kosteloos|kostenloos) (overnachten|staan|parkeren voor campers|camperplaats)|overnachten is gratis|kostenlos übernachten|free overnight/.test(text)) {
    out.price_eur = 0;
  }
  const tax = flag(
    text,
    /(inclusief|incl\.?|inkl\.?) (de )?(toeristen ?belasting|kurtaxe|tourist tax)/,
    /(exclusief|excl\.?|exkl\.?) (de )?(toeristen ?belasting|kurtaxe|tourist tax)|toeristenbelasting (is )?niet inbegrepen|(plus|\+) toeristenbelasting/,
  );
  if (tax !== undefined) out.tourist_tax_included = tax;

  // ── Voorzieningen ────────────────────────────────────────────────────────
  const set = (key: string, v: boolean | undefined) => {
    if (v !== undefined) out[key] ??= v;
  };
  set(
    "power",
    flag(
      text,
      /(?<!geen )(stroom(aansluiting|punt|paal|voorziening|kast)?|elektra(aansluiting)?|elektriciteit|walstroom|\d+\s?amp(è|e)re|\d+\s?a stroom|strom(anschluss)?|electricity|electric hook-?up)\b/,
      /geen (stroom|elektra|elektriciteit)|zonder stroom|kein strom|no electricity/,
    ),
  );
  set(
    "water",
    flag(
      text,
      /(drinkwater|water (tappen|innemen|bijvullen|vullen|tanken)|watertappunt|waterpunt|tappunt|waterkraan|watervoorziening|water en stroom|stroom en water|water \| ja|water: ja|vers water|schoon water|frischwasser|fresh water|water supply)/,
      /geen (drink)?water(punt|voorziening)?\b|kein (frisch)?wasser/,
    ),
  );
  set(
    "dump_station",
    flag(
      text,
      /(lozen|loosplaats|lozingspunt|dumpstation|dump station|afvalwater|grijs ?water|vuil ?water|chemisch toilet (legen|ledigen|lozen)|cassette (legen|ledigen)|servicestation|serviceplaats|servicepunt|camperservice|entsorgung|ver- und entsorgung|grauwasser|dump point|waste water|lozen \| ja|lozen: ja)/,
      /geen (loos|lozing|dump|mogelijkheid (tot|om) (te )?lozen)|keine entsorgung/,
    ),
  );
  // "chemisch toilet legen" gaat over het toilet in de camper, niet over een toilet op de plek
  set(
    "toilet",
    flag(
      text,
      /(?<!geen |chemisch |chemische |eigen )(toilet(ten|gebouw|groep)?|sanitair(gebouw)?|wc's?|toiletten|toilette|restrooms?)\b(?! ?(legen|ledigen|lozen|cassette|leeg|entleerung))/,
      /geen (toilet|wc|sanitair)|keine toilette|no toilets?/,
    ),
  );
  set("shower", flag(text, /(?<!geen )(douche|douches|dusche|showers?)\b/, /geen douche|keine dusche|no showers?/));
  set("wifi", flag(text, /(wifi|wi-fi|wlan|draadloos internet|gratis internet)/, /geen (wifi|wi-fi|internet)|kein wlan|no wifi/));
  set(
    "dogs",
    flag(
      text,
      /(honden (zijn |is )?(van harte |ook )?(welkom|toegestaan|aangelijnd)|hond(en)? (is |zijn )?(mag|mogen|welkom|toegestaan)|huisdieren (zijn )?(welkom|toegestaan)|hond(en)?vriendelijk|hunde (sind )?(erlaubt|willkommen)|dogs (are )?(welcome|allowed)|pets (are )?(welcome|allowed)|(honden|huisdieren|hond)\s*[:|]\s*(ja|toegestaan|welkom|mag)|honden mogen mee|hond mag mee)/,
      /(geen (honden|huisdieren)|honden (zijn )?niet (toegestaan|welkom)|huisdieren (zijn )?niet (toegestaan|welkom)|verboden voor honden|hundeverbot|keine hunde|no dogs|no pets|(honden|huisdieren)\s*[:|]\s*(nee|niet toegestaan|verboden))/,
    ),
  );

  // ── Aantal plekken ───────────────────────────────────────────────────────
  const cap =
    /(\d{1,3})\s*(?:ruime\s*|verharde\s*|grote\s*)?(?:camper(?:plaatsen|plekken|staanplaatsen)|plaatsen voor campers|plekken voor (?:campers|kampeerauto'?s)|stellpl(?:ä|a)tze)/.exec(text) ??
    /(\d{1,3})\s*(?:ruime\s*|toeristische\s*|grote\s*)?(?:kampeerplaatsen|standplaatsen|staanplaatsen|toeristische plaatsen)/.exec(text);
  const room = /(?:ruimte|plaats|plek|plekken|plaatsen) voor (?:maximaal |max\.? |ca\.? )?(\d{1,3}) (?:campers|kampeerauto'?s|motorhomes|wohnmobile)/.exec(text);
  const n = Number((cap ?? room)?.[1]);
  if (n > 0 && n <= 600) out.capacity = n;

  const len = /max(?:imaal|imale|\.)?\s*(?:lengte\s*)?(?:van\s*)?(?:de camper\s*)?(\d{1,2}(?:[.,]\d)?)\s*(?:m|meter)\b/.exec(text);
  if (len) {
    const n = Number(len[1].replace(",", "."));
    if (n >= 5 && n <= 20) out.max_length_m = n;
  }

  // ── Seizoen ──────────────────────────────────────────────────────────────
  // Alleen als het over het kamperen gaat: "de chalets zijn het hele jaar geopend" of "zwembad van april tot
  // oktober geopend" zegt niets over de camperplaats. Bij twijfel laten we het veld leeg.
  const OTHER =
    /\b(chalets?|horeca|restaurant|zwembad|receptie|winkel|snackbar|kantine|vakantiehui(?:s|zen)|accommodaties?|appartement(?:en)?|huisjes?|lodges?|b&b|bungalows?|stacaravans?|safaritent(?:en)?|glamping|hotel|kamers?|speeltuin|sauna|cafe|bar)\b/;
  const aboutCamping = (index: number, match: string) => {
    // Alleen binnen dezelfde zin kijken
    const before = text.slice(Math.max(0, index - 60), index);
    return !OTHER.test(before.slice(before.lastIndexOf(".") + 1) + match);
  };
  const allYear =
    /(het )?(hele|gehele) jaar (door )?(geopend|open)|(geopend|open) (het )?(hele|gehele) jaar|jaarrond (geopend|open)|365 dagen (per|per het) jaar|ganzjährig (geöffnet)?|open all year|year-round/g;
  const ranged = new RegExp(
    `(?:geopend|open|seizoen|kampeerseizoen|openingsperiode|openingstijden|saison|season)[^.]{0,25}?(?:van(?:af)?\\s+)?(?:(\\d{1,2})\\s+)?(${MONTH_RE})\\.?\\s*(?:t/m|tot en met|tot|-|–|bis|to|until)\\s*(?:(\\d{1,2})\\s+)?(${MONTH_RE})\\b`,
    "g",
  );
  // Numeriek: "01-04 t/m 31-10"
  const numeric = /(?:geopend|open|seizoen|periode)[^.]{0,25}?(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?\s*(?:t\/m|tot en met|tot|-|–)\s*(\d{1,2})[-/.](\d{1,2})/g;
  type Hit = { index: number; allYear?: true; season?: RegExpExecArray };
  const hits: Hit[] = [];
  for (const m of text.matchAll(allYear)) if (aboutCamping(m.index!, m[0])) hits.push({ index: m.index!, allYear: true });
  for (const m of text.matchAll(ranged)) if (aboutCamping(m.index!, m[0])) hits.push({ index: m.index!, season: m as RegExpExecArray });
  for (const m of text.matchAll(numeric)) if (aboutCamping(m.index!, m[0])) hits.push({ index: m.index!, season: m as RegExpExecArray });
  hits.sort((a, b) => a.index - b.index);
  for (const hit of hits) {
    if (hit.allYear) {
      out.open_all_year = true;
      break;
    }
    const season = hit.season!;
    let from = "";
    let to = "";
    if (MONTH_ALIASES[season[2]] !== undefined) {
      from = `${season[1] ? `${Number(season[1])} ` : ""}${MONTHS_NL[MONTH_ALIASES[season[2]]]}`;
      to = `${season[3] ? `${Number(season[3])} ` : ""}${MONTHS_NL[MONTH_ALIASES[season[4]]]}`;
    } else {
      const fm = Number(season[2]) - 1;
      const tm = Number(season[4]) - 1;
      if (fm >= 0 && fm <= 11 && tm >= 0 && tm <= 11) {
        from = `${Number(season[1])} ${MONTHS_NL[fm]}`;
        to = `${Number(season[3])} ${MONTHS_NL[tm]}`;
      }
    }
    if (from && to && from !== to) {
      out.open_all_year = false;
      out.season = `${from} – ${to}`;
      break;
    }
  }

  // ── Reserveren ───────────────────────────────────────────────────────────
  const res = flag(
    text,
    /(reserveer (nu|direct|online)|reserveren (is )?(mogelijk|gewenst|verplicht|aanbevolen|noodzakelijk)|online (boeken|reserveren)|boek (nu|direct)|reservierung (möglich|erforderlich)|book (now|online))/,
    /(reserveren (is )?niet (mogelijk|nodig)|geen reservering(en)?|wie het eerst komt|keine reservierung|no reservations?)/,
  );
  if (res !== undefined) out.reservation = res;

  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === null || out[k] === "") delete out[k];
  out.fields = Object.keys(out).filter((k) => !["photos", "image_credit", "price_note"].includes(k));
  return out as Record<string, unknown> & { fields: string[] };
}
