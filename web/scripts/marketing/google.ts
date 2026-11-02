// Inloggen bij Google met een serviceaccount (JWT, RS256) zonder extra pakket. De sleutel staat alleen in een
// GitHub-secret (GSC_SERVICE_ACCOUNT_JSON); dit script logt hem nooit.
import { createSign } from "node:crypto";

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export async function googleToken(json: string, scope: string): Promise<string> {
  const sa = JSON.parse(json) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("GSC_SERVICE_ACCOUNT_JSON mist client_email of private_key");
  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat: now, exp: now + 3600 }))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const res = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`Google-login mislukt: ${data.error_description ?? res.status}`);
  return data.access_token;
}

/** JSON ophalen met nette fout; bij 429 of 5xx één keer opnieuw na 5 seconden */
export async function getJson<T>(url: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  if ((res.status === 429 || res.status >= 500) && retry) {
    await new Promise((r) => setTimeout(r, 5000));
    return getJson<T>(url, init, false);
  }
  if (!res.ok) throw new Error(`${new URL(url).pathname} antwoordde ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}
