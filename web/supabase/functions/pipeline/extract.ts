// Feiten uit de website van een camperplaats halen.
// Regel: alleen wat expliciet op de site staat. Ontkenningen ("geen honden") gaan voor.
// Niets wordt afgeleid of aangenomen; een veld zonder vermelding blijft leeg.

// Gedeeld met de site, zodat scraper en weergave dezelfde regels volgen
import { cleanDescription } from "../../../src/lib/description.ts";
import { rankPhotos, upgradePhotoUrl } from "../../../src/lib/photos.ts";

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
const WEEKDAY = "(?:maan|dins|woens|donder|vrij|zater|zon)dag";
const MONTH_RE = Object.keys(MONTH_ALIASES).sort((a, b) => b.length - a.length).join("|");

function toText(html: string): string {
  // "vòòr" (accent grave) als "vóór"; zelfde lengte, dus posities blijven gelijk aan de ruwe tekst
  return joinSplit(toRawText(html).toLowerCase().replace(/ò/g, "ó"));
}

/** Woorden die een paginabouwer in losse letters heeft gehakt ("v ertrek", "v ó ór") weer heel maken. De weggehaalde
 *  spaties komen erachter, zodat de tekst even lang blijft en citaten uit de ruwe tekst op dezelfde plek staan. */
export function joinSplit(text: string): string {
  return text.replace(/\bv ertrek[a-z]*|\bv ?ó ?ó ?r\b|\bu it(?:check|erlijk)[a-z]*/g, (m) => {
    const joined = m.replace(/ /g, "");
    return joined + " ".repeat(m.length - joined.length);
  });
}

