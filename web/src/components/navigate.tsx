"use client";

import { useState, type ReactNode } from "react";
import { directionsUrl, type LatLng } from "@/lib/geo";
import { track } from "@/lib/track";
import { Icon } from "./icons";
import { Sheet } from "./sheet";

/** Knop "Route": kies zelf je navigatie-app, of kopieer de coördinaten voor het navigatiesysteem in de camper. */
export function NavigateButton({ to, name, className, children }: { to: LatLng; name: string; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const coords = `${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`;
  const apps = [
    { label: "Google Maps", href: directionsUrl(to) },
    { label: "Apple Kaarten", href: `https://maps.apple.com/?daddr=${to.lat},${to.lng}&dirflg=d` },
    { label: "Waze", href: `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(coords);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Navigeren naar deze plek">
        <ul className="grid gap-2">
          {apps.map((a) => (
            <li key={a.label}>
              <a
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("outbound", { soort: "route", app: a.label, naar: name })}
                className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 font-semibold hover:border-forest"
              >
                {a.label}
                <Icon name="external" size={18} className="text-muted" />
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-lg bg-sunken p-4">
          <p className="text-ink-2">Coördinaten voor het navigatiesysteem in je camper</p>
          <p className="mt-1 font-semibold tabular-nums">{coords}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold hover:border-forest"
          >
            <Icon name={copied ? "check" : "pin"} size={18} />
            {copied ? "Gekopieerd" : "Kopieer coördinaten"}
          </button>
        </div>
      </Sheet>
    </>
  );
}
