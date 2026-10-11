"use client";

import Link from "next/link";
import { useState, ViewTransition } from "react";
import { FACILITIES } from "@/lib/search";
import { formatKm } from "@/lib/geo";
import { priceLabel, scoreLabel, scoreWord } from "@/lib/format";
import { useTrip } from "@/lib/store";
import { track } from "@/lib/track";
import { KIND_LABEL, type PlaceSummary } from "@/lib/types";
import { Icon } from "./icons";
import { KIND_SIGN, Sign, type SignName } from "./sign";

// ── Foto met nette terugval ─────────────────────────────────────────────────

export function PlacePhoto({
  src,
  alt,
  kind,
  town,
  className = "",
  sizes = "small",
}: {
  src?: string;
  alt: string;
  kind?: string;
  town?: string;
  className?: string;
  sizes?: "small" | "large";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-road-tint text-road ${className}`} role="img" aria-label={alt}>
        <Sign name={KIND_SIGN[kind ?? "camperplaats"] ?? "camper"} size={sizes === "large" ? 72 : 44} />
        {town && sizes === "large" && <span className="font-sign text-lg font-bold">{town}</span>}
      </div>
    );
  }
  return (
    // Externe foto's van de plek zelf; geen optimalisatieproxy zodat de bron zichtbaar blijft
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}

// ── Score ───────────────────────────────────────────────────────────────────

export function ScoreBadge({ avg, count, size = "md" }: { avg?: number; count: number; size?: "md" | "lg" }) {
  if (!avg || !count)
    return <span className="text-sm text-muted">{size === "lg" ? "Nog geen reviews" : "Nieuw"}</span>;
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid place-items-center rounded-lg rounded-bl-none bg-road font-sign font-bold text-on-road ${
          size === "lg" ? "h-11 min-w-11 px-2 text-lg" : "h-8 min-w-8 px-1.5 text-sm"
        }`}
      >
        {scoreLabel(avg)}
      </span>
      <span className="leading-tight">
        <span className={`block font-semibold ${size === "lg" ? "text-base" : "text-sm"}`}>{scoreWord(avg)}</span>
        <span className="block text-xs text-muted">
          {count} {count === 1 ? "review" : "reviews"}
        </span>
      </span>
    </span>
  );
}

// ── Bewaren ─────────────────────────────────────────────────────────────────

export function SaveButton({ slug, variant = "icon" }: { slug: string; variant?: "icon" | "full" }) {
  const trip = useTrip();
  const saved = trip.has(slug);
  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    trip.toggle(slug);
    if (!saved) track("save", { slug });
  };
  if (variant === "full")
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold transition-colors hover:border-road aria-pressed:border-road aria-pressed:bg-road-tint aria-pressed:text-road"
      >
        <Icon name="heart" size={20} filled={saved} className={saved ? "animate-pop text-alert" : ""} />
        {saved ? "Bewaard" : "Bewaar"}
      </button>
    );
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Verwijderen uit mijn reis" : "Bewaren in mijn reis"}
      className="grid h-11 w-11 place-items-center rounded-full bg-surface/95 shadow-lift transition-transform active:scale-90"
    >
      <Icon name="heart" size={21} filled={saved} className={saved ? "animate-pop text-alert" : "text-ink"} />
    </button>
  );
}

// ── Voorzieningen als bordjes ───────────────────────────────────────────────

function FacilitySigns({ place, max = 5, size = 28 }: { place: PlaceSummary; max?: number; size?: number }) {
  const present = FACILITIES.filter((f) => place[f.key] === true);
  const shown = present.slice(0, max);
  if (!shown.length) return null;
  return (
    <ul className="flex items-center gap-1" aria-label={`Voorzieningen: ${present.map((f) => f.label.toLowerCase()).join(", ")}`}>
      {shown.map((f) => (
        <li key={f.key} title={f.label}>
          <Sign name={f.icon as SignName} size={size} />
        </li>
      ))}
      {present.length > max && <li className="pl-1 text-sm font-semibold text-muted">+{present.length - max}</li>}
    </ul>
  );
}

// ── Resultaatkaart ──────────────────────────────────────────────────────────

export function PlaceCard({
  place,
  km,
  active,
  onHover,
  layout = "row",
}: {
  place: PlaceSummary;
  km?: number;
  active?: boolean;
  onHover?: (slug: string | null) => void;
  layout?: "row" | "stack";
}) {
  const stack = layout === "stack";
  return (
    <article
      data-slug={place.slug}
      onMouseEnter={() => onHover?.(place.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative overflow-hidden rounded-2xl bg-surface transition-[box-shadow,outline-color] ${
        active ? "outline-2 outline-road" : "outline-1 outline-line"
      } outline hover:shadow-lift ${stack ? "" : "sm:flex"}`}
    >
      <div className={`relative shrink-0 ${stack ? "aspect-[16/10]" : "aspect-[16/10] sm:aspect-auto sm:w-64"}`}>
        <ViewTransition name={`foto-${place.slug}`} share="photo-morph" default="none">
          <PlacePhoto src={place.imageUrl} alt={`Foto van ${place.name}`} kind={place.kind} town={place.town} className="h-full w-full" />
        </ViewTransition>
        <div className="absolute top-3 right-3">
          <SaveButton slug={place.slug} />
        </div>
        {place.priceEur === 0 && (
          <span className="absolute top-3 left-3 rounded-md bg-signal px-2 py-1 font-sign text-sm font-bold text-on-signal">Gratis</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted">{place.kind ? KIND_LABEL[place.kind] : "Camperplaats"}</p>
            <h3 className="font-sign text-xl leading-snug font-bold text-ink">
              <Link
                href={`/plek/${place.slug}`}
                className="after:absolute after:inset-0 focus-visible:outline-none"
                prefetch={false}
              >
                {place.name}
              </Link>
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-ink-2">
              <Icon name="pin" size={16} className="shrink-0 text-muted" />
              <span className="truncate">
                {place.town}, {place.province}
              </span>
            </p>
            {km !== undefined && <p className="mt-0.5 text-sm font-semibold text-road">{formatKm(km)} hemelsbreed</p>}
          </div>
          <div className="shrink-0">
            <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} />
          </div>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3">
          <FacilitySigns place={place} />
          <div className="ml-auto text-right">
            <p className="font-sign text-2xl leading-none font-extrabold text-ink">{priceLabel(place.priceEur)}</p>
            {place.priceEur !== undefined && place.priceEur > 0 && <p className="mt-1 text-xs text-muted">per nacht</p>}
          </div>
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline sm:flex">
      <div className="aspect-[16/10] animate-pulse bg-sunken sm:aspect-auto sm:h-48 sm:w-64" />
      <div className="flex-1 space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-sunken" />
        <div className="h-6 w-3/4 animate-pulse rounded bg-sunken" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-sunken" />
        <div className="flex gap-1 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 w-7 animate-pulse rounded-md bg-sunken" />
          ))}
        </div>
      </div>
    </div>
  );
}
