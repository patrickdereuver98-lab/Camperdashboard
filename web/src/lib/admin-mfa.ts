/**
 * Tweestapsverificatie (TOTP) voor beheer (audit 24 november 2026, H2). De database geeft beheerrechten alleen aan een
 * sessie op niveau aal2 (is_admin en has_admin_role, migratie 20261124100000). Deze helper bepaalt welke stap de
 * beheeromgeving toont, op basis van mfa.getAuthenticatorAssuranceLevel():
 *   - aal2 bereikt                   → rechten controleren in de database
 *   - wel een factor, nog geen aal2  → code uit de authenticator-app vragen
 *   - nog geen factor                → factor instellen (QR-code), daarna is de sessie aal2
 * Iedereen die /admin opent zonder aal2 krijgt dus eerst de tweede stap; zo kan een beheerder zichzelf nooit
 * buitensluiten (instellen kan altijd op aal1) en ziet een gewone gebruiker niets van beheer.
 */
export type AdminMfaStep = "rechten" | "code" | "instellen";

export function adminMfaStep(levels: { currentLevel: string | null; nextLevel: string | null }): AdminMfaStep {
  if (levels.currentLevel === "aal2") return "rechten";
  if (levels.nextLevel === "aal2") return "code";
  return "instellen";
}

/** Zes cijfers uit wat iemand typte of plakte ("123 456" → "123456"); anders null */
export function totpCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}
