/**
 * Websitefoto's netjes maken: veel sites geven ons een miniatuur (WordPress "-300x200.jpg", Wix "w_288,blur_2",
 * "?width=576"), een keurmerk of een vlaggetje. Hier vragen we bij bekende beeldbanken de grote versie op, gooien we
 * plaatjes weg die geen foto van de plek zijn, en zetten we de beste foto vooraan. Werkt alleen op de URL; wat dan
 * nog te klein blijkt, valt in de browser alsnog af (zie PlacePhoto).
 *
 * Dit bestand heeft bewust geen imports: de scraper (supabase/functions/pipeline/extract.ts, Deno) gebruikt het ook.
 */

/** Breedte die we vragen bij beeldbanken die op maat schalen: scherp op een telefoon met 3× pixels */
const TARGET = 1600;

/**
 * Plaatjes die nooit een foto van de plek zijn: keurmerken en logo's van anderen (SVR, ANWB, Zoover), vlaggen,
 * knoppen, opvulling. Een eigen logo mag wel; dat zetten we achteraan en tonen we passend (looksLikeGraphic).
 */
const NOT_THE_PLACE =
  /embleem|emblem|keurmerk|svr[._-]?\d*\.|svr_|\/svr\.|anwb|acsi|zoover|tripadvisor|campercontact|park4night|booking[._-]?com|google|facebook|instagram|whatsapp|youtube|fietserswelkom|fietsers-welkom|wandelaarswelkom|groene[._-]?sleutel|green[._-]?key|award|sterren|stars?\b|rating|\breviews?\b|drapeaux|\bflags?\b|\bvlag(?:gen|getje)?\b|dummy|placeholder|spacer|blank\.|pixel|loader|loading|icon|sprite|button|knop|banner-ad|polaroid|qr[._-]|tumbnail|thumbnail-video|video-thumb|play[._-]?button|signature|handtekening|mascotte|cropped-favicon|sticker/i;

/** Kies per beeldbank de grootste versie die de URL toelaat */
export function upgradePhotoUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const host = url.hostname;

  // Wix: /v1/fill/w_288,h_162,…,blur_2,…/naam → passend binnen 1600 × 1600, zonder vervaging
  if (host === "static.wixstatic.com") {
    const m = /^(\/media\/[^/]+)\/v1\/(?:fill|fit|crop)\/[^/]+\/([^/]+)$/.exec(url.pathname);
    if (m) url.pathname = `${m[1]}/v1/fit/w_${TARGET},h_${TARGET},q_85/${m[2]}`;
    return url.href;
  }

  // WordPress en Jetpack: "-1024x683.jpg" is een verkleining; zonder achtervoegsel staat het origineel
  if (/\/wp-content\/uploads\//.test(url.pathname)) {
    url.pathname = url.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)$)/i, "");
  }
  if (/^i\d\.wp\.com$/.test(host)) {
    for (const k of ["resize", "fit", "w", "h", "crop"]) url.searchParams.delete(k);
    url.searchParams.set("w", String(TARGET));
    return url.href;
  }

  // Jimdo: transf/dimension=107x10000:format=png → 1600 breed
  if (host === "image.jimcdn.com") {
    url.pathname = url.pathname.replace(/dimension=\d+x(\d+)/, `dimension=${TARGET}x$1`);
    return url.href;
  }

  // Duda: naam-640w.jpg → naam-1920w.jpg (Duda maakt standaard een 1920-versie)
  if (host === "irp.cdn-website.com") {
    url.pathname = url.pathname.replace(/-(\d{2,4})w(\.[a-z]+)$/i, (all, w: string, ext: string) => (Number(w) < 1280 ? `-1920w${ext}` : all));
    return url.href;
  }

  // Beeldbanken met ?width=…&height=… (bijv. CloudFront, Umbraco, ImageProcessor): zelfde verhouding, groter
  for (const [wKey, hKey] of [
    ["width", "height"],
    ["w", "h"],
  ] as const) {
    const w = Number(url.searchParams.get(wKey));
    if (w > 0 && w < 1000) {
      const h = Number(url.searchParams.get(hKey));
      url.searchParams.set(wKey, String(TARGET));
      if (h > 0) url.searchParams.set(hKey, String(Math.round((h * TARGET) / w)));
      // "rnd" en dergelijke laten we staan; alleen de maat verandert
    }
  }
  return url.href;
}

