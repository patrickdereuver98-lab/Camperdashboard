"use client";

import Link from "next/link";
import type { Place } from "@/lib/types";
import { useTrip } from "@/lib/client-data";
import { formatKm } from "@/lib/geo";
import { eur, formatPrice } from "@/lib/format";
import { Icon } from "./icons";
import { Landscape } from "./landscape";

export function PriceTag({
  place,
  className = "",
}: {
  place: Place;
  className?: string;
}) {
  if (place.price === "gratis")
    return (
      <span
        className={`rounded-full bg-ember-tint px-2.5 py-0.5 text-xs font-semibold text-ember ${className}`}
      >
        Gratis
      </span>
    );
  if (place.price === "betaald")
    return (
      <span
        className={`rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft ${className}`}
      >
        {place.priceEur ? `${eur(place.priceEur)} p.n.` : "Betaald"}
      </span>
    );
  if (place.priceText)
    return (
      <span
        className={`rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-ink-soft ${className}`}
      >
        {formatPrice(place.priceText)}
      </span>
    );
  return (
    <span className={`text-xs text-muted ${className}`}>Prijs onbekend</span>
  );
}

export function Facilities({ place, max }: { place: Place; max?: number }) {
  const items: {
    icon: Parameters<typeof Icon>[0]["name"];
    label: string;
    tone: string;
  }[] = [];
  if (place.water)
    items.push({
      icon: "waves",
      label: "Aan het water",
      tone: "bg-lake-tint text-lake",
    });
  if (place.power)
    items.push({
      icon: "bolt",
      label: "Stroom",
      tone: "bg-forest-tint text-forest-deep",
    });
  if (place.dogs === true)
    items.push({
      icon: "paw",
      label: "Honden welkom",
      tone: "bg-forest-tint text-forest-deep",
    });
  if (place.spots)
    items.push({
      icon: "parking",
      label: `${place.spots} plekken`,
      tone: "bg-surface-2 text-ink-soft",
    });
  if (place.hours === "Altijd open" || place.hours === "Hele jaar open")
    items.push({
      icon: "clock",
      label: place.hours,
      tone: "bg-surface-2 text-ink-soft",
    });
  if (!items.length) return null;
  const shown = max ? items.slice(0, max) : items;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {shown.map((i) => (
        <li
          key={i.label}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${i.tone}`}
        >
          <Icon name={i.icon} size={13} />
          {i.label}
        </li>
      ))}
      {max && items.length > max && (
        <li className="rounded-full px-1.5 py-0.5 text-xs text-muted">
          +{items.length - max}
        </li>
      )}
    </ul>
  );
}

export function SaveButton({
  slug,
  variant = "icon",
}: {
  slug: string;
  variant?: "icon" | "full";
}) {
  const trip = useTrip();
  const saved = trip.has(slug);
  const label = saved ? "Verwijder uit mijn reis" : "Bewaar in mijn reis";
  if (variant === "full")
    return (
      <button
        type="button"
        onClick={() => trip.toggle(slug)}
        aria-pressed={saved}
        className="flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink transition hover:border-ember hover:text-ember aria-pressed:border-ember aria-pressed:bg-ember-tint aria-pressed:text-ember"
      >
        <Icon name="heart" size={17} filled={saved} />
        {saved ? "In mijn reis" : "Bewaar in mijn reis"}
      </button>
    );
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        trip.toggle(slug);
      }}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface/90 text-ink-soft shadow-card backdrop-blur transition hover:scale-105 hover:text-ember aria-pressed:text-ember"
    >
      <Icon name="heart" size={17} filled={saved} />
    </button>
  );
}

export function PlaceCard({
  place,
  km,
  active,
  onHover,
}: {
  place: Place;
  km?: number;
  active?: boolean;
  onHover?: (slug: string | null) => void;
}) {
  return (
    <article
      data-slug={place.slug}
      onMouseEnter={() => onHover?.(place.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative flex gap-3 rounded-2xl sm:gap-4 border bg-surface p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-lift ${
        active ? "border-forest" : "border-line/80"
      }`}
    >
      <div className="relative aspect-square w-24 shrink-0 self-start overflow-hidden rounded-xl sm:aspect-[4/3] sm:w-40 sm:self-stretch">
        <Landscape
          seed={place.slug}
          water={place.water}
          className="h-full w-full transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-lg leading-tight font-semibold text-ink">
              <Link
                href={`/plek/${place.slug}`}
                className="after:absolute after:inset-0 after:rounded-2xl"
              >
                {place.name}
              </Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted">
              <Icon name="pin" size={13} className="shrink-0" />
              <span className="truncate">
                {place.unnamed
                  ? place.province
                  : `${place.town}, ${place.province}`}
              </span>
              {km !== undefined && (
                <span className="shrink-0 font-medium text-ink-soft">
                  · {formatKm(km)}
                </span>
              )}
            </p>
          </div>
          <div className="relative z-10">
            <SaveButton slug={place.slug} />
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2.5 sm:pt-3">
          <Facilities place={place} max={3} />
          <PriceTag place={place} className="ml-auto" />
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-line/60 bg-surface p-3">
      <div className="aspect-square w-24 shrink-0 animate-pulse rounded-xl bg-surface-2 sm:aspect-[4/3] sm:w-40" />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="mt-auto h-5 w-1/2 animate-pulse rounded-full bg-surface-2" />
      </div>
    </div>
  );
}
