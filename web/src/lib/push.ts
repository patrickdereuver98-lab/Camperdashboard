"use client";

import { base64UrlToBytes, bytesToBase64Url, pushSupport, type PushSupport } from "./push-utils";
import { supabase } from "./supabase-browser";

export function currentPushSupport(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  return pushSupport({
    hasSW: "serviceWorker" in navigator,
    hasPush: "PushManager" in window,
    hasNotification: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : undefined,
    ios: /iPhone|iPad|iPod/.test(navigator.userAgent),
    standalone: nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
  });
}

/** Toestemming vragen, abonneren bij de pushdienst van de browser en het abonnement aan het account koppelen */
export async function enablePush(): Promise<void> {
  if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
    throw new Error("Zonder toestemming voor meldingen kunnen we je niets laten weten.");
  }
  const sb = supabase();
  const { data: key, error } = await sb.rpc("push_public_key");
  if (error || !key) throw new Error("Meldingen zijn op dit moment niet beschikbaar.");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key as string) }));
  const { error: e2 } = await sb.rpc("push_subscribe", {
    p_endpoint: sub.endpoint,
    p_p256dh: bytesToBase64Url(sub.getKey("p256dh")),
    p_auth: bytesToBase64Url(sub.getKey("auth")),
  });
  if (e2) throw e2;
}
