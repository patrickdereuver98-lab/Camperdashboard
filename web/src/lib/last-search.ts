"use client";

import { useSyncExternalStore } from "react";

/**
 * De laatste zoekopdracht van dit bezoek (adres met alle filters), in sessionStorage. Het tabblad Zoeken brengt je
 * daar terug, zodat je filters blijven staan als je even naar Dichtbij, Start of een plek gaat (UX-audit november).
 * Alleen dit bezoek: morgen begin je weer schoon.
 */
const KEY = "vrijstaan:laatste-zoekopdracht";
const listeners = new Set<() => void>();

export const SEARCH_HOME = "/zoeken";

const read = (): string => {
  try {
    const v = sessionStorage.getItem(KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : SEARCH_HOME;
  } catch {
    return SEARCH_HOME;
  }
};

export function saveLastSearch(href: string) {
  try {
    if (sessionStorage.getItem(KEY) === href) return;
    sessionStorage.setItem(KEY, href);
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Waar het tabblad Zoeken heen gaat: de laatste zoekopdracht van dit bezoek, anders /zoeken */
export const useLastSearch = () => useSyncExternalStore(subscribe, read, () => SEARCH_HOME);

// ── Volgorde van de laatste zoekresultaten, voor "Vorige" en "Volgende" op de plekpagina ─────────────────────────

const ORDER_KEY = "vrijstaan:resultaten";
export type ResultRef = { slug: string; name: string };

/** De eerste 300 plekken van de laatste zoekopdracht, in de volgorde van de lijst (deze sessie) */
export function saveResultOrder(items: ResultRef[], href: string) {
  try {
    sessionStorage.setItem(ORDER_KEY, JSON.stringify({ href, items: items.slice(0, 300) }));
  } catch {
    // Geen opslag: dan geen vorige en volgende op de plekpagina
  }
}

export function readResultOrder(): { href: string; items: ResultRef[] } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(ORDER_KEY) ?? "null") as { href?: unknown; items?: unknown } | null;
    if (!v || typeof v.href !== "string" || !v.href.startsWith("/") || !Array.isArray(v.items)) return null;
    const items = v.items.filter((x): x is ResultRef => !!x && typeof x.slug === "string" && typeof x.name === "string");
    return { href: v.href, items };
  } catch {
    return null;
  }
}
