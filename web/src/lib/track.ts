"use client";

import { readConsent } from "./store";
import type { Json } from "./database.types";
import { supabase } from "./supabase-browser";

type EventName = "page_view" | "search" | "place_view" | "outbound" | "route" | "save";

let session: string | null = null;

/** De link naar een supportticket is geheim: nooit in statistieken of logs */
const safePath = (path: string) => path.replace(/^\/support\/[^/?#]+/, "/support/[token]");

/** Anonieme statistiek, alleen met toestemming. Geen cookies, geen IP-adres, geen externe partij. */
export function track(name: EventName, props: { [key: string]: Json } = {}) {
  if (typeof window === "undefined" || !readConsent()?.analytics) return;
  try {
    session ??= sessionStorage.getItem("vrijstaan:sessie") ?? crypto.randomUUID();
    sessionStorage.setItem("vrijstaan:sessie", session);
  } catch {
    session ??= "anoniem";
  }
  void supabase()
    .rpc("track", { p_name: name, p_path: safePath(location.pathname), p_props: props, p_session: session })
    .then(() => undefined, () => undefined);
}

export function reportError(message: string, context: Record<string, unknown> = {}) {
  void supabase()
    .rpc("report_client_error", { p_message: message.slice(0, 500), p_context: { ...context, path: safePath(location.pathname) } })
    .then(() => undefined, () => undefined);
}
