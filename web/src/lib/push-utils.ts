/** VAPID-sleutel (base64url) naar de bytes die pushManager.subscribe verwacht */
export function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes naar base64url (zonder opvulling), zoals de pushdienst de sleutels verwacht */
export function bytesToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  let bin = "";
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type PushSupport = "ok" | "ios-install" | "unsupported" | "denied";

/** Kan deze browser pushmeldingen tonen? Op een iPhone alleen als de site op het beginscherm staat. */
export function pushSupport(env: { hasSW: boolean; hasPush: boolean; hasNotification: boolean; permission?: string; ios: boolean; standalone: boolean }): PushSupport {
  if (env.permission === "denied") return "denied";
  if (env.hasSW && env.hasPush && env.hasNotification) return "ok";
  if (env.ios && !env.standalone) return "ios-install";
  return "unsupported";
}
