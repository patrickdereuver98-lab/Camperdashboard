"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icons";
import { departureShort, formatDuration } from "@/lib/format";
import { cardPrice } from "@/lib/format";
import { formatKm, type LatLng } from "@/lib/geo";
import { legStartKm, placesAlongRoute } from "@/lib/route-corridor";
import { departureKind } from "@/lib/search";
import type { PlaceSummary } from "@/lib/types";

const WIDTHS = [2, 5, 10] as const;

export interface AlongLeg {
  /** Naam van het begin en eind van de etappe */
  from: string;
  to: string;
  durationS?: number;
  distanceM?: number;
}

/**
 * Plekken die op je route liggen, per etappe, met hoe ver je dan al gereden hebt. "Toevoegen" zet de plek op de juiste
 * plaats tussen de stops. Rekent alleen in de browser, met de routelijn en de plekken die er al zijn.
 */
export function AlongRoute({
  geometry,
  waypoints,
  legs,
  places,
  exclude,
  leg,
  onLeg,
  onAdd,
}: {
  geometry: [number, number][];
  waypoints: LatLng[];
  legs: AlongLeg[];
  places: PlaceSummary[];
  exclude: Set<string>;
  /** Gekozen etappe, of null voor alle */
  leg: number | null;
  onLeg: (leg: number | null) => void;
  onAdd: (slug: string, leg: number) => void;
}) {
  const [width, setWidth] = useState<(typeof WIDTHS)[number]>(5);
  const [freeOnly, setFreeOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const starts = useMemo(() => legStartKm(geometry, waypoints), [geometry, waypoints]);
  const hits = useMemo(
    () => placesAlongRoute(geometry, waypoints, places.filter((p) => !exclude.has(p.slug)), width),
    [geometry, waypoints, places, exclude, width],
  );
  const shown = hits.filter((h) => (leg === null || h.leg === leg) && (!freeOnly || departureKind(h.item) === "vrij"));
  const list = showAll ? shown : shown.slice(0, 12);

  /** Hoe lang je al onderweg bent op deze etappe, naar verhouding van de afstand */
  const onTheWay = (h: (typeof hits)[number]) => {
    const l = legs[h.leg];
    const startKm = starts[h.leg] ?? 0;
    const endKm = starts[h.leg + 1] ?? startKm;
    const km = Math.max(0, h.alongKm - startKm);
    if (!l?.durationS || endKm <= startKm) return `na ± ${formatKm(km)}`;
    return `na ± ${formatDuration((km / (endKm - startKm)) * l.durationS)} rijden`;
  };

  return (
    <section id="langs-de-route" className="mt-6 scroll-mt-20 rounded-lg border border-line bg-surface p-4" data-testid="along-route">
      <h2 className="font-display text-h2 font-semibold">Plekken langs je route</h2>
      <p className="mt-1 text-sm text-ink-2">Voor een tussenstop, of als een dag te lang wordt.</p>

      {legs.length > 1 && (
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-semibold">Etappe</span>
          <select
            value={leg ?? ""}
            onChange={(e) => onLeg(e.target.value === "" ? null : Number(e.target.value))}
            className="h-11 w-full rounded-lg border border-field bg-surface px-3"
          >
            <option value="">Alle etappes</option>
            {legs.map((l, i) => (
              <option key={i} value={i}>
                {i + 1}. {l.from} naar {l.to}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="mt-3 mb-1 text-sm font-semibold">Hoe ver van de route</p>
      <div className="flex flex-wrap gap-2">
        {WIDTHS.map((w) => (
          <Chip key={w} pressed={width === w} onClick={() => setWidth(w)}>
            {w} km
          </Chip>
        ))}
        <Chip pressed={freeOnly} onClick={() => setFreeOnly(!freeOnly)}>
          Zonder vertrektijd
        </Chip>
      </div>

      <p className="mt-3 text-sm text-muted" role="status">
        {shown.length === 0 ? "Geen plekken gevonden. Kies een bredere strook of een andere etappe." : `${shown.length} ${shown.length === 1 ? "plek" : "plekken"}`}
      </p>
      {list.length > 0 && (
        <ul className="mt-1 divide-y divide-line">
          {list.map((h) => {
            const p = h.item;
            const price = cardPrice(p);
            return (
              <li key={p.slug} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/plek/${p.slug}`} className="block truncate font-semibold hover:text-forest">
                    {p.name}
                  </Link>
                  <p className="truncate text-sm text-ink-2">
                    {p.town}, {departureShort(p) ?? "vertrektijd onbekend"}
                    {price ? `, ${price.value}${price.perNight ? " per nacht" : ""}` : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {formatKm(h.offKm)} van de route, {onTheWay(h)}
                    {leg === null && legs.length > 1 ? ` (etappe ${h.leg + 1})` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAdd(p.slug, h.leg)}
                  aria-label={`${p.name} toevoegen aan je reis`}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 font-semibold hover:border-forest"
                >
                  <Icon name="plus" size={18} /> Toevoegen
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > list.length && (
        <button type="button" onClick={() => setShowAll(true)} className="mt-2 h-11 font-semibold text-forest underline">
          Toon alle {shown.length}
        </button>
      )}
    </section>
  );
}
