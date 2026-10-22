/**
 * Rollen in beheer (PRD "Rollen in beheer", besluit Patrick 18 oktober 2026).
 * - admin: alles.
 * - support: inzendingen, reviews, foto's en meldingen (tickets, Meld inhoud) afhandelen; geen instellingen,
 *   beheerders, verwijderingen (plekken, samenvoegen, accounts) en geen logs met persoonsgegevens.
 *
 * Dit bestand bepaalt alleen wat de beheeromgeving toont. De echte grens ligt in de database (`is_admin()` en
 * `is_staff()` in RLS en de beheerfuncties, migratie 20261022110000_rol_support.sql): wat hier verborgen is, weigert
 * de database ook.
 */
export type AdminRole = "admin" | "support";

/** Rol uit `admin_role()` (tekst of null); alles wat geen bekende rol is, geeft geen toegang. */
export function parseRole(value: unknown): AdminRole | null {
  return value === "admin" || value === "support" ? value : null;
}

/** Beheerpagina's die alleen een beheerder mag openen (support krijgt "Geen toegang"). */
export const ADMIN_ONLY_PATHS = [
  "/admin/statistieken",
  "/admin/dubbelen",
  "/admin/faq",
  "/admin/logs",
  "/admin/instellingen",
] as const;

/** Normaliseer een pad: zonder query, hash, dubbele of afsluitende schuine strepen, in kleine letters. */
function normalize(pathname: string): string {
  const p = pathname.split(/[?#]/)[0].toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  return p || "/";
}

/** Mag deze rol dit beheerpad openen? Onbekende of ontbrekende rol: nee. */
export function canOpen(role: AdminRole | null, pathname: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  const p = normalize(pathname);
  return !ADMIN_ONLY_PATHS.some((a) => p === a || p.startsWith(`${a}/`));
}

/** Losse acties binnen pagina's die support wel mag openen. */
export type AdminAction =
  | "review-verwijderen" // reviews: afkeuren mag, definitief verwijderen niet
  | "plek-status" // plekken: online/concept/verborgen en vastzetten (verbergen = van de site halen)
  | "plek-verwijderen"
  | "plekken-samenvoegen";

export function can(role: AdminRole | null, action: AdminAction): boolean {
  void action; // alle acties hierboven zijn nu alleen voor de beheerder
  return role === "admin";
}
