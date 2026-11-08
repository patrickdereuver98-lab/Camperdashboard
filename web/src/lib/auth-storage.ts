/** Sleutel in localStorage waaronder supabase-js de sessie bewaart (en met "-code-verifier" de PKCE-code) */
export const AUTH_STORAGE_KEY = "vrijstaan-auth";

/**
 * Kan er een sessie zijn? Alleen dan hoeft de browser supabase-js meteen te laden (R34): een bewaarde sessie, of een
 * terugkeer van inloggen met een code of token in het adres. Kan de opslag niet gelezen worden, dan voor de zekerheid ja.
 */
export function maybeSignedIn(): boolean {
  try {
    if (localStorage.getItem(AUTH_STORAGE_KEY) !== null) return true;
  } catch {
    return true;
  }
  return /[?&#](code|access_token|error_description)=/.test(window.location.href);
}
