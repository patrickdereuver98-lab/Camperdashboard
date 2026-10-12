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

export async function signIn(page: Page) {
  await page.addInitScript((s) => localStorage.setItem("vrijstaan-auth", JSON.stringify(s)), SESSION);
  await page.route(`${SUPABASE}/auth/v1/user`, (r) => r.fulfill({ json: USER }));
}
