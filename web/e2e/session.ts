import type { Page } from "@playwright/test";

export const SUPABASE = "https://qkrmthrhwmmmwswmfgwc.supabase.co";

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 3600;
export const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "kampeerder@example.com",
  app_metadata: { provider: "google", providers: ["google"] },
  user_metadata: { full_name: "Kees Kampeerder" },
  created_at: "2026-10-01T00:00:00Z",
};
export const SESSION = {
  access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER.id, exp, role: "authenticated", aud: "authenticated" })}.sig`,
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: exp,
  user: USER,
};

export const TOTP_FACTOR = {
  id: "22222222-2222-4222-8222-222222222222",
  friendly_name: "Beheer",
  factor_type: "totp",
  status: "verified",
  created_at: "2026-11-24T00:00:00Z",
  updated_at: "2026-11-24T00:00:00Z",
};

/** Sessie met een bepaald niveau (`aal` in het token) en eventueel factoren; beheer vraagt aal2 (audit H2) */
export function sessionWith(o: { aal?: "aal1" | "aal2"; factors?: object[] } = {}) {
  const user = { ...USER, factors: o.factors ?? [] };
  const claims = { sub: USER.id, exp, role: "authenticated", aud: "authenticated", ...(o.aal ? { aal: o.aal } : {}) };
  return { ...SESSION, access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.sig`, user };
}

export async function signIn(page: Page, o: { aal?: "aal1" | "aal2"; factors?: object[] } = {}) {
  const s = o.aal || o.factors ? sessionWith(o) : SESSION;
  await page.addInitScript((s) => localStorage.setItem("vrijstaan-auth", JSON.stringify(s)), s);
  await page.route(`${SUPABASE}/auth/v1/user`, (r) => r.fulfill({ json: s.user }));
}

/** Beheerder na de tweede stap: token op aal2 en een geverifieerde TOTP-factor */
export const signInAdmin = (page: Page) => signIn(page, { aal: "aal2", factors: [TOTP_FACTOR] });
