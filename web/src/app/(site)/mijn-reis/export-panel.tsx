"use client";

import { Icon } from "@/components/icons";
import type { GmapsPart } from "@/lib/trip-export";

/** Route meenemen: Google Maps (in delen als het moet), GPX voor het navigatiesysteem, agenda */
export function ExportPanel({ parts, onGpx, onIcs, canIcs }: { parts: GmapsPart[]; onGpx: () => void; onIcs: () => void; canIcs: boolean }) {
  return (
    <div className="mt-4 space-y-2" data-testid="export-panel">
      {parts.length === 1 && (
        <a
          href={parts[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-on-forest"
        >
          <Icon name="route" size={19} /> Open route in Google Maps
        </a>
      )}
      {parts.length > 1 && (
        <div className="rounded-lg border border-line p-3">
          <p className="font-semibold">Open route in Google Maps</p>
          <p className="mt-0.5 text-sm text-muted">Google Maps neemt maximaal 10 stops per route. Je reis staat daarom in {parts.length} delen.</p>
          <ul className="mt-2 grid gap-2">
            {parts.map((p, i) => (
              <li key={p.url}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 font-semibold hover:border-forest"
                >
                  Deel {i + 1}: {p.from > p.to ? "naar het eindpunt" : p.from === p.to ? `stop ${p.from}` : `stop ${p.from} t/m ${p.to}`}
                  <Icon name="external" size={18} className="text-muted" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onGpx} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 font-semibold hover:border-forest">
          <Icon name="download" size={18} /> GPX-bestand
        </button>
        <button
          type="button"
          onClick={onIcs}
          disabled={!canIcs}
          className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 font-semibold hover:border-forest disabled:opacity-50"
        >
          <Icon name="calendar" size={18} /> In je agenda
        </button>
      </div>
      <p className="text-sm text-muted">
        Het GPX-bestand opent in de meeste navigatiesystemen voor campers. {canIcs ? "" : "Kies een vertrekdatum om de reis in je agenda te zetten."}
      </p>
    </div>
  );
}
