// Database via psql en SUPABASE_DB_URL (zelfde geheim als back-up en pipeline). Gegevens gaan als JSON in één
// dollar-quoted literal met een willekeurige tag, zodat er niets te escapen valt.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const url = () => {
  const u = process.env.SUPABASE_DB_URL;
  if (!u) throw new Error("SUPABASE_DB_URL ontbreekt");
  return u;
};

export function json(value: unknown): string {
  const text = JSON.stringify(value);
  let tag = `j${randomBytes(6).toString("hex")}`;
  while (text.includes(`$${tag}$`)) tag = `j${randomBytes(6).toString("hex")}`;
  return `$${tag}$${text}$${tag}$::jsonb`;
}

/** SQL uitvoeren; geeft de ruwe uitvoer terug (psql -tA: één regel per rij, kolommen gescheiden door |) */
export function sql(statement: string): string {
  return execFileSync("psql", [url(), "-v", "ON_ERROR_STOP=1", "-X", "-q", "-t", "-A", "-c", statement], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

/** Eén JSON-waarde uit een query die `select to_jsonb(...)` of `select json_agg(...)` doet */
export function sqlJson<T>(statement: string): T | null {
  const out = sql(statement);
  return out ? (JSON.parse(out) as T) : null;
}

/** Regel in admin_logs (Mission Control → Logboeken) */
export function logRun(source: string, status: "ok" | "failed" | "warn", message: string, durationMs: number) {
  try {
    sql(`insert into public.admin_logs (kind, source, status, message, duration_ms) values ('sync', ${lit(source)}, ${lit(status)}, ${lit(message.slice(0, 1000))}, ${Math.round(durationMs)})`);
  } catch (e) {
    console.warn("Loggen in admin_logs lukte niet:", e instanceof Error ? e.message : e);
  }
}

export const lit = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
