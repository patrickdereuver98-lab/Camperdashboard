"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, ViewTransition } from "react";
import { departureKind, FACILITIES, openStatus } from "@/lib/search";
import { formatKm } from "@/lib/geo";
import { cardPrice, departureShort, scoreLabel, scoreWord } from "@/lib/format";
import { useTrip } from "@/lib/store";
import { useHydrated } from "@/lib/use-media";
import { track } from "@/lib/track";
import { KIND_LABEL, type PlaceSummary } from "@/lib/types";
import { Icon } from "./icons";
import { Landscape } from "./landscape";
import { Sign, type SignName } from "./sign";

// ── Foto met nette terugval ─────────────────────────────────────────────────

export function PlacePhoto({
  src,
  alt,
  kind,
  town,
  className = "",
  sizes = "small",
  onFail,
}: {
  src?: string;
  alt: string;
  kind?: string;
  town?: string;
  className?: string;
  sizes?: "small" | "large";
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const fail = useCallback(() => {
    setFailed(true);
    onFail?.();
  }, [onFail]);
  // Een foto die al vóór de hydratatie faalde, mist het onError-event
  useEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth === 0) fail();
  }, [fail]);
  if (!src || failed) {
    // Geen foto: een getekend landschap (duidelijk een illustratie, geen nepfoto)
    return (
      <div className={`relative overflow-hidden ${className}`} role="img" aria-label={`${alt} (nog geen foto)`}>
        <Landscape seed={alt} water={kind === "jachthaven"} van={sizes === "large"} className="absolute inset-0 h-full w-full" />
        {sizes === "large" && (
          <span className="absolute bottom-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-sm font-semibold text-ink-2">
            Nog geen foto{town ? ` van deze plek in ${town}` : ""}
          </span>
        )}
      </div>
    );
  }
  return (
    // Externe foto's van de plek zelf; geen optimalisatieproxy zodat de bron zichtbaar blijft
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={fail}
      className={`object-cover ${className}`}
    />
  );
}

// ── Score ───────────────────────────────────────────────────────────────────

