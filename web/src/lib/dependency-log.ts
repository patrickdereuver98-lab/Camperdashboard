/**
 * Melding van de dependency-radar (GitHub Actions, workflow ai-dependency-triage.yml) controleren voordat die naar de
 * database gaat. De database controleert het geheim en de vorm nog een keer (public.log_dependency); dit filter zorgt
 * dat er geen rommel of te lange tekst doorgestuurd wordt.
 */

export const CATEGORIES = ["kritiek", "aanbevolen", "uitstellen"] as const;
export const STATUSES = ["auto-merged", "pending_review", "rejected"] as const;
export const UPDATE_TYPES = ["major", "minor", "patch", "onbekend"] as const;

export type DependencyUpdate = {
  package_name: string;
  version_from: string | null;
  version_to: string | null;
  update_type: (typeof UPDATE_TYPES)[number];
  ecosystem: string | null;
  category: (typeof CATEGORIES)[number];
  ai_advice: string | null;
  ai_model: string | null;
  status: (typeof STATUSES)[number];
  pr_number: number | null;
  pr_url: string | null;
};

const PR_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/(\d+)$/;
const PACKAGE = /^[@a-z0-9][a-z0-9._\-/@]{0,213}$/i;
const VERSION = /^v?[0-9][0-9A-Za-z.+\-_]{0,63}$/;

const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : undefined;

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parseDependencyUpdate(body: unknown): DependencyUpdate | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Verwacht een JSON-object" };
  const b = body as Record<string, unknown>;

  const name = typeof b.package_name === "string" ? b.package_name.trim() : "";
  if (!PACKAGE.test(name)) return { error: "package_name ontbreekt of is ongeldig" };
  const category = oneOf(CATEGORIES, b.category);
  if (!category) return { error: `category moet ${CATEGORIES.join(", ")} zijn` };
  const status = b.status === undefined ? "pending_review" : oneOf(STATUSES, b.status);
  if (!status) return { error: `status moet ${STATUSES.join(", ")} zijn` };

  const prUrl = text(b.pr_url, 300);
  const match = prUrl ? PR_URL.exec(prUrl) : null;
  if (prUrl && !match) return { error: "pr_url moet een pull request op github.com zijn" };
  const prNumber = match ? Number(match[1]) : Number.isInteger(b.pr_number) ? (b.pr_number as number) : null;

  const version = (v: unknown) => {
    const s = text(v, 64);
    return s && VERSION.test(s) ? s : null;
  };

  return {
    package_name: name,
    version_from: version(b.version_from),
    version_to: version(b.version_to),
    update_type: oneOf(UPDATE_TYPES, b.update_type) ?? "onbekend",
    ecosystem: text(b.ecosystem, 40),
    category,
    ai_advice: text(b.ai_advice, 600),
    ai_model: text(b.ai_model, 80),
    status,
    pr_number: prNumber,
    pr_url: prUrl,
  };
}

/** Geheim uit `Authorization: Bearer …` (of `x-vrijstaan-key`); leeg als het ontbreekt */
export function bearer(headers: Headers): string {
  const auth = headers.get("authorization") ?? "";
  const fromAuth = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  return fromAuth || headers.get("x-vrijstaan-key")?.trim() || "";
}