/** Zelfde tekst als toText, maar met hoofdletters, voor letterlijke citaten */
function toRawText(html: string): string {
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
    .replace(/&ndash;|&mdash;|&#8211;/g, "–")
    .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (_, d, x) => String.fromCodePoint(d ? Number(d) : parseInt(x, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => decodeEntity(n) ?? " ")
    .replace(/\s+/g, " ");
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", szlig: "ß" };
const ACCENTS: Record<string, string> = { acute: "\u0301", grave: "\u0300", uml: "\u0308", circ: "\u0302", tilde: "\u0303" };

/** &oacute; → ó: "Uitchecken: v&oacute;&oacute;r 11:00 uur" moet als "vóór 11:00 uur" gelezen worden */
function decodeEntity(name: string): string | undefined {
  const m = /^([a-z])(acute|grave|uml|circ|tilde)$/i.exec(name);
  if (m) return (m[1] + ACCENTS[m[2].toLowerCase()]).normalize("NFC");
  return ENTITIES[name.toLowerCase()];
}

/** Alle HTML-entiteiten in platte tekst (ook voor de zoekagenten-controle in index.ts) */
export const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);|&#x([0-9a-f]+);/gi, (_, d, x) => String.fromCodePoint(d ? Number(d) : parseInt(x, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => decodeEntity(n) ?? m);

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

/**
 * De eerste echte alinea's van de pagina (geen menu, kop, voet of cookiemelding), samen hooguit ±700 tekens.
 * cleanDescription knipt daarna af op een hele zin en keurt slechte tekst af.
 */
function introText(html: string): string {
  const body = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+(cookie|consent|gdpr)[^>]*>[\s\S]*?<\/div>/gi, " ");
  let text = "";
  for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const p = decode(m[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    // Alleen gewone alinea's: hoofdletter vooraan, minstens één hele zin, geen knoptekst ("Lees hier …")
    if (p.length < 60 || !/^[A-ZÀ-Ý0-9'‘"“]/.test(p) || !/[.!?]/.test(p) || /^(lees|klik|bekijk|boek|reserveer)\b/i.test(p)) continue;
    text = text ? `${text} ${p}` : p;
    if (text.length >= 250) break;
  }
  if (text.length <= 700) return text;
  const cut = text.slice(0, 700);
  return cut.slice(0, Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? ")) + 1);
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
    let raw = decode(src.trim().split(/\s+/)[0]);
    // Sommige sites zetten een volledig adres als relatief pad: "https://site.nl/https://cdn…/foto.jpg"
    const last = raw.lastIndexOf("http");
    if (last > 0 && /^https?:\/\//.test(raw.slice(last))) raw = raw.slice(last);
    const u = new URL(raw, base);
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
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const tag = m[0];
    // srcset: "a.jpg 640w, b.jpg 1280w" → grootste kandidaat, zonder de breedte-aanduiding
    const set = /\s(?:data-)?srcset=["']([^"']+)["']/i.exec(tag)?.[1]?.split(",").pop()?.trim().split(/\s+/)[0];
    const src =
      /\sdata-(?:src|lazy-src|original)=["']([^"']+)["']/i.exec(tag)?.[1] ?? set ?? /\ssrc=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!src || src.startsWith("data:")) continue;
    if (NOT_A_PHOTO.test(tag.replace(/src(set)?=["'][^"']*["']/gi, ""))) continue;
    const url = absolute(src, base);
    if (!url) continue;
    // Klein getoond is pas een probleem als er geen grotere versie bestaat (WordPress, Wix … geven die wel)
    const w = Number(/\swidth=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    const h = Number(/\sheight=["']?(\d+)/i.exec(tag)?.[1] ?? 0);
    const min = upgradePhotoUrl(url) !== url ? [120, 80] : [400, 250];
    if ((w && w < min[0]) || (h && h < min[1])) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= 16) break;
  }
  // Achtergrondfoto's van headers en sliders (style="background-image:url(…)", data-bg, data-background)
  if (out.length < 16) {
    const bg = /background(?:-image)?\s*:\s*url\(\s*(?:&quot;|["'])?([^"')&]+?)(?:&quot;|["'])?\s*\)|\sdata-(?:bg|background|background-image)=["']([^"']+)["']/gi;
    for (const m of html.matchAll(bg)) {
      const url = absolute(m[1] ?? m[2], base);
      if (url && !out.includes(url) && !NOT_A_PHOTO.test(url)) out.push(url);
      if (out.length >= 16) break;
    }
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
  // Homepage: alle soorten bedrijf of plek. Subpagina's (contact, tarieven): alleen de camping of het bedrijf zelf,
  // niet een losse accommodatie of hotelkamer die daar beschreven staat.
  const ld = [
    ...jsonLd(pages[0]).map((item) => ({ item, home: true })),
    ...pages.slice(1).flatMap((p) => jsonLd(p).map((item) => ({ item, home: false }))),
  ];
  for (const { item, home } of ld) {
    const type = String(item["@type"] ?? "");
    if (!(home ? /Campground|Lodging|LocalBusiness|Tourist|Organization|Place|RVPark|Hotel/i : /Campground|RVPark|LocalBusiness|Organization/i).test(type)) continue;
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
  // Dezelfde regels als de site (web/src/lib/description.ts): alleen hele Nederlandse zinnen. De meta-omschrijving
  // is vaak afgekapt ("Lees meer"); de eerste alinea's van de pagina zelf zijn meestal vollediger.
  const metaDesc = cleanDescription(decode(meta(pages[0], "og:description") ?? meta(pages[0], "description") ?? ""));
  const intro = cleanDescription(introText(pages[0]));
  const description = intro && intro.length > (metaDesc?.length ?? 0) ? intro : metaDesc;
  if (description) out.description = description;

  // Foto's: alles verzamelen, dan dezelfde rangorde als de site (web/src/lib/photos.ts): een echte foto van de plek
  // vooraan, keurmerken en logo's van anderen, stockfoto's en miniaturen eruit. De URL blijft het origineel.
  const candidates: string[] = [];
  const add = (u?: string) => u && !candidates.includes(u) && candidates.push(u);
  add(out.image_url as string | undefined);
  for (const p of pages) {
    add(absolute(meta(p, "og:image") ?? meta(p, "og:image:secure_url") ?? meta(p, "twitter:image"), base));
  }
  for (const p of pages) for (const u of contentImages(p, base)) add(u);
  const photos = rankPhotos(candidates.map((url) => ({ url, credit: base.host }))).slice(0, 8);
  if (photos.length) {
    out.image_url = photos[0].url;
    out.image_credit = base.host;
    out.photos = photos;
  } else {
    delete out.image_url;
  }

  // ── Contact ──────────────────────────────────────────────────────────────
  const tel = /href=["']tel:([+\d\s()-]{8,20})["']/i.exec(html)?.[1];
  if (tel) out.phone ??= tel.trim();
  const mail = /href=["']mailto:([^"'?]+@[^"'?]+)["']/i.exec(html)?.[1];
  if (mail && !/example|domain|voorbeeld|sentry|wix/i.test(mail)) out.email ??= mail.trim();

  // ── Prijs per nacht ─────────────────────────────────────────────────────
  const AMOUNT = "(\\d{1,2}(?:[.,]\\d{2})?)(?:\\s*,-|\\s*[-–](?=\\s))?";
  const PER = "(?:per|p\\.?|\\/|pro)\\s*(?:nacht|night|dag|camper|plaats|plek|overnachting|24\\s*uur|etmaal|stellplatz|standplaats|kampeerplaats|kampeermiddel|staanplaats|pitch|motorhome|kampeerauto)";
  // Elk gevonden bedrag met de zin ervoor, zodat we toeslagen kunnen herkennen
  const prices: { amount: number; pitch: boolean }[] = [];
  const PITCH = /camper|caravan|kampeerplaats|standplaats|staanplaats|stellplatz|kampeermiddel|tent|2 personen|twee personen|plaats incl|plek incl/;
  const SURCHARGE =
    /\bextra\b|campinggast|\bgast(en)?\b|bezoek|\bkind(eren)?\b|volwassene|\bbaby|\bhond(en)?\b|huisdier|\bauto\b|\bboot\b|fiets|wasmachine|droger|toeslag|\bborg\b|annulering|reserveringskosten|administratie/;
  for (const re of [
    new RegExp(`€\\s?${AMOUNT}\\s*(?:euro\\s*)?${PER}`, "g"),
    new RegExp(`${AMOUNT}\\s*(?:euro|eur|€)\\s*${PER}`, "g"),
    // Tarieventabel: "camperplaats … € 15,00" (max. 40 tekens ertussen)
    new RegExp(`(?:camperplaats|camperplek|campertarief|camper|kampeerplaats|kampeerplek|campingplaats|toeristenplaats|passantenplaats|standplaats|staanplaats|stellplatz)(?:[^€.]|\\b(?:excl|incl|pers|max|ca)\\.){0,40}€\\s?${AMOUNT}`, "g"),
    new RegExp(`(?:overnachting|overnachten|nachttarief|tarief per nacht|prijs per nacht|kosten per nacht|camperstandplaats)[^€.]{0,30}€\\s?${AMOUNT}`, "g"),
    // Eenheid vóór het bedrag: "tent, caravan of camper, 2 personen, per nacht* € 22,00"
    // ook met wat er inbegrepen is en een seizoen ertussen: "camper, inclusief 2 personen, …, per nacht: hoogseizoen € 26,50"
    new RegExp(`(?:camper|caravan|kampeerplaats|standplaats|staanplaats)[^€.]{0,160}per (?:nacht|dag)\\*?:?\\s*(?:[a-z–/ -]{0,30}?)?€\\s?${AMOUNT}`, "g"),
    // "per caravan per nacht € 18,50"
    new RegExp(`per (?:camper|caravan|kampeerplaats|standplaats|staanplaats|camperplaats|kampeermiddel)(?: per (?:nacht|dag|overnachting))?\\s*:?\\s*€\\s?${AMOUNT}`, "g"),
    // "een overnachting kost 7,50 euro"
    new RegExp(`(?:overnachting|overnachten|camperplaats|camperplek|staanplaats|een nacht)[^€.]{0,40}?kost(?:en)?\\s*€\\s?${AMOUNT}`, "g"),
    new RegExp(`(?:overnachting|overnachten|camperplaats|camperplek|staanplaats|een nacht)[^€.]{0,40}?kost(?:en)?\\s*${AMOUNT}\\s*euro`, "g"),
  ])
    for (const m of text.matchAll(re)) {
      // Geen weekprijzen, prijzen per persoon/uur/kWh of losse toeslagen
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 30);
      // Prijzen per week, maand of seizoen (seizoenplaatsen) tellen niet; "hoogseizoen € 26,50 per nacht" wel
      if (/(?:per|p\.?|\/|pro)\s*(?:week|maand|seizoen|jaar|monat|saison|month|year)|(?:week|maand|seizoens?|jaar)(?:prijs|tarief|plaats|plaatsen)|seizoensplaats|jaarplaats|monat|month|year/.test(m[0])) continue;
      if (/^\s*(?:euro\s*)?(?:per|p\.?|\/|pro)\s*(?:persoon|pers|p\.?p|person|uur|hour|stunde|kwh|week|maand|hond|dog|kind)/.test(after)) continue;
      // Wat er inbegrepen is ("inclusief 2 personen, 1 auto, elektra, douche") is geen toeslag
      // Net zo "(excl. toeristenbelasting)": dat zegt dat het bedrag zónder die toeslag is, het is zelf geen toeslag
      const included = /\b(?:incl\.?|inclusief|inkl\.?)[^€]{0,160}|\(?\b(?:excl\.?|exclusief|exkl\.?)\s[^€)]{0,60}\)?|\bmet (?:stroom|elektra|elektriciteit)\b/g;
      if (/p\.?p\.?|per persoon|toeristenbelasting|kurtaxe|douche|stroom|kwh|hond/.test(m[0].replace(included, " "))) continue;
      // De zin vóór het bedrag: "extra campinggast per nacht € 5" is een toeslag, geen nachtprijs
      const before = text.slice(Math.max(0, m.index! - 50), m.index!);
      const sentence = before.slice(before.lastIndexOf(".") + 1);
      if (SURCHARGE.test((sentence + m[0]).replace(included, " "))) continue;
      prices.push({ amount: money(m[1]), pitch: PITCH.test(sentence + m[0]) });
    }
  // schema.org priceRange alleen als er expliciet een nachtprijs staat ("€ 22 per nacht")
  for (const { item } of ld) {
    const range = typeof item.priceRange === "string" ? item.priceRange.toLowerCase() : "";
    const m = /€\s?(\d{1,2}(?:[.,]\d{2})?)\s*(?:,-\s*)?(?:per|p\.?|\/)\s*(?:nacht|night)/.exec(range);
    if (m) prices.push({ amount: money(m[1]), pitch: true });
  }
  // Bedragen die we als losse toeslag herkennen (extra persoon, hond, stroom …) zijn geen nachtprijs
  const extras = priceExtras(text);
  const extraAmounts = new Set(extras.map((x) => x.amount));
  // Bedragen bij een kampeerplek gaan voor; alleen als die er niet zijn, de losse nachtprijzen
  const inRange = prices.filter((p) => p.amount >= 5 && p.amount <= 75 && !(extraAmounts.has(p.amount) && !p.pitch));
  const valid = (inRange.some((p) => p.pitch) ? inRange.filter((p) => p.pitch) : inRange).map((p) => p.amount);
  if (valid.length) {
    const sorted = [...valid].sort((a, b) => a - b);
    out.price_eur = sorted[0];
    if (sorted[sorted.length - 1] > sorted[0])
      out.price_note = `vanaf € ${sorted[0].toFixed(2).replace(".", ",")} per nacht; hoogste genoemde tarief € ${sorted[sorted.length - 1].toFixed(2).replace(".", ",")}`;
  } else if (/(gratis|kosteloos|kostenloos) (overnachten|staan|parkeren voor campers|camperplaats)|overnachten is gratis|kostenlos übernachten|free overnight/.test(text)) {
    out.price_eur = 0;
  }
  if (extras.length) out.price_extras = extras;
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
      /(drinkwater|water (tappen|innemen|bijvullen|vullen|tanken)|watertappunt|waterpunt|tappunt|waterkraan|watervoorziening|water en stroom|stroom en water|water \| ja|water: ja|vers water|schoon water|frischwasser|fresh water|water supply|water op (de|elke|iedere|uw|je) (plaats|plek|kampeerplaats|staanplaats)|watertap|water(aansluiting|aftappunt|tappunten)|stromend water|kraanwater|water (is )?(inbegrepen|inclusief)|gebruik van (koud )?water)/,
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
      /(honden (zijn |is )?(van harte |ook )?(welkom|toegestaan|aangelijnd)|hond(en)? (is |zijn )?(mag|mogen|welkom|toegestaan)|huisdieren (zijn )?(welkom|toegestaan)|hond(en)?vriendelijk|hunde (sind )?(erlaubt|willkommen)|dogs (are )?(welcome|allowed)|pets (are )?(welcome|allowed)|(honden|huisdieren|hond)\s*[:|]\s*(ja|toegestaan|welkom|mag)|honden mogen mee|hond mag mee|huisdieren zijn [^.]{0,45}toegestaan|honden (en|&) [a-z]+ (zijn )?welkom|maximaal \d+ (hond|honden|huisdier|huisdieren)\b|(?:^|[\s|:(])(hond|honden|huisdier|huisdieren|hond of kat|per hond|per huisdier)\s*:?\s*(per (nacht|overnachting|dag)\s*)?(€|eur\b|\d{1,2}[,.]\d{2}\b|gratis)|€\s?\d{1,2}(?:[,.]\d{2})?\s*(?:,-\s*)?(per (nacht|dag|overnachting)\s*)?per (hond|huisdier))/,
      /(geen (honden|huisdieren)|honden (zijn )?niet (toegestaan|welkom)|huisdieren (zijn )?niet (toegestaan|welkom)|verboden voor honden|hundeverbot|keine hunde|no dogs|no pets|(honden|huisdieren)\s*[:|]\s*(nee|niet toegestaan|verboden))/,
    ),
  );

  // ── Aantal plekken ───────────────────────────────────────────────────────
  const cap =
    /(\d{1,3})\s*(?:ruime\s*|verharde\s*|grote\s*)?(?:camper(?:plaatsen|plekken|staanplaatsen)|plaatsen voor campers|plekken voor (?:campers|kampeerauto'?s)|stellpl(?:ä|a)tze)/.exec(text) ??
    /(\d{1,3})\s*(?:ruime\s*|toeristische\s*|grote\s*)?(?:kampeerplaatsen|kampeerplekken|standplaatsen|staanplaatsen|staanplekken|toeristische plaatsen)/.exec(text) ??
    // Teller in losse blokken ("25" boven "Kampeerplaatsen"): getal en woord elk een eigen blok, minstens 10
    /(?:^|\.)\s*(\d{2,3})\s*\.\s*(?:kampeerplaatsen|kampeerplekken|camperplaatsen|camperplekken|standplaatsen|staanplaatsen)\s*(?:\.|$)/.exec(text);
  const room = /(?:ruimte|plaats|plek|plekken|plaatsen) voor (?:maximaal |max\.? |ca\.? )?(\d{1,3}) (?:campers|kampeerauto'?s|motorhomes|wohnmobile)/.exec(text);
  const n = Number((cap ?? room)?.[1]);
  if (n > 1 && n <= 600) out.capacity = n;

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
    // "geopend van woensdag 25 maart 2026 tot donderdag 15 oktober 2026": weekdag en jaartal mogen erbij staan
    `(?:geopend|open|seizoen|kampeerseizoen|openingsperiode|openingstijden|saison|season)[^.]{0,25}?(?:van(?:af)?\\s+)?(?:${WEEKDAY}\\s+)?(?:(\\d{1,2})\\s+)?(${MONTH_RE})\\.?(?:\\s+\\d{4})?\\s*(?:t/m|tot en met|tot|-|–|bis|to|until)\\s*(?:${WEEKDAY}\\s+)?(?:(\\d{1,2})\\s+)?(${MONTH_RE})\\b`,
    "g",
  );
  // Numeriek: "01-04 t/m 31-10"
  const numeric = /(?:geopend|open|seizoen|periode)[^.]{0,25}?(\d{1,2})[-/.](\d{1,2})(?:[-/.]\d{2,4})?\s*(?:t\/m|tot en met|tot|-|–)\s*(\d{1,2})[-/.](\d{1,2})/g;
  type Hit = { index: number; allYear?: true; season?: RegExpExecArray };
  const hits: Hit[] = [];
  for (const m of text.matchAll(allYear)) if (aboutCamping(m.index!, m[0])) hits.push({ index: m.index!, allYear: true });
  // "openingstijden: gesloten van 1 november tot 19 maart" is de winterpauze, niet het seizoen
  const closed = (m: RegExpMatchArray) => /gesloten|dicht|closed|geschlossen|winterstop|winterpauze/.test(m[0]);
  for (const m of text.matchAll(ranged)) if (aboutCamping(m.index!, m[0]) && !closed(m)) hits.push({ index: m.index!, season: m as RegExpExecArray });
  for (const m of text.matchAll(numeric)) if (aboutCamping(m.index!, m[0]) && !closed(m)) hits.push({ index: m.index!, season: m as RegExpExecArray });
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

  // ── Aankomst- en vertrektijden ───────────────────────────────────────────
  const raw = pages.map(toRawText).join(" . ");
  Object.assign(out, arrivalDeparture(text, raw.length === text.length ? raw : text));
  // Niets in de tekst? Boekingssystemen zetten de tijden soms alleen in gestructureerde gegevens (schema.org
  // checkoutTime). Alleen als dat over de camping of camperplaats zelf gaat, niet over een chalet of hotelkamer.
  if (out.departure === undefined) {
    const ld = pages.flatMap((p) => jsonLd(p)).find((i) => /Campground|RVPark/i.test(String(i["@type"] ?? "")) && i.checkoutTime);
    const clock = (v: unknown) => /(?:^|T)(\d{1,2}):(\d{2})/.exec(String(v ?? ""));
    const outTime = clock(ld?.checkoutTime);
    if (ld && outTime && Number(outTime[1]) >= 7 && Number(outTime[1]) <= 14) {
      out.departure = "vast";
      out.checkout_until = `${outTime[1].padStart(2, "0")}:${outTime[2]}`;
      const inTime = clock(ld.checkinTime);
      if (inTime && out.checkin_from === undefined) out.checkin_from = `${inTime[1].padStart(2, "0")}:${inTime[2]}`;
      out.times_note = `Volgens de gegevens op de website: vertrek uiterlijk ${out.checkout_until}`;
    }
  }

  // ── Reserveren ───────────────────────────────────────────────────────────
  const res = flag(
    text,
    /(reserveer (nu|direct|online)|reserveren (is )?(mogelijk|gewenst|verplicht|aanbevolen|noodzakelijk)|online (boeken|reserveren)|boek (nu|direct)|reservierung (möglich|erforderlich)|book (now|online)|reserveer (je|uw|jouw) (plek|plaats|kampeerplaats|camperplaats|staanplaats|camperplek)|zoek (&|en) boek|boek (je|uw|jouw) (plek|plaats|kampeerplaats|vakantie|verblijf)|reserveren kan (telefonisch|via|online|per)|(je|u) kunt (online |telefonisch )?reserveren)/,
    /(reserveren (is )?niet (mogelijk|nodig|noodzakelijk|verplicht)|kan maar is niet noodzakelijk|geen reservering(en)?|wie het eerst komt|keine reservierung|no reservations?)/,
  );
  if (res !== undefined) out.reservation = res;

  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === null || out[k] === "") delete out[k];
  out.fields = Object.keys(out).filter((k) => !["photos", "image_credit", "price_note", "times_note"].includes(k));
  return out as Record<string, unknown> & { fields: string[] };
}

// ── Aankomst- en vertrektijden ─────────────────────────────────────────────
// De kern van VrijStaan: kun je vertrekken wanneer je wilt? Alleen wat letterlijk op de site staat telt,
// en we bewaren de zin zelf als bewijs. Tijden voor chalets, verhuur of de receptie tellen niet mee,
// en "eerder aankomen of later vertrekken tegen toeslag" is geen vertrektijd.

const CLOCK = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(uur|uhr|u\b|h\b|hrs?\b)?`;
const TIME_AFTER = new RegExp(
  // Met een verbindingswoord ("vertrek vóór 11:00"), of de tijd direct erna ("vertrek 12 uur", "vertrektijd 11.00 uur")
  String.raw`^(?:[^0-9]{0,60}?(?:vanaf|na|voor|vóór|uiterlijk|ten laatste|tot|om|\brond|tussen|is|\btijd|from|after|before|until|by|at|ab|bis|um|spätestens|:|\|)|[\s–-]{0,3})\s*${CLOCK}(?:\s*(?:en|tot|-|–|t/m|und|and)\s*${CLOCK})?`,
);
// "uiterlijk 11.00 uur uitchecken", "om 11:00 uur de plaats verlaten" (hoogstens vier woorden ertussen, zoals "op de dag van"; geen leesteken)
const TIME_BEFORE = new RegExp(String.raw`(?:voor|vóór|uiterlijk|ten laatste|om|before|bis|um)\s*${CLOCK}\s*(?:[a-zà-ÿ]+\s+){0,4}$`);
// "tot 12:00 uur op de dag van vertrek", "tot 11.00 uur op de vertrekdag"; niet "open van 9.00 tot 12.00 uur voor vertrek"
const TIME_BEFORE_TOT = new RegExp(String.raw`\btot\s*${CLOCK}\s*op de (?:dag van\s*)?$`);
const TIME_BEFORE_IN = new RegExp(String.raw`(?:vanaf|na|from|after|ab)\s*${CLOCK}\s*$`);
const KEY =
  /(aankomsttijd(?:en)?|aankomst|aankomen|inchecktijd|inchecken|check-?in|anreise|arrival|vertrektijd(?:en)?|vertrekuur|vertrekken|vertrek|uitchecktijd|uitchecken|uitcheckt|uit te checken|leeg (?:te )?(?:zijn|maken)|vrij (?:te )?maken|opgeleverd|opleveren|verlaat|laatste dag van (?:uw|je|jullie) verblijf|check-?out|auschecken|abreise|departure|verlaten|verlassen|vrij te zijn|vrij zijn)/g;
const ARRIVAL_KEY = /aankom|incheck|check-?in|anreise|arrival/;
const RENTAL =
  /\b(chalets?|huuraccommodaties?|accommodaties?|huurtent(en)?|stacaravans?|bungalows?|lodges?|safaritent(en)?|glamping|hotel|kamers?|b&b|trekkershut(ten)?|groepsacc?om+odaties?|groepshuis|jamboreehuis|recreatiewoning(en)?|vakantiewoning(en)?|huurders?|vakantiehui(s|zen)|appartement(en)?|tiny ?houses?|cottages?|huisjes?|receptie|winkel|restaurant|zwembad|snackbar|kantine|slagboom|arrangement(en)?|pakket(ten)?|groepen?)\b/;
const EXCEPTION =
  /\d+ (werk)?dagen voor (vertrek|aankomst)|weken voor (vertrek|aankomst)|deelnemers|aanbetaling|restbedrag|voldaan|vroege? aankomst|eerder aankomen|vroeg aankomen|laat vertrek|later vertrek|later vertrekken|laat vertrekken|late check-?out|early check-?in|late check-?in|annuler|toeslag|bijbetaling|tegen betaling|datum|kiezen|keuze/;
// "In overleg" is geen voorwaarde: "vertrek vóór 11:00 of in overleg" is gewoon een vaste tijd met uitzonderingen op verzoek
const CONDITIONAL = /bij drukte|als het druk|hoogseizoen|in de zomer|tijdens (drukke|vakantie|de zomer)|feestdagen|indien/;
// Alleen vóór de tijd: "vertrektijd op zondag 12:00" is een voorwaarde, "vertrek voor 11:00 (op zondag tot 13:00)" niet
// Ook "wanneer men vanaf 17.00u arriveert"; niet "maandag t/m zondag"
const CONDITIONAL_PRE = /\bop zondag|\bzondags\b|\bzondagen\b|alleen (tijdens|op|in)|pinksteren|pasen|hemelvaart|wanneer (men|u|je) (vanaf|na) \d/;
// Bijzin met omgekeerd werkwoord: "Kom je aan na 22.00 uur of vertrek je voor 8.00 uur, dan dien je …"
const CONDITIONAL_CLAUSE = /\b(?:vertrek|kom) je\b[^,]*,\s*dan\b|\b(?:vertrekt|komt) u\b[^,]*,\s*dan\b/;
// Een vraag ("Ik wil vóór 08:00 vertrekken, kan dat?") is geen regel van de camping
const QUESTION = /\b(kan dat|kan ik|kunnen (we|wij)|mag ik|mogen (we|wij)|ik wil|(we|wij) willen)\b/;
const CAMPER = /camper|kampeerauto|stellplatz|motorhome|wohnmobil/;
// Specifieker dan "camping": deze tijd gaat over de kampeerplek zelf, niet over de camping in het algemeen
const PITCH_ONLY = /kampeerpla|kampeerplek|standpla|staanpla|kampeermiddel|camperpla|camperplek/;
const PITCH_CONTEXT = /camper|kampeerauto|kampeerplaats|kampeerplek|standplaats|staanplaats|kampeermiddel|stellplatz|motorhome|camping/;
// Sterk: zegt letterlijk dat er geen aankomst- of vertrektijden zijn
const FREE =
  /geen (vaste |gezette )?(aankomst-? ?(en|of) ?)?vertrektijd(en)?|geen (vaste |gezette )?(vertrek|in- en uitcheck|in- en uitrij|check-?in(- en check-?out)?)tijden|hanteren (wij |we )?geen (vaste )?(aankomst- en )?vertrektijden|vrij (aankomen en vertrekken|in- en uitrijden|in en uit rijden)|vertrek (is )?(op elk (gewenst )?(moment|tijdstip)|altijd mogelijk|24 uur per dag)|keine (festen )?(an- und )?abreisezeiten|an- und abreise (ist )?jederzeit|jederzeit (an- und )?abreisen|no (fixed )?(check-?out|departure) times?|(aankomst en vertrek|aankomen en vertrekken) (is |zijn )?(mogelijk )?(24 uur per dag|dag en nacht|altijd|op elk (gewenst )?(moment|tijdstip))|(24 uur per dag|dag en nacht) (aankomst en vertrek|aankomen en vertrekken)|an- und abreise rund um die uhr|vrije (aankomst-? ?(en|of) ?)?vertrek(tijd(en)?|-? ?(en|of) ?aankomsttijd(en)?)|vrije aankomst- en vertrektijd(en)?|check-?in ?\/ ?check-?out \(?24\/7|24\/7 (in- en )?uit(checken|rijden)|(in- en )?uitchecken (is )?24\/7/g;
// Zwak: "komen en gaan wanneer je wilt" gaat vaak over een seizoensplaats of dagtochtjes. Alleen geldig bij campers
// en zonder seizoensplaats-context.
const FREE_WEAK =
  /(aankomen|komen) en (vertrekken|gaan) (wanneer|op elk|zoals)|vertrekken (wanneer (je|u) (wilt|wil)|op elk (gewenst )?(moment|tijdstip)|wanneer het (je|u) uitkomt)|(arrive|come) and (leave|go) (at )?any ?time|leave (at )?any ?time/g;
const SEASONAL = /seizoen|uitvalsbasis|jaarplaats|toercaravan|vouwwagen|laten staan|periode|vaste plaats|seizoensplaats|tussen \d+ \w+ en/;
const ACCESS24 =
  /24 ?uur per dag (bereikbaar|toegankelijk|open|geopend|aankomen|inrijden)|24\/7 (bereikbaar|toegankelijk|open|geopend)|dag en nacht (bereikbaar|toegankelijk|aankomen|open|inrijden)|rund um die uhr (geöffnet|zugänglich|anreisen)|jederzeit anreisen|aankomst (is )?(op elk tijdstip|altijd mogelijk|24 uur per dag)|arrive (at )?any ?time/g;
// Een tijd die direct bij de kampeerplek hoort: "Kampeerplaatsen verlaat je voor 12:00 uur", "uitchecken camping 12.00 uur"
const PITCH_OUT = new RegExp(
  String.raw`(kampeerpla(?:ats|atsen|tsen)|kampeerplek(?:ken)?|camperpla(?:ats|atsen)|camperplek(?:ken)?|staanpla(?:ats|atsen)|standpla(?:ats|atsen)|camping|kampeermiddel(?:en)?)\b(?:(?:(?!open|geopend|receptie|winkel|bereikbaar)[^.?!0-9]){0,40}?(?:voor|vóór|uiterlijk|om|is dat|:))?\s*(\d{1,2})(?:[:.](\d{2})\s*(?:uur|u\b|h\b)?|\s*(?:uur|u\b|h\b))`,
  "g",
);
const OUT_WORD = /vertrek|vertrekken|uitchecken|uitcheck|check-?out|verlaten|verlaat|leeg|auschecken|abreise/g;
const ARRIVAL_WORD = /aankomst|aankomen|inchecken|check-?in|anreise|beschikbaar vanaf/;
// "Je betaalt per 24 uur": geen klokvaste vertrektijd, je vertrekt 24 uur na aankomst
const PER24 =
  /aankomsttijd is (ook )?(de )?vertrektijd|24 uur (vanaf|na) (aankomst|het moment van aankomst|binnenkomst|inchecken)|(betaal(t|en)?|geldig|gerekend) per 24 uur vanaf|24 stunden ab (ankunft|anreise|einfahrt)|umfasst jeweils 24 stunden|24 hours from arrival|(?:de |een )?(?:overnachting|verblijf|staanplaats|camperplaats|plaats) (?:is|geldt|duurt|loopt) (?:telkens |steeds )?(?:voor |per )24 uur|(?:prijzen|tarieven|tarief|prijs) (?:zijn |is |gelden |geldt )?per 24 uur|per periode van 24 uur/g;
// Camperplaatsen met een automaat: "€ 12,50 per 24 uur". Alleen als er geen vaste vertrektijd op de site staat en het
// over campers gaat; de kernpagina toont zo'n plek pas na bevestiging door een mens (kernbelofte).
const PER24_PRICE =
  /(?:€|eur|euro)\s?\d+(?:[.,]\d{1,2})?(?:,-)?\s*(?:per|p\.?|\/)\s?24\s?(?:uur|u\b|h\b)|(?:tarief|prijs|kosten|staanplaats|overnachting|parkeren)[^.]{0,40}?\bper 24 uur|pro 24 stunden|je 24 stunden/g;
// Toegangstijden van slagboom of poort: "de slagboom is geopend van 07:30 tot 23:00 uur"
const GATE = new RegExp(
  String.raw`\b(?:slagboom|schuifpoort|toegangspoort|poort|hek|barri[eè]re|schranke|tor|gate)\b[^.?!]{0,40}?(?:open|geopend|ge[öo]ffnet)[^.0-9]{0,20}?${CLOCK}\s*(?:tot|en|-|–|bis|to)\s*${CLOCK}|(?:tussen|zwischen|between)\s*${CLOCK}\s*(?:en|und|and)\s*${CLOCK}[^.]{0,30}?(?:aankomen en vertrekken|aankomen|an- und abreise|arrive)`,
  "g",
);
const ACCESS_NOT = /telefo|bellen|receptie|noodnummer|wifi|winkel|bereikbaar per|mail|sanitair|toilet|douche|wasruimte|wasserette|sauna|zwembad|restaurant|bar\b/;

/** Gaat het laatste stuk vóór de tijd over verhuur? "Accommodaties: uiterlijk 10.00 uur. Kampeerplaatsen: uiterlijk
 *  11.00 uur" gaat bij de tweede tijd over de kampeerplaats, want dat woord staat dichter bij de tijd. */
function rentalLast(window: string): boolean {
  const last = (re: RegExp) => Math.max(-1, ...[...window.matchAll(new RegExp(re.source, "g"))].map((x) => x.index!));
  const r = last(RENTAL);
  return r >= 0 && r > last(PITCH_ONLY);
}

type TimeHit = { type: "in" | "out"; time: string; index: number; strong: boolean; pitch?: boolean; camper: boolean; cond: boolean };

function sentenceBounds(text: string, index: number): [number, number] {
  // Een punt na een tijd ("voor 12:00.") sluit de zin af; een decimaal ("12.00") en een opsommingsnummer ("1.") niet
  const boundary = /(?<!\b\d)[.!?](?!\d)/g;
  let start = 0;
  let end = text.length;
  for (const m of text.matchAll(boundary)) {
    if (m.index! < index) start = m.index! + 1;
    else {
      end = m.index!;
      break;
    }
  }
  return [start, end];
}

function quote(raw: string, text: string, index: number): string {
  const [s, e] = sentenceBounds(text, index);
  let from = s;
  let to = e;
  if (to - from > 200) {
    from = Math.max(s, index - 70);
    to = Math.min(e, index + 130);
  }
  const q = raw.slice(from, to).replace(/\s*\|\s*/g, " ").replace(/\s+/g, " ").trim();
  return (from > s ? "… " : "") + q.charAt(0).toUpperCase() + q.slice(1) + (to < e ? " …" : "");
}

const asClock = (h: string, m?: string) => `${h.padStart(2, "0")}:${m ?? "00"}`;

export function arrivalDeparture(text: string, raw: string): Record<string, unknown> {
  const hits: TimeHit[] = [];
  for (const k of text.matchAll(KEY)) {
    const i = k.index!;
    const [s, e] = sentenceBounds(text, i);
    const local = text.slice(Math.max(s, i - 60), Math.min(e, i + 90));
    if (EXCEPTION.test(local)) continue;
    const type = ARRIVAL_KEY.test(k[0]) ? "in" : "out";
    // Kopje "aankomst en vertrek" / "aankomst- en vertrektijden": dat woord zelf zegt niet welke tijd erbij hoort; de
    // tijden staan erna met hun eigen woord. En "na het uitchecken" gaat over daarna, niet over de vertrektijd.
    const pre = text.slice(Math.max(s, i - 14), i);
    const post = text.slice(i + k[0].length, i + k[0].length + 16);
    // (maar niet "vanaf 14:00 uur inchecken en uitchecken is om 12:00": daar hoort de tijd al bij het aankomstwoord)
    const timedBefore = /\d(?:[:.]\d{2})?\s*(?:uur|u)?\s*(aankomst|aankomen|inchecken|check-?in)\S*\s*(en|&|\/)?\s*$/.test(text.slice(Math.max(s, i - 40), i));
    if (type === "out" && !timedBefore && /(aankomst|aankomen|inchecken|check-?in)(-?\s*(en|&|\/)\s*|-)$/.test(pre)) continue;
    if (type === "in" && /^(-?\s*(en|&|\/)\s*|-)(vertrek|uitcheck|check-?out)/.test(post)) continue;
    if (type === "out" && /\bna (het )?$/.test(pre)) continue;
    // Vooruit kijken tot de eerstvolgende tijd, maar niet voorbij een sleutelwoord van het andere soort. Is de "zin" een
    // kort kopje ("Uitchecken" boven "Tot 11:00 uur"), dan ook de volgende zin
    const end = e - s < 30 && e < text.length ? sentenceBounds(text, e + 1)[1] : e;
    let ahead = text.slice(i + k[0].length, Math.min(end, i + k[0].length + 70));
    const other = [...ahead.matchAll(KEY)].find((o) => ARRIVAL_KEY.test(o[0]) !== (type === "in"));
    if (other) ahead = ahead.slice(0, other.index);
    let h: string | undefined;
    let m: string | undefined;
    let timeEnd = i + k[0].length;
    let fromBefore = false;
    let a = TIME_AFTER.exec(ahead);
    // "vertrek 12.07.2026" is een datum, geen tijd
    if (a && /^[./-]\d/.test(ahead.slice(a[0].length))) a = null;
    // "tussen 23:00 en 7:00" is een nachtregel, geen vertrektijd
    if (a && a[4] && Number(a[4]) < Number(a[1])) continue;
    // "vertrek na 12 uur € 10" of "…wordt een extra nacht gerekend": dan is 12:00 wél de vertrektijd (later kost geld)
    const lateFee = !!a && /\b(?:na|after)\s*\d/.test(a[0]) &&
      /€|euro|extra|in rekening|toeslag|dagtarief|halve dag|nacht|meegerekend|berekend|in overleg/.test(ahead.slice(a[0].length, a[0].length + 70));
    // "na 08.00 uur en voor 12:00 uur": de "voor"-tijd
    if (a && type === "out" && !a[4] && !lateFee && /\b(?:na|after)\s*\d/.test(a[0])) {
      const deadline = new RegExp(String.raw`^[^0-9]{0,25}?(?:voor|vóór|uiterlijk|tot|before|until)\s*${CLOCK}`).exec(ahead.slice(a[0].length));
      if (deadline && (deadline[2] || deadline[3])) {
        [h, m] = [deadline[1], deadline[2]];
        timeEnd = i + k[0].length + a[0].length + deadline[0].length;
      }
      a = null;
    }
    // "vanaf 14:00" of "na 14:00" (zonder toeslag) is nooit een vertrektijd; "vanaf 8:00 tot 12:00" wel de eindtijd
    if (a && type === "out" && !a[4] && !lateFee && /(?:vanaf|na|from|after|ab)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:uur|uhr|u\b|h\b)?\s*$/.test(a[0].replace(/\s*(?:en|tot|-|–|t\/m|und|and)\s*\d.*$/, ""))) a = null;
    // "inchecken en uiterlijk 11.00 uur uitchecken": "uiterlijk" of "voor" hoort niet bij een aankomsttijd
    if (a && type === "in" && /(?:uiterlijk|voor|vóór|before|spätestens)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:uur|uhr|u\b|h\b)?\s*$/.test(a[0].replace(/\s*(?:en|tot|-|–|t\/m|und|and)\s*\d.*$/, ""))) a = null;
    // Staat er vlak vóór het woord al een tijd ("vóór 11.30 uur vrij te maken op de vertrekdag, de lodges vóór 10.00"),
    // dan gaat die voor een tijd die pas verderop in de zin komt
    const lead = text.slice(Math.max(s, i - 50), i);
    const before = type === "out" ? TIME_BEFORE.exec(lead) ?? TIME_BEFORE_TOT.exec(lead) : TIME_BEFORE_IN.exec(lead);
    const beforeIsArrival = type === "out" && ARRIVAL_KEY.test(text.slice(Math.max(s, i - 120), i));
    if (a && before && (before[2] || before[3]) && !beforeIsArrival && a[0].search(/\d/) > 12) a = null;
    if (a && (a[2] || a[3])) {
      // "tussen 9.00 en 11.00": aankomen vanaf het begin, vertrekken uiterlijk aan het eind
      if (type === "out" && a[4] && (a[5] || a[6])) [h, m] = [a[4], a[5]];
      else [h, m] = [a[1], a[2]];
      timeEnd = i + k[0].length + a[0].length;
    } else if (!h) {
      // "uiterlijk 11.00 uur uitchecken", "vanaf 13.00 uur inchecken"
      if (before && (before[2] || before[3])) {
        [h, m] = [before[1], before[2]];
        fromBefore = true;
      }
    }
    if (!h) continue;
    if (timeEnd <= e && (QUESTION.test(text.slice(s, e)) || text[e] === "?")) continue;
    // Verhuur alleen in de aanloop tot en met de tijd en vlak erna ("vertrek voor 10:00 (chalets)"), niet verderop in de
    // zin: "de plaats vóór 11.30 uur vrij te maken op de vertrekdag, de lodges vóór 10.00 uur" gaat over de plaats. Een
    // uitzondering erna ("vertrek voor 12.00 uur (bij safaritenten 11:00)") gaat niet over de kampeerplaats
    // Alleen als er na het verhuurwoord een eigen tijd volgt; "vertrek voor 10:00 bij de chalets" gaat wél over de chalets.
    // (Staat de tijd vóór het woord, dan ook de aanloop daarvan: "voor het jamboreehuis geldt: … tot 11.00 uur op de vertrekdag")
    const tail = text.slice(timeEnd, Math.min(e, timeEnd + 20));
    const aside = /^[^\w(]*\(\s*(?:bij|behalve|uitgezonderd|voor (?:de|het))\b([^0-9]{0,40})\d/.exec(text.slice(timeEnd, Math.min(e, timeEnd + 60)));
    const otherTime = !!aside && RENTAL.test(aside[1]) && !/kampeer|camper|standpla|staanpla/.test(aside[1]);
    if (rentalLast(text.slice(fromBefore ? s : Math.max(s, i - 60), timeEnd)) || (RENTAL.test(tail) && !otherTime)) continue;
    const hour = Number(h);
    // 15:00 alleen als heel uur ("uitchecken 15:00 uur"); later is vrijwel altijd een openingstijd
    const late = type === "out" && hour === 15 && Number(m ?? 0) === 0 && !(a && a[4]) && !/€|euro/.test(text.slice(s, e));
    if (Number(m ?? 0) > 59 || (type === "out" ? hour < 7 || (hour > 14 && !late) : hour < 7 || hour > 22)) continue;
    hits.push({
      type,
      time: asClock(h, m),
      index: i,
      strong: PITCH_CONTEXT.test(local),
      pitch: PITCH_ONLY.test(text.slice(Math.max(s, i - 150), Math.min(e, i + 90))),
      camper: CAMPER.test(local),
      cond:
        CONDITIONAL.test(local) ||
        CONDITIONAL_PRE.test(text.slice(Math.max(s, i - (fromBefore ? 110 : 60)), timeEnd)) ||
        (!lateFee && CONDITIONAL_CLAUSE.test(text.slice(s, e))),
    });
  }

  const pick = (type: "in" | "out") => {
    const firm = hits.filter((x) => x.type === type && !x.cond);
    return firm.find((x) => x.camper) ?? firm.find((x) => x.pitch) ?? firm.find((x) => x.strong) ?? firm[0];
  };
  let out = pick("out");
  // Een aankomsttijd gelijk aan de vertrektijd is meestal dezelfde tijd twee keer gelezen: die laten we weg
  const arrive = ((x) => (x && out && x.time === out.time ? undefined : x))(pick("in"));
  // Geen losse vertrektijd gevonden? Dan een tijd die direct bij de kampeerplek hoort, vlak na een vertrekwoord, ook
  // over een vraag heen ("Hoe laat moet ik uitchecken? Voor kampeerplekken is dat 11:00 uur, voor de glampingtent 10:00")
  if (!out)
    for (const m of text.matchAll(PITCH_OUT)) {
      const before = text.slice(Math.max(0, m.index! - 140), m.index!);
      const lastOut = Math.max(...[...before.matchAll(OUT_WORD)].map((x) => x.index!), -1);
      // Het vertrekwoord mag ook in de zin zelf staan: "Kampeerplaatsen verlaat je voor 12:00 uur"
      const inside = new RegExp(OUT_WORD.source).test(m[0]);
      const tail = lastOut < 0 ? "" : before.slice(lastOut);
      if ((lastOut < 0 && !inside) || ARRIVAL_WORD.test(tail) || EXCEPTION.test(tail + m[0])) continue;
      const hour = Number(m[2]);
      if (hour < 7 || hour > 14 || Number(m[3] ?? 0) > 59) continue;
      const near = text.slice(Math.max(0, m.index! - 60), m.index! + m[0].length + 30);
      if (CONDITIONAL.test(near)) continue;
      out = { type: "out", time: asClock(m[2], m[3]), index: m.index!, strong: true, camper: CAMPER.test(m[1]), cond: false };
      break;
    }

  let free: { index: number; camper: boolean; weak?: boolean } | undefined;
  for (const f of text.matchAll(FREE)) {
    const [s, e] = sentenceBounds(text, f.index!);
    const local = text.slice(Math.max(s, f.index! - 60), Math.min(e, f.index! + 90));
    if (RENTAL.test(local) && !CAMPER.test(local)) continue;
    free = { index: f.index!, camper: CAMPER.test(local) };
    if (free.camper) break;
  }
  if (!free)
    for (const f of text.matchAll(FREE_WEAK)) {
      const near = text.slice(Math.max(0, f.index! - 150), f.index! + 120);
      if (!CAMPER.test(near) || SEASONAL.test(near) || RENTAL.test(near)) continue;
      free = { index: f.index!, camper: true, weak: true };
      break;
    }

  const res: Record<string, unknown> = {};
  const notes: string[] = [];
  let per24: number | undefined;
  for (const p of text.matchAll(PER24)) {
    const [s, e] = sentenceBounds(text, p.index!);
    const near = text.slice(Math.max(s, p.index! - 60), Math.min(e, p.index! + 60));
    if (RENTAL.test(near) || /trailer|helling|boten?\b|sloep/.test(near)) continue;
    per24 = p.index!;
    break;
  }
  if (per24 === undefined)
    for (const p of text.matchAll(PER24_PRICE)) {
      const near = text.slice(Math.max(0, p.index! - 150), p.index! + 120);
      // Een tarief voor de trailerhelling of een boot zegt niets over de camperplaats
      if (!CAMPER.test(near) || RENTAL.test(near) || /trailer|helling|boten?\b|sloep/.test(near)) continue;
      per24 = p.index!;
      break;
    }
  if (per24 !== undefined && !free && !out) {
    res.departure = "per24";
    notes.push(quote(raw, text, per24));
  } else if (free && (!out || (free.camper && !free.weak && !out.camper))) {
    res.departure = "vrij";
    notes.push(quote(raw, text, free.index));
    // Een voorwaardelijke tijd ("bij drukte graag voor 13:00 vertrekken") hoort bij het eerlijke verhaal
    const cond = hits.find((x) => x.type === "out" && x.cond);
    if (cond) notes.push(quote(raw, text, cond.index));
  } else if (out && !free) {
    res.departure = "vast";
    res.checkout_until = out.time;
    notes.push(quote(raw, text, out.index));
  }
  // Tegenstrijdig (wel "geen vertrektijden", maar ook een vaste tijd): niets invullen
  if (arrive && res.departure !== undefined) {
    res.checkin_from = arrive.time;
    const q = quote(raw, text, arrive.index);
    if (!notes.includes(q)) notes.push(q);
  } else if (arrive && !free && !out) {
    res.checkin_from = arrive.time;
    notes.push(quote(raw, text, arrive.index));
  }

  for (const a of text.matchAll(ACCESS24)) {
    const [s, e] = sentenceBounds(text, a.index!);
    const local = text.slice(Math.max(s, a.index! - 60), Math.min(e, a.index! + 60));
    if (ACCESS_NOT.test(local) || (RENTAL.test(local) && !CAMPER.test(local))) continue;
    res.access_24h = true;
    if (!notes.length) notes.push(quote(raw, text, a.index!));
    break;
  }
  for (const g of text.matchAll(GATE)) {
    const [h1, m1, u1, h2, m2, u2] = g[1] !== undefined ? g.slice(1, 7) : g.slice(7, 13);
    if (!(m1 || u1) || !(m2 || u2)) continue;
    const a = Number(h1);
    const b = Number(h2);
    if (a > 12 || b < 17 || b > 24) continue;
    res.access_hours = `${asClock(h1, m1)}–${asClock(h2, m2)}`;
    const q = quote(raw, text, g.index!);
    if (!notes.includes(q)) notes.push(q);
    break;
  }
  if (notes.length) res.times_note = notes.join(" · ").slice(0, 420);
  return res;
}

// ── Extra kosten ───────────────────────────────────────────────────────────
// Prijzen zo transparant mogelijk: naast de nachtprijs ook de losse toeslagen die de site letterlijk noemt
// (toeristenbelasting, stroom, per persoon, hond …). Elk bedrag hoort bij een herkenbare omschrijving en eenheid.

type Extra = { label: string; amount: number; unit?: string };

const EXTRA_KINDS: { label: string; re: RegExp; min: number; max: number }[] = [
  { label: "Toeristenbelasting", re: /toeristen ?belasting|tourist tax|kurtaxe|gemeentelijke heffing/, min: 0.3, max: 6 },
  { label: "Stroom", re: /stroom|elektra|elektriciteit|kwh|strom\b/, min: 0.2, max: 12 },
  { label: "Kind", re: /\bkind(eren)?\b|\bkids?\b|\bjeugd\b|t\/m \d+ jaar|tot \d+ jaar/, min: 0.5, max: 15 },
  { label: "Per persoon", re: /extra (campinggast|gast|persoon|volwassene)|per persoon|p\.?p\.?(p\.?n\.?)?\b|volwassenen?|\bpersonen?\b/, min: 1, max: 25 },
  { label: "Hond", re: /\bhond(en)?\b|huisdier/, min: 0.5, max: 10 },
  { label: "Douche", re: /douche/, min: 0.2, max: 5 },
  { label: "Water", re: /drinkwater|water (tanken|tappen|vullen)|\bwater\b/, min: 0.2, max: 6 },
  { label: "Lozen", re: /lozen|loosplaats|dumpstation|servicestation|afvalwater|chemisch toilet/, min: 0.5, max: 15 },
  { label: "Extra auto", re: /extra auto|\bauto\b|tweede voertuig/, min: 0.5, max: 10 },
];

function extraUnit(after: string): string | undefined {
  const a = after.slice(0, 40);
  if (/^\s*(?:euro\s*)?(?:p\.?p\.?p\.?n\.?|per persoon per nacht|pppn)/.test(a)) return "per persoon per nacht";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*kwh/.test(a)) return "per kWh";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*(?:persoon|pers\.?|p\.?p\.?)/.test(a)) return "per persoon";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*(?:nacht|night|dag|etmaal|24 uur)/.test(a)) return "per nacht";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*(?:keer|beurt|munt|token|lozing)|eenmalig/.test(a)) return "per keer";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*(?:\d+\s*)?(?:liter|l\b)/.test(a)) return /\d+\s*liter/.exec(a) ? `per ${/(\d+)\s*liter/.exec(a)![1]} liter` : "per liter";
  if (/^\s*(?:euro\s*)?(?:per|p\.?|\/)\s*(?:week|maand|jaar|seizoen)/.test(a)) return "skip";
  return undefined;
}

export function priceExtras(text: string): Extra[] {
  const out: Extra[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/€\s?(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*,-)?|(\d{1,3}[.,]\d{2})\s*(?:euro|eur)\b/g)) {
    const amount = money(m[1] ?? m[2]);
    if (!Number.isFinite(amount)) continue;
    const i = m.index!;
    // Omschrijving: het stuk zin vlak vóór het bedrag (tarieventabel: "Hond | € 2,00")
    const before = text.slice(Math.max(0, i - 45), i);
    // Grens: einde van een tabelrij of alinea (" . "), een vorig bedrag of een echte zin; niet "incl." of "ca."
    const sentenceEnd = [...before.matchAll(/([a-z\u00e0-\u00ff]{4,})\.\s/g)]
      .filter((x) => !/^(incl|excl|inkl|exkl|bijv|resp|ongeveer|max|min)$/.test(x[1]))
      .pop();
    const cut = Math.max(before.lastIndexOf(" . ") + 2, before.lastIndexOf("€"), sentenceEnd ? sentenceEnd.index! + sentenceEnd[0].length - 1 : -1);
    const label = before.slice(cut + 1);
    if (/\b(chalets?|accommodaties?|stacaravans?|bungalows?|lodges?|huur|verhuur|arrangement|borg|annulering|reservering|week|maand|seizoen|jaarplaats|ontbijt|fiets|kano|sup|wasmachine|droger)\b/.test(label)) continue;
    // Het basistarief voor de plek zelf ("kampeerplaats incl. 2 personen € 24,50") is geen toeslag
    if (/kampeerplaats|camperplaats|camperplek|standplaats|staanplaats|plaats incl|plek incl|\bcamper\b|caravan|\btent\b|stellplatz|overnachting/.test(label) && !/extra|toeslag/.test(label)) continue;
    // Eenheid na het bedrag ("€ 5 per nacht") of ervoor ("per nacht € 5")
    let unit = extraUnit(text.slice(i + m[0].length));
    if (!unit) {
      if (/p\.?p\.?p\.?n\.?|per persoon per nacht/.test(label)) unit = "per persoon per nacht";
      else if (/per kwh/.test(label)) unit = "per kWh";
      else if (/per (nacht|dag|etmaal)/.test(label)) unit = "per nacht";
      else if (/per (keer|beurt)/.test(label)) unit = "per keer";
    }
    if (unit === "skip") continue;
    const kind = EXTRA_KINDS.find((k) => k.re.test(label)) ?? (unit?.startsWith("per persoon") ? EXTRA_KINDS.find((k) => k.label === "Per persoon") : undefined);
    if (!kind || seen.has(kind.label)) continue;
    if (amount < kind.min || amount > kind.max) continue;
    // Toeristenbelasting en "per persoon" zonder eenheid zijn vrijwel altijd per persoon per nacht, maar dat zeggen
    // we alleen als het er staat; anders tonen we het bedrag zonder eenheid.
    out.push({ label: kind.label, amount, ...(unit ? { unit } : {}) });
    seen.add(kind.label);
    if (out.length >= 8) break;
  }
  const order = EXTRA_KINDS.map((k) => k.label);
  return out.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
}
