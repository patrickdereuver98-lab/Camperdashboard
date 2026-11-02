"use client";

import { useSyncExternalStore } from "react";
import { currentTheme, subscribeTheme } from "./theme";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const noop = () => () => {};

/** true zodra de component in de browser draait (na hydratatie) */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * true als de site nu donker is: systeeminstelling of de zon/maan-knop (lib/theme.ts). Wisselt live mee, ook als het
 * systeem bij zonsondergang naar donker gaat. Op de server en tijdens hydratatie false.
 */
export function useDarkTheme(): boolean {
  return useSyncExternalStore(subscribeTheme, () => currentTheme() === "dark", () => false);
}
