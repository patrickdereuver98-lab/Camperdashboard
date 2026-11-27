"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { arrivalText, departureShort, pluralize } from "@/lib/format";
import { shortDay } from "@/lib/trip-dates";
import type { PlaceSummary } from "@/lib/types";
import { DepartureChip, PlacePhoto } from "@/components/place-ui";
import { NavigateButton } from "@/components/navigate";
import { Icon } from "@/components/icons";
import { nextStopIndex } from "@/lib/trip-next";

type NextStopItem = { slug: string; nights: number; point?: unknown; place: PlaceSummary };
type Dated = { arrive: Date; leave: Date };

/** Blok bovenaan Mijn reis: de stop waar het nu om gaat, met vertrekregel, aankomst en Route openen */
export function NextStop({
  stops,
  dated,
  today,
}: {
  stops: NextStopItem[];
  dated: Dated[] | null;
  today: { tonight?: number; leaving?: number } | undefined;
}) {
  // Mijn reis leest de reis pas in de browser (localStorage), dus "nu" is hier de klok van de bezoeker
  const pick = nextStopIndex(stops.length, dated, today);
  if (!pick) return null;
  const s = stops[pick.index];
  const own = !!s.point;
  const d = dated?.[pick.index];
  const leavingName = today?.leaving !== undefined ? stops[today.leaving]?.place.name : undefined;
  const leavingRule = today?.leaving !== undefined ? departureShort(stops[today.leaving].place) : undefined;
  const arrival = own ? undefined : arrivalText(s.place);
  return (
    <section aria-labelledby="volgende-stop" className="mt-4 rounded-lg border border-line bg-surface p-3 sm:p-4" data-testid={today ? "trip-today" : "next-stop"}>
      {leavingName && (
        <p className="mb-2 text-sm font-semibold text-ink-2">
          Vandaag vertrek je bij {leavingName}
          {leavingRule ? ` (${leavingRule.toLowerCase()})` : ""}.
        </p>
      )}
      <h2 id="volgende-stop" className="text-sm font-semibold text-muted">
        {pick.label}
      </h2>
      <div className="mt-1.5 flex gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md sm:h-20 sm:w-20">
          {own ? (
            <div className="grid h-full w-full place-items-center rounded-md border border-dashed border-ink-2 text-ink-2">
              <Icon name="pin" size={24} />
            </div>
          ) : (
            <PlacePhoto src={s.place.imageUrl} alt="" kind={s.place.kind} className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-h3 font-semibold text-ink">
            {pick.label === "Vannacht" ? `Vannacht: ${s.place.name}` : s.place.name}
          </p>
          {!own && (
            <div className="mt-1">
              <DepartureChip place={s.place} />
            </div>
          )}
          {arrival && <p className="mt-1 text-sm text-ink-2">{arrival}</p>}
          <p className="text-sm text-ink-2">
            {d ? (s.nights === 0 ? `Tussenstop op ${shortDay(d.arrive)}` : `${shortDay(d.arrive)} tot ${shortDay(d.leave)}`) : null}
            {d && s.nights > 0 ? ", " : ""}
            {s.nights > 0 ? pluralize(s.nights, "nacht", "nachten") : d ? "" : "tussenstop"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <NavigateButton
          to={s.place}
          slug={s.slug}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-forest px-4 font-semibold text-on-forest hover:bg-forest-deep sm:flex-none"
        >
          <Icon name="route" size={18} /> Route openen
        </NavigateButton>
        {!own && (
          <Link href={`/plek/${s.slug}`} className="-my-3 py-3 font-semibold text-forest underline underline-offset-2">
            Bekijk plek
          </Link>
        )}
      </div>
    </section>
  );
}

/** Minder vaak gebruikte reisacties achter één knop; Delen blijft los (ontwerpronde 2) */
export function TripMoreMenu({ items }: { items: { label: string; icon: Parameters<typeof Icon>[0]["name"]; onSelect?: () => void; href?: string; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      document.getElementById("reis-meer-knop")?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-reis-meer]")) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  const row = "flex min-h-11 w-full items-center gap-3 px-4 text-left font-semibold text-ink hover:bg-sunken disabled:opacity-50";
  return (
    <div
      className="relative"
      data-reis-meer
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        id="reis-meer-knop"
        type="button"
        aria-expanded={open}
        aria-controls={open ? "reis-meer" : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-1.5 rounded-md border border-line bg-surface px-3.5 font-semibold hover:border-forest aria-expanded:border-forest"
      >
        <Icon name="more" size={20} strokeWidth={3} /> Meer reisopties
      </button>
      {open && (
        <div id="reis-meer" className="animate-rise absolute top-full left-0 z-30 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-float">
          {items.map((it) =>
            it.href ? (
              <Link key={it.label} href={it.href} className={row} onClick={() => setOpen(false)}>
                <Icon name={it.icon} size={19} /> {it.label}
              </Link>
            ) : (
              <button
                key={it.label}
                type="button"
                disabled={it.disabled}
                className={row}
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                <Icon name={it.icon} size={19} /> {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