export function ScoreBadge({ avg, count, size = "md" }: { avg?: number; count: number; size?: "md" | "lg" }) {
  if (!avg || !count) return size === "lg" ? <span className="text-sm text-muted">Nog geen reviews</span> : null;
  return (
    <span className="flex items-center gap-2">
      <span
        className={`grid place-items-center rounded-lg rounded-bl-none bg-forest font-display font-semibold text-on-forest ${
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
    if (!saved) {
      track("save", { slug });
      window.dispatchEvent(new CustomEvent("vrijstaan:bewaard"));
    }
  };
  if (variant === "full")
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold transition-colors hover:border-forest aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
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

/** Seizoensstatus als klein label; alleen als het seizoen bekend is */
export function OpenChip({ place }: { place: Pick<PlaceSummary, "openAllYear" | "season"> }) {
  // "Nu open" hangt af van de datum van de bezoeker: pas na hydratatie berekenen
  const hydrated = useHydrated();
  const status = hydrated ? openStatus(place) : undefined;
  if (!status) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${status.open ? "text-forest" : "text-alert"}`}>
      <span className={`h-2 w-2 rounded-full ${status.open ? "bg-forest" : "bg-alert"}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function PlaceCard({
  place,
  km,
  distanceLabel,
  active,
  onHover,
  layout = "row",
}: {
  place: PlaceSummary;
  km?: number;
  /** Eigen afstandstekst (bijv. echte rijtijd); vervangt de hemelsbrede afstand */
  distanceLabel?: React.ReactNode;
  active?: boolean;
  onHover?: (slug: string | null) => void;
  layout?: "row" | "stack";
}) {
  const stack = layout === "stack";
  const hasPhoto = Boolean(place.imageUrl);
  const distance =
    distanceLabel ??
    (km !== undefined && (
      <span className="inline-flex items-center gap-1">
        <Icon name="locate" size={15} className="shrink-0" /> {formatKm(km)} hemelsbreed
      </span>
    ));
  return (
    <article
      data-slug={place.slug}
      onMouseEnter={() => onHover?.(place.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={`group relative flex overflow-hidden rounded-2xl bg-surface transition-[box-shadow,outline-color] ${
        active ? "outline-2 outline-forest" : "outline-1 outline-line"
      } outline hover:shadow-lift ${stack ? "flex-col" : "flex-row"}`}
    >
      <div
        className={`relative shrink-0 ${
          stack ? (hasPhoto ? "aspect-[16/10]" : "aspect-[16/7]") : "w-28 self-stretch min-[400px]:w-32 sm:w-60"
        }`}
      >
        <ViewTransition name={`foto-${place.slug}`} share="photo-morph" default="none">
          <PlacePhoto src={place.imageUrl} alt={`Foto van ${place.name}`} kind={place.kind} town={place.town} className="h-full w-full" />
        </ViewTransition>
        {place.priceEur === 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-ember px-2 py-0.5 font-display text-sm font-semibold text-on-ember">Gratis</span>
        )}
      </div>
      {/* Boven de link-overlay van de titel, anders opent een tik op het hartje de plek */}
      <div className={`absolute z-10 ${stack ? "top-3 right-3" : "top-2 right-2"}`}>
        <SaveButton slug={place.slug} />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${stack ? "p-4" : "p-3 sm:p-4"}`}>
        <div className={`min-w-0 ${stack ? "pr-12" : "pr-11"}`}>
          <p className="text-sm text-muted">{place.kind ? KIND_LABEL[place.kind] : "Camperplaats"}</p>
          <h3 className={`font-display leading-snug font-semibold text-ink ${stack ? "text-xl" : "text-lg sm:text-xl"}`}>
            <Link href={`/plek/${place.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none" prefetch={false}>
              {place.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-2 sm:text-base">
            <Icon name="pin" size={15} className="shrink-0 text-muted" />
            <span className="truncate">
              {place.town}, {place.province}
            </span>
          </p>
          {distance && <p className="mt-0.5 text-sm font-semibold text-forest">{distance}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DepartureChip place={place} />
          <OpenChip place={place} />
          <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <FacilitySigns place={place} max={stack ? 5 : 4} size={stack ? 28 : 26} />
          <CardPrice place={place} />
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-2xl bg-surface outline-1 outline-line outline">
      <div className="h-40 w-28 shrink-0 animate-pulse bg-sunken min-[400px]:w-32 sm:h-48 sm:w-60" />
      <div className="flex-1 space-y-3 p-3 sm:p-4">
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

/** Vertrekregel op de kaart: groen als je kunt vertrekken wanneer je wilt */
export function DepartureChip({ place }: { place: Pick<PlaceSummary, "departure" | "checkoutUntil"> }) {
  const label = departureShort(place);
  if (!label) return null;
  const kind = departureKind(place);
  const style =
    kind === "vrij" ? "bg-forest-tint text-forest" : kind === "uitslapers" ? "bg-lake-tint text-lake" : "bg-sunken text-ink-2";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm font-semibold ${style}`}>
      <Sign name="clock" size={18} state={kind === "vroeg" ? "unknown" : "on"} tone={kind === "uitslapers" ? "lake" : "forest"} />
      {label}
    </span>
  );
}

function CardPrice({ place }: { place: PlaceSummary }) {
  const price = cardPrice(place);
  if (!price) return <p className="ml-auto max-w-20 shrink-0 text-right text-sm leading-tight text-muted">Prijs onbekend</p>;
  return (
    <div className="ml-auto shrink-0 text-right">
      {place.priceFrom && <p className="text-sm text-muted">vanaf</p>}
      <p className="font-display text-2xl leading-none font-semibold text-ink">{place.priceFrom ? price.value.replace(/^vanaf /, "") : price.value}</p>
      {(place.priceEur ?? 0) > 0 && <p className="mt-1 text-sm text-muted">per nacht{price.extras ? " + extra's" : ""}</p>}
    </div>
  );
}
