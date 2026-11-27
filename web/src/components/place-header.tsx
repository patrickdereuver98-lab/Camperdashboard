"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { SaveButton } from "./place-ui";

/**
 * Kop van de plekpagina op de telefoon (UX-audit 27 november 2026, besluit V3): terug, de naam van de plek zodra de
 * titel uit beeld is, Bewaren en het menu ⋯ (met Delen). De pagina meldt welke plek open staat (`PlaceHeaderActions`)
 * en de kop tekent zelf de knoppen (`PlaceHeaderBar`). Zo verandert de kop pas na de hydratatie, nooit ervoor.
 */
type Current = { slug: string; name: string } | null;
let current: Current = null;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function setCurrent(next: Current) {
  current = next;
  listeners.forEach((fn) => fn());
}

/** Op de plekpagina: zegt de kop welke plek dit is, zolang de pagina open staat */
export function PlaceHeaderActions({ slug, name }: { slug: string; name: string }) {
  useEffect(() => {
    setCurrent({ slug, name });
    return () => setCurrent(null);
  }, [slug, name]);
  return null;
}

/** In de kop (chrome.tsx), alleen op de plekpagina en onder `md` */
export function PlaceHeaderBar() {
  const place = useSyncExternalStore(subscribe, () => current, () => null);
  const [showName, setShowName] = useState(false);
  useEffect(() => {
    if (!place) return;
    const title = document.getElementById("plek-naam");
    if (!title || !("IntersectionObserver" in window)) return;
    // Pas als de titel onder de kop (±56 px) verdwijnt, de naam in de kop
    const io = new IntersectionObserver(([e]) => setShowName(!e.isIntersecting && e.boundingClientRect.top < 64), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(title);
    return () => {
      io.disconnect();
      setShowName(false);
    };
  }, [place]);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
      {place && (
        <>
          <p
            className={`min-w-0 flex-1 truncate font-semibold text-ink transition-opacity duration-150 motion-reduce:transition-none ${showName ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
            data-testid="header-place-name"
          >
            {place.name}
          </p>
          <SaveButton slug={place.slug} name={place.name} variant="plain" />
        </>
      )}
    </div>
  );
}
