"use client";

import { useEffect, useRef, useState } from "react";

export type SectionLink = { id: string; label: string };

/**
 * Springlinks op de plekpagina (redesign 18 november 2026, naar het voorbeeld van een kaart-app): één rij onder de
 * header die blijft plakken. Een tik springt naar het onderdeel; er wordt niets verborgen, de pagina blijft één
 * geheel (ook voor zoekmachines). Het onderdeel dat je leest, staat aan.
 */
export function SectionNav({ links, className = "" }: { links: SectionLink[]; className?: string }) {
  const [active, setActive] = useState(links[0]?.id);
  const bar = useRef<HTMLElement>(null);

  // Welk onderdeel lees je? Het laatste waarvan de bovenkant boven de onderrand van de rij staat.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (bar.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let current: string | undefined = links[0]?.id;
      for (const l of links) {
        const el = document.getElementById(l.id);
        if (el && el.getBoundingClientRect().top <= line) current = l.id;
      }
      // Onderaan de pagina: het laatste onderdeel, ook als het te kort is om de rij te bereiken
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = links.at(-1)?.id ?? current;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [links]);

  // De actieve link blijft in beeld op een smalle telefoon (alleen horizontaal scrollen, de pagina springt niet)
  useEffect(() => {
    const row = bar.current?.querySelector<HTMLElement>("[data-row]");
    const link = row?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!row || !link) return;
    const left = link.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + link.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [active]);

  if (links.length < 2) return null;
  return (
    <nav
      ref={bar}
      aria-label="Onderdelen van deze plek"
      className={`sticky top-14 z-20 -mx-4 mt-4 border-b border-line bg-paper/95 backdrop-blur sm:top-16 sm:-mx-6 ${className}`}
    >
      <div data-row className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
        {links.map((l) => (
          <a
            key={l.id}
            href={`#${l.id}`}
            data-id={l.id}
            aria-current={active === l.id ? "location" : undefined}
            className="flex h-11 shrink-0 items-center rounded-md px-3 font-semibold whitespace-nowrap text-ink-2 transition-colors duration-150 hover:text-ink aria-[current]:bg-forest-tint aria-[current]:text-forest"
          >
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
