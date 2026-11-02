"use client";

import { cleanSource } from "./marketing/links";
import { readConsent } from "./store";
import type { Json } from "./database.types";
import { supabase } from "./supabase-browser";

type EventName = "page_view" | "search" | "place_view" | "outbound" | "route" | "save";

let session: string | null = null;

/** De link naar een supportticket is geheim: nooit in statistieken of logs */
const safePath = (path: string) => path.replace(/^\/support\/[^/?#]+/, "/support/[token]");

/**
 * Waar de bezoeker vandaan kwam: `?bron=` en `?campagne=` uit links van het marketingdashboard (of utm_source en
 * utm_campaign). Blijft de hele sessie bewaard in sessionStorage, zodat elke page_view hem draagt. Wordt alleen
 * gelezen binnen track(), dus alleen met toestemming.
 */
function sourceProps(): { bron?: string; campagne?: string } {
  try {
    const p = new URLSearchParams(location.search);
    const bron = cleanSource(p.get("bron") ?? p.get("utm_source"));
    if (bron) {
      const value = { bron, ...(cleanSource(p.get("campagne") ?? p.get("utm_campaign")) ? { campagne: cleanSource(p.get("campagne") ?? p.get("utm_campaign")) } : {}) };
      sessionStorage.setItem("vrijstaan:bron", JSON.stringify(value));
      return value;
    }
    const saved = JSON.parse(sessionStorage.getItem("vrijstaan:bron") ?? "null") as { bron?: string; campagne?: string } | null;
    return saved && typeof saved.bron === "string" ? { bron: cleanSource(saved.bron), campagne: cleanSource(saved.campagne) } : {};
  } catch {
    return {};
  }
}

/** Anonieme statistiek, alleen met toestemming. Geen cookies, geen IP-adres, geen externe partij. */
export function track(name: EventName, props: { [key: string]: Json } = {}) {
  if (typeof window === "undefined" || !readConsent()?.analytics) return;
  if (name === "page_view") {
    const src = sourceProps();
    if (src.bron) props = { ...props, bron: src.bron, ...(src.campagne ? { campagne: src.campagne } : {}) };
  }
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