/** Breedte die de URL zelf noemt (na het opwaarderen), of undefined als we het niet weten */
function statedWidth(url: string): number | undefined {
  const patterns = [
    /\/w_(\d+),/, // Wix
    /-(\d{2,4})x\d{2,4}\.(?:jpe?g|png|webp)/i, // WordPress-achtig
    /[?&](?:width|w)=(\d+)/, // querystring
    /\/_(\d+)x(?:\d+|AUTO)_/i, // Craft CMS
    /dimension=(\d+)x/, // Jimdo
    /-(\d{3,4})w\.[a-z]+$/i, // Duda
    /_(?:jpg|jpeg|png)_(\d+)_\d+\./i, // "__thumbnails/naam_jpg_480_143.jpg"
    /\/B(\d+)X\d+\//i, // touristserver
  ];
  for (const re of patterns) {
    const m = re.exec(url);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Waarschijnlijk een tekening, logo of tekstplaatje: tonen we passend in het vak, niet bijgesneden */
export function looksLikeGraphic(url: string): boolean {
  return /\.(png|gif|svg)(?:$|[?/])|format=png|~mv2\.png/i.test(url) || /logo|embleem/i.test(url);
}

/**
 * Score voor de volgorde: echte, grote foto's vooraan, plaatjes die op een tekening of logo lijken achteraan.
 * null = geen foto van de plek of zeker te klein: niet tonen.
 */
export function photoScore(url: string, original = url): number | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  if (NOT_THE_PLACE.test(path)) return null;
  // Video's en beelden van keurmerken, boekingssites en sociale media (svr.nl/px/ok.jpg, Facebook-cdn) zijn geen foto van de plek
  if (/\.(webm|mp4|mov|m4v|ogv|avi)$/i.test(path)) return null;
  if (/(^|\.)(svr\.nl|anwb\.nl|acsi\.(eu|nl|com)|zoover\.(nl|com|be)|campercontact\.com|park4night\.com|tripadvisor\.[a-z.]+|booking\.com|google\.[a-z.]+|googleusercontent\.com|facebook\.com|fbcdn\.net|instagram\.com)$/i.test(new URL(url).hostname)) return null;
  // Bestand dat alleen "svr" heet (met een maat of kwaliteit erachter) is het SVR-logo
  if (/\/svr(?:[-_.](?:high|low|small|large|klein|groot|\d+))?\.[a-z]+$/i.test(path)) return null;
  // Opmaak van het WordPress-thema of een plug-in (knoppen, prijsbolletjes, sliders) is nooit een foto van de plek
  if (/\/wp-content\/(?:themes|plugins)\//i.test(path)) return null;
  // Formaten die een browser niet toont
  if (/\.(heic|heif|tiff?|bmp|psd)$/i.test(path)) return null;
  // Wix-stockfoto's (account 11062b, Unsplash-koppeling of zonder eigen account) zijn geen foto van de plek
  if (/wixstatic\.com/.test(url) && /^\/media\/(?:11062b_|nsplsh_|[0-9a-f]{32}\.)/.test(path)) return null;
  // Een piepklein plaatje (icoontje van 17 × 22) is geen foto. WordPress en Jimdo bewaren altijd het origineel,
  // daar is een kleine maat alleen een verkleining.
  const before = statedWidth(original);
  if (before !== undefined && before < 50 && !/\/wp-content\/uploads\/|jimcdn\.com/.test(original)) return null;
  const w = statedWidth(url);
  if (w !== undefined && w < 400) return null;
  let score = 0;
  if (w === undefined) score += 1;
  else if (w >= 1200) score += 3;
  else if (w >= 800) score += 2;
  if (looksLikeGraphic(url)) score -= 3;
  if (/sfeer|drone|luchtfoto|camper|plaats|kampeer|veld|terrein|uitzicht|overzicht|weide|boomgaard|haven/i.test(path)) score += 1;
  if (/sanitair|toilet|douche|receptie|speeltuin|zwembad|restaurant|horeca|kantine|menu|kaart|plattegrond|route|team|eigenaar|familie|gezin/i.test(path)) score -= 1;
  return score;
}

/**
 * Gefilterd en gesorteerd: beste foto vooraan, bij gelijke score de volgorde van de site. De URL's blijven de
 * originele; PlacePhoto vraagt de grote versie op en valt bij een fout terug op het origineel.
 */
export function rankPhotos<P extends { url: string }>(photos: P[]): P[] {
  const seen = new Set<string>();
  return photos
    .map((p, i) => ({ p, i, score: photoScore(upgradePhotoUrl(p.url), p.url) }))
    .filter((x): x is { p: P; i: number; score: number } => {
      if (x.score === null || seen.has(x.p.url)) return false;
      seen.add(x.p.url);
      return true;
    })
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.p);
}
