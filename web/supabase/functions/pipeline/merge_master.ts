// Geo-merge: meerdere gestandaardiseerde lijsten (tools/data-collectors) ontdubbelen tot één masterlijst, en die in
// stukken van 500 in `geo_master` zetten.
//
// Invoer per plek: { naam, lat, lon, bron_id, faciliteiten } (zie tools/data-collectors/parse_statics.py).
//
// Algoritme (puur, zonder database, zodat het te testen is):
//   1. Lijsten in volgorde van voorrang: de eerste lijst wint bij naam en coördinaten.
//   2. Elk eerste record van een groep is het anker. Een nieuw record wordt alleen met ankers vergeleken (niet met elk
//      lid), zodat er geen ketting ontstaat (A ~ B ~ C terwijl A en C 190 m uit elkaar liggen).
//   3. Kandidaten: ankers binnen MATCH_RADIUS_M (haversine), opgezocht via een raster van cellen van ±100 m.
//   4. Score = 0,8 × naamgelijkenis (Levenshtein, ook op gesorteerde woorden en woordverzamelingen) + 0,2 × nabijheid.
//      Zonder naam aan één kant telt alleen de nabijheid: bij de standaarddrempel 0,75 is dat binnen 25 m.
//   5. Het beste anker boven de drempel krijgt het record; anders begint het een nieuwe groep.
//
// Samenvoegen (nooit verzinnen, docs/specs/README.md): naam en coördinaten van het anker (geen gemiddelde: dat is een
// punt dat geen bron noemt), alle namen in `namen`, alle bron_ids, en per faciliteit alleen een waarde als alle bronnen
// die hem noemen het eens zijn. Spreken ze elkaar tegen, dan blijft de faciliteit leeg en staat het in `conflicten`.

export const MATCH_RADIUS_M = 100;
export const MIN_SCORE = 0.75;
export const NAME_WEIGHT = 0.8;
export const CHUNK_SIZE = 500;
export const GEOHASH_PRECISION = 9; // ±4,8 m × 4,8 m

export type Bronrecord = {
  naam: string | null;
  lat: number;
  lon: number;
  bron_id: string;
  faciliteiten: Record<string, unknown>;
};

export type Conflict = { bron_id: string; waarde: unknown };

export type MasterRecord = {
  master_id: string;
  geohash: string;
  naam: string | null;
  namen: string[];
  lat: number;
  lon: number;
  bron_ids: string[];
  faciliteiten: Record<string, unknown>;
  conflicten: Record<string, Conflict[]>;
  /** Laagste score waarmee een lid aan het anker is gekoppeld (1 bij één bron) */
  match_score: number;
};

export type MergeOptions = { radiusM?: number; minScore?: number; nameWeight?: number };

// ── Afstand en geohash ───────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Afstand over de aardbol in meters (haversine) */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Standaard geohash (Niemeyer), zoals PostGIS ST_GeoHash */
export function geohash(lat: number, lon: number, precision = GEOHASH_PRECISION): string {
  let [latLo, latHi, lonLo, lonHi] = [-90, 90, -180, 180];
  let out = "";
  let bits = 0;
  let ch = 0;
  let even = true;
  while (out.length < precision) {
    // Even bits: lengtegraad, oneven: breedtegraad; 1 = bovenste helft
    if (even) {
      const mid = (lonLo + lonHi) / 2;
      const up = lon >= mid;
      ch = (ch << 1) | Number(up);
      if (up) lonLo = mid;
      else lonHi = mid;
    } else {
      const mid = (latLo + latHi) / 2;
      const up = lat >= mid;
      ch = (ch << 1) | Number(up);
      if (up) latLo = mid;
      else latHi = mid;
    }
    even = !even;
    if (++bits === 5) {
      out += BASE32[ch];
      bits = 0;
      ch = 0;
    }
  }
  return out;
}

// ── Namen ────────────────────────────────────────────────────────────────────

