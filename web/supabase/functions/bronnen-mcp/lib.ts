// Pure hulpfuncties voor de MCP-server `bronnen-mcp` (dataplan W0.6). Geen Deno- of netwerk-API's, zodat
// `node --test` ze kan testen (web/tests/bronnen-mcp.test.ts).

export const UA = "VrijStaanBot/1.0 (+https://vrijstaan.nl/bot; camperplaatsengids)";

/** Mag de server dit adres ophalen? Alleen http(s) naar een openbare hostnaam: geen IP-adressen, geen interne namen. */
export function publicUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  if (u.port && !["80", "443"].includes(u.port)) return null;
  const h = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h)) return null; // ook: geen IPv4/IPv6-adressen, geen namen zonder punt
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|supabase\.co|supabase\.in)$/.test(h)) return null;
  return u;
}

/** Privé-, loopback-, link-local-, CGNAT- of gereserveerd adres? Dan halen we niets op (DNS kan naar binnen wijzen). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const m = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (!v.includes(":")) return true; // geen geldig adres: niet vertrouwen
  return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith("64:ff9b:") ||
    v.startsWith("2001:db8:");
}

type Rule = { allow: boolean; path: string };

/**
 * Regels uit robots.txt voor onze bot (RFC 9309): de groep die "vrijstaan" noemt gaat voor, anders "*".
 * Een groep kan meerdere User-agent-regels hebben.
 */
export function parseRobots(text: string, agent = "vrijstaan"): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
    } else if ((k === "allow" || k === "disallow") && cur) {
      if (v) cur.rules.push({ allow: k === "allow", path: v });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  const own = groups.filter((g) => g.agents.some((a) => a.includes(agent)));
  const chosen = own.length ? own : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

function ruleMatches(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const body = anchored ? rule.slice(0, -1) : rule;
  const re = new RegExp("^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return re.test(path);
}

/** Langste overeenkomende regel wint; bij gelijke lengte gaat Allow voor. Geen regel = toegestaan. */
export function robotsAllows(rules: Rule[], pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, pathAndQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

/** Is de hele site voor ons dicht? ("Disallow: /" zonder Allow-uitzonderingen) */
export function robotsBlocksAll(rules: Rule[]): boolean {
  return rules.some((r) => !r.allow && r.path === "/") && !rules.some((r) => r.allow && r.path !== "/");
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€", eacute: "é", egrave: "è", euml: "ë",
  iuml: "ï", ouml: "ö", uuml: "ü", aacute: "á", agrave: "à", ccedil: "ç", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", deg: "°", middot: "·", times: "×",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML naar leesbare platte tekst: blokken op eigen regels, tabelcellen met " | ", geen scripts of menu-ruis. */
/** Blokken als <script>…</script> weghalen in één keer door de tekst (geen regex die terugloopt op grote pagina's). */
export function stripBlocks(html: string, tags: string[]): string {
  const low = html.toLowerCase();
  // Eerstvolgende echte opening van `t` vanaf `from` ("<head" telt niet in "<header").
  const find = (t: string, from: number) => {
    let j = low.indexOf("<" + t, from);
    while (j >= 0 && t !== "!--" && /[a-z0-9-]/.test(low[j + t.length + 1] ?? "")) j = low.indexOf("<" + t, j + 1);
    return j;
  };
  const pos = new Map(tags.map((t) => [t, find(t, 0)]));
  let out = "";
  let i = 0;
  while (i < html.length) {
    let next = -1;
    let tag = "";
    for (const t of tags) {
      let j = pos.get(t)!;
      if (j >= 0 && j < i) {
        j = find(t, i);
        pos.set(t, j);
      }
      if (j >= 0 && (next < 0 || j < next)) {
        next = j;
        tag = t;
      }
    }
    if (next < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, next) + " ";
    const end = tag === "!--" ? low.indexOf("-->", next + 4) : low.indexOf("</" + tag, next);
    if (end < 0) break; // niet gesloten: de rest weggooien
    const close = low.indexOf(">", end);
    i = close < 0 ? html.length : close + 1;
  }
  return out;
}

export function htmlToText(html: string): string {
  let s = stripBlocks(html, ["!--", "script", "style", "noscript", "svg", "template", "iframe", "head"])
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/?(p|div|li|ul|ol|tr|table|h[1-6]|section|article|header|footer|nav|aside|main|dt|dd|dl|blockquote|pre|form|fieldset|figure|figcaption|summary|details)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").replace(/\s*\|\s*$/, "").trim())
    .filter((l) => l.length > 0 && l !== "|")
    .filter((l, i, all) => i === 0 || l !== all[i - 1])
    .join("\n");
}

/** Alleen de regels met een van de woorden, met `ctx` regels eromheen; "…" tussen losse stukken. */
export function filterLines(text: string, words: string[], ctx = 1): string {
  const ws = words.map((w) => w.toLowerCase().trim()).filter(Boolean);
  if (!ws.length) return text;
  const lines = text.split("\n");
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    const low = l.toLowerCase();
    if (ws.some((w) => low.includes(w))) for (let j = i - ctx; j <= i + ctx; j++) if (j >= 0 && j < lines.length) keep.add(j);
  });
  const out: string[] = [];
  let prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i > prev + 1 && out.length) out.push("…");
    out.push(lines[i]);
    prev = i;
  }
  return out.join("\n");
}

/** Vergelijken in constante tijd (sleutel van de MCP-server). */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Zoekterm veilig voor een PostgREST-filter: geen komma's, haakjes, procenttekens of sterretjes. */
export function cleanSearch(q: string): string {
  return q.replace(/[,()%*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Afstand in meters (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

/** Velden die `plekken_zoeken` als "ontbreekt" mag filteren (komen overeen met bron.check_value). */
export const FIELDS = [
  "departure", "checkout_until", "checkin_from", "access_hours", "max_stay_nights", "capacity", "price_eur",
  "max_length_m", "power", "water", "dump_station", "toilet", "shower", "wifi", "dogs", "open_all_year",
  "reservation", "access_24h", "tourist_tax_included", "season", "phone", "website",
] as const;