// Woorden die zeggen wát het is, niet wélke plek: "Camperplaats De Hoeve" en "De Hoeve" zijn dezelfde
const GENERIC = new Set([
  "camperplaats", "camperplaatsen", "camperpark", "camperparkeerplaats", "campervoorziening", "camperstandplaats",
  "camperhaven", "camping", "minicamping", "kampeerterrein", "boerderijcamping", "natuurcamping", "parking",
  "parkeerplaats", "jachthaven", "passantenhaven", "stellplatz", "wohnmobilstellplatz", "reisemobilstellplatz",
  "campingplatz", "aire", "motorhome", "camper", "campers", "vakantiepark", "recreatiepark",
]);

/** Kleine letters, zonder accenten en leestekens, zonder soortwoorden. Alleen soortwoorden → die houden we. */
export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(/['’`]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const specific = words.filter((w) => !GENERIC.has(w));
  return (specific.length ? specific : words).join(" ");
}

/** Levenshtein-afstand (twee rijen geheugen) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** 1 = gelijk, 0 = niets gemeen */
export function ratio(a: string, b: string): number {
  const len = Math.max(a.length, b.length);
  return len === 0 ? 1 : 1 - levenshtein(a, b) / len;
}

/**
 * Naamgelijkenis 0–1 na normaliseren. Het hoogste van: hele naam, gesorteerde woorden ("Hoeve De" = "De Hoeve") en
 * woordverzameling (gedeelde woorden plus de rest, zoals token_set_ratio: "De Hoeve" ≈ "De Hoeve Lochem").
 * Null als een van beide geen naam heeft: dan weten we het niet.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number | null {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return null;
  if (na === nb) return 1;
  const ta = [...new Set(na.split(" "))].sort();
  const tb = [...new Set(nb.split(" "))].sort();
  let best = Math.max(ratio(na, nb), ratio(ta.join(" "), tb.join(" ")));
  const setB = new Set(tb);
  const common = ta.filter((t) => setB.has(t));
  if (common.length) {
    const c = common.join(" ");
    const ra = [c, ...ta.filter((t) => !setB.has(t))].join(" ");
    const rb = [c, ...tb.filter((t) => !common.includes(t))].join(" ");
    // Alleen gedeelde woorden die samen iets zeggen (≥ 4 tekens): "de" alleen mag geen match maken
    if (c.replace(/ /g, "").length >= 4) best = Math.max(best, ratio(c, ra), ratio(c, rb), ratio(ra, rb));
  }
  return best;
}

// ── Score ────────────────────────────────────────────────────────────────────

export type Match = { distanceM: number; nameSim: number | null; score: number };

/** Score van b tegen anker a; null buiten de straal */
export function matchScore(a: Bronrecord, b: Bronrecord, opts: MergeOptions = {}): Match | null {
  const radius = opts.radiusM ?? MATCH_RADIUS_M;
  const weight = opts.nameWeight ?? NAME_WEIGHT;
  const distanceM = haversineM(a.lat, a.lon, b.lat, b.lon);
  if (distanceM > radius) return null;
  const proximity = 1 - distanceM / radius;
  const nameSim = nameSimilarity(a.naam, b.naam);
  const score = nameSim === null ? proximity : weight * nameSim + (1 - weight) * proximity;
  return { distanceM, nameSim, score };
}

// ── Invoer controleren ───────────────────────────────────────────────────────

/** Een record uit een lijst, of null als het niet bruikbaar is (geen id, geen geldige coördinaten) */
export function toBronrecord(x: unknown): Bronrecord | null {
  if (!x || typeof x !== "object") return null;
  const r = x as Record<string, unknown>;
  const lat = Number(r.lat);
  const lon = Number(r.lon ?? r.lng);
  const id = typeof r.bron_id === "string" ? r.bron_id.trim() : "";
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const naam = typeof r.naam === "string" && r.naam.trim() ? r.naam.trim() : null;
  const fac = r.faciliteiten && typeof r.faciliteiten === "object" && !Array.isArray(r.faciliteiten)
    ? Object.fromEntries(Object.entries(r.faciliteiten as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== ""))
    : {};
  return { naam, lat, lon, bron_id: id, faciliteiten: fac };
}

// ── Raster voor kandidaten ───────────────────────────────────────────────────

const M_PER_DEG_LAT = 111_320;

/**
 * Cellen van ±radius: een rij per breedte-band, en binnen een band lengtegraden geschaald met de cosinus van die
 * band. Opzoeken in de eigen band en de twee buren, telkens ±1 cel, vindt elk anker binnen de straal. (De datumgrens
 * op 180° wordt niet overbrugd; voor Europese data niet nodig.)
 */
class AnchorGrid<T extends { lat: number; lon: number }> {
  private cells = new Map<string, T[]>();
  private step: number;

  constructor(radiusM: number) {
    this.step = (radiusM * 1.01) / M_PER_DEG_LAT; // iets ruimer tegen afronding
  }

  private band(lat: number) {
    return Math.floor(lat / this.step);
  }

  private col(lon: number, band: number) {
    const cos = Math.max(0.01, Math.cos(rad((band + 0.5) * this.step)));
    return Math.floor((lon * cos) / this.step);
  }

  add(item: T) {
    const b = this.band(item.lat);
    const key = `${b}:${this.col(item.lon, b)}`;
    const list = this.cells.get(key);
    if (list) list.push(item);
    else this.cells.set(key, [item]);
  }

  *near(lat: number, lon: number): Generator<T> {
    const b0 = this.band(lat);
    for (let b = b0 - 1; b <= b0 + 1; b++) {
      const c0 = this.col(lon, b);
      for (let c = c0 - 1; c <= c0 + 1; c++) yield* this.cells.get(`${b}:${c}`) ?? [];
    }
  }
}

// ── Samenvoegen ──────────────────────────────────────────────────────────────

type Group = { anchor: Bronrecord; lat: number; lon: number; members: Bronrecord[]; minScore: number };

/** Groepen vormen: lijsten in volgorde van voorrang, records in volgorde binnen de lijst */
export function clusterRecords(lists: Bronrecord[][], opts: MergeOptions = {}): Group[] {
  const radius = opts.radiusM ?? MATCH_RADIUS_M;
  const minScore = opts.minScore ?? MIN_SCORE;
  const grid = new AnchorGrid<Group>(radius);
  const groups: Group[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const rec of list) {
      // Hetzelfde bron_id twee keer (bv. dezelfde lijst twee keer aangeleverd): de eerste telt
      if (seen.has(rec.bron_id)) continue;
      seen.add(rec.bron_id);

      let best: { group: Group; score: number } | null = null;
      for (const g of grid.near(rec.lat, rec.lon)) {
        const m = matchScore(g.anchor, rec, opts);
        if (m && m.score >= minScore && (!best || m.score > best.score)) best = { group: g, score: m.score };
      }
      if (best) {
        best.group.members.push(rec);
        best.group.minScore = Math.min(best.group.minScore, best.score);
      } else {
        const g: Group = { anchor: rec, lat: rec.lat, lon: rec.lon, members: [rec], minScore: 1 };
        groups.push(g);
        grid.add(g);
      }
    }
  }
  return groups;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Faciliteiten samenvoegen: een waarde alleen als alle bronnen die hem noemen het eens zijn */
export function mergeFacilities(members: Bronrecord[]): { faciliteiten: Record<string, unknown>; conflicten: Record<string, Conflict[]> } {
  const byKey = new Map<string, Conflict[]>();
  for (const m of members) {
    for (const [k, v] of Object.entries(m.faciliteiten)) {
      if (v === null || v === undefined || v === "") continue;
      const list = byKey.get(k) ?? [];
      list.push({ bron_id: m.bron_id, waarde: v });
      byKey.set(k, list);
    }
  }
  const faciliteiten: Record<string, unknown> = {};
  const conflicten: Record<string, Conflict[]> = {};
  for (const [k, list] of byKey) {
    if (list.every((c) => same(c.waarde, list[0].waarde))) faciliteiten[k] = list[0].waarde;
    else conflicten[k] = list;
  }
  return { faciliteiten, conflicten };
}

export function toMaster(g: Group): MasterRecord {
  const namen = [...new Set(g.members.map((m) => m.naam).filter((n): n is string => !!n))];
  const { faciliteiten, conflicten } = mergeFacilities(g.members);
  return {
    master_id: g.anchor.bron_id,
    geohash: geohash(g.lat, g.lon),
    naam: namen[0] ?? null,
    namen,
    lat: g.lat,
    lon: g.lon,
    bron_ids: g.members.map((m) => m.bron_id),
    faciliteiten,
    conflicten,
    match_score: Math.round(g.minScore * 1000) / 1000,
  };
}

/** Lijsten (ruwe JSON) → masterlijst, plus wat er is overgeslagen */
export function mergeLists(rawLists: unknown[][], opts: MergeOptions = {}): { records: MasterRecord[]; skipped: number } {
  let skipped = 0;
  const lists = rawLists.map((list) =>
    list.flatMap((x) => {
      const r = toBronrecord(x);
      if (!r) skipped++;
      return r ? [r] : [];
    }),
  );
  return { records: clusterRecords(lists, opts).map(toMaster), skipped };
}

// ── Vaste master_id over runs heen ───────────────────────────────────────────

/**
 * Een master_id is het bron_id van het anker. Komt er in een latere run een lijst met meer voorrang bij, dan zou het
 * anker (en dus het id) wisselen en ontstaat een dubbele rij. Daarom: bestond een van de bron_ids al in een master, dan
 * houdt de nieuwe groep dat id (het id met de meeste gedeelde bron_ids; elk oud id hoogstens één keer).
 * Oude masters die niet meer terugkomen, staan in `stale`: hun bron_ids zitten nu in een andere groep.
 */
export function reuseIds(records: MasterRecord[], existing: { master_id: string; bron_ids: string[] }[]): { records: MasterRecord[]; stale: string[] } {
  const owner = new Map<string, string>();
  for (const e of existing) for (const id of e.bron_ids) owner.set(id, e.master_id);

  // Ronde 1: per groep de oude ids met het aantal gedeelde bron_ids; de sterkste koppelingen eerst
  const wishes: { i: number; id: string; n: number }[] = [];
  records.forEach((r, i) => {
    const counts = new Map<string, number>();
    for (const b of r.bron_ids) {
      const m = owner.get(b);
      if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
    }
    for (const [id, n] of counts) wishes.push({ i, id, n });
  });
  // Gelijkspel: eigen anker-id eerst, dan alfabetisch, zodat dezelfde invoer dezelfde uitkomst geeft
  wishes.sort((a, b) => b.n - a.n || Number(b.id === records[b.i].master_id) - Number(a.id === records[a.i].master_id) || a.id.localeCompare(b.id) || a.i - b.i);
  const assigned = new Array<string | undefined>(records.length);
  const taken = new Set<string>();
  for (const w of wishes) {
    if (assigned[w.i] !== undefined || taken.has(w.id)) continue;
    assigned[w.i] = w.id;
    taken.add(w.id);
  }

  // Ronde 2: nieuwe groepen krijgen het eerste bron_id (anker eerst) dat nog vrij is
  const out = records.map((r, i) => {
    let id = assigned[i];
    if (id === undefined) {
      id = r.bron_ids.find((b) => !taken.has(b));
      for (let n = 2; id === undefined; n++) if (!taken.has(`${r.master_id}#${n}`)) id = `${r.master_id}#${n}`;
      taken.add(id);
    }
    return id === r.master_id ? r : { ...r, master_id: id };
  });
  const stale = [...new Set(existing.map((e) => e.master_id))].filter((id) => !taken.has(id));
  return { records: out, stale };
}

// ── Database ─────────────────────────────────────────────────────────────────

export function chunk<T>(items: T[], size = CHUNK_SIZE): T[][] {
  if (size < 1) throw new Error("chunk: size ≥ 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type DbResult<T = unknown> = PromiseLike<{ data: T | null; error: { message: string } | null }>;

/** Het deel van de Supabase-client dat we gebruiken (zo kan een test een nep-client geven) */
export type MasterDb = {
  from(table: string): {
    select(cols: string): { overlaps(col: string, values: string[]): DbResult<{ master_id: string; bron_ids: string[] }[]> };
    upsert(rows: object[], opts: { onConflict: string; ignoreDuplicates?: boolean }): DbResult;
    delete(): { in(col: string, values: string[]): DbResult };
  };
};

export const MASTER_TABLE = "geo_master";
// bron_ids per opzoekvraag: de lijst gaat in de URL (PostgREST), dus klein houden
const LOOKUP_SIZE = 150;

/** Bestaande masters die een van deze bron_ids bevatten */
export async function existingMasters(db: MasterDb, bronIds: string[], table = MASTER_TABLE) {
  const found = new Map<string, { master_id: string; bron_ids: string[] }>();
  for (const part of chunk(bronIds, LOOKUP_SIZE)) {
    const { data, error } = await db.from(table).select("master_id,bron_ids").overlaps("bron_ids", part);
    if (error) throw new Error(`${table} opzoeken: ${error.message}`);
    for (const row of data ?? []) found.set(row.master_id, row);
  }
  return [...found.values()];
}

export type UpsertReport = { upserted: number; chunks: number; removed: number; failed: { chunk: number; error: string }[] };

/**
 * Upsert in stukken van `chunkSize` op master_id. Een mislukt stuk stopt de rest niet (staat in `failed`); oude
 * masters worden alleen opgeruimd als alle stukken gelukt zijn, zodat een halve run niets kwijtraakt.
 */
export async function upsertMaster(
  db: MasterDb,
  records: MasterRecord[],
  { table = MASTER_TABLE, chunkSize = CHUNK_SIZE, stale = [] as string[] } = {},
): Promise<UpsertReport> {
  const report: UpsertReport = { upserted: 0, chunks: 0, removed: 0, failed: [] };
  const now = new Date().toISOString();
  for (const [i, part] of chunk(records, chunkSize).entries()) {
    report.chunks++;
    const { error } = await db.from(table).upsert(part.map((r) => ({ ...r, bijgewerkt_op: now })), { onConflict: "master_id" });
    if (error) report.failed.push({ chunk: i, error: error.message });
    else report.upserted += part.length;
  }
  if (!report.failed.length) {
    for (const part of chunk(stale, chunkSize)) {
      const { error } = await db.from(table).delete().in("master_id", part);
      if (error) report.failed.push({ chunk: -1, error: `opruimen: ${error.message}` });
      else report.removed += part.length;
    }
  }
  return report;
}

/**
 * Alles achter elkaar: samenvoegen, ids van eerdere runs houden, wegschrijven. Geef bij elke run álle lijsten mee:
 * een bron_id dat ontbreekt, blijft in zijn oude master staan.
 */
export async function runMergeMaster(db: MasterDb, rawLists: unknown[][], opts: MergeOptions & { dryRun?: boolean } = {}) {
  const { records, skipped } = mergeLists(rawLists, opts);
  const existing = await existingMasters(db, records.flatMap((r) => r.bron_ids));
  const reused = reuseIds(records, existing);
  const sources = rawLists.reduce((n, l) => n + l.length, 0);
  const summary = { sources, skipped, masters: reused.records.length, merged: reused.records.filter((r) => r.bron_ids.length > 1).length, conflicts: reused.records.filter((r) => Object.keys(r.conflicten).length).length, stale: reused.stale.length };
  if (opts.dryRun) return { ...summary, dryRun: true, sample: reused.records.filter((r) => r.bron_ids.length > 1).slice(0, 20) };
  return { ...summary, ...(await upsertMaster(db, reused.records, { stale: reused.stale })) };
}
