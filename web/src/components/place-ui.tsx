"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, ViewTransition } from "react";
import { departureKind, FACILITIES, openStatus, type DepartureFacts } from "@/lib/search";
import { looksLikeGraphic, upgradePhotoUrl } from "@/lib/photos";
import { distanceKm, formatKm } from "@/lib/geo";
import { useMyLocation } from "@/lib/my-location";
import { arrivalText, cardPrice, departureShort, scoreLabel, scoreWord } from "@/lib/format";
import { useTrip } from "@/lib/store";
import { useHydrated } from "@/lib/use-media";
import { track } from "@/lib/track";
import { SUPABASE_URL } from "@/lib/env";
import { KIND_LABEL, type PlaceSummary } from "@/lib/types";
import { Icon } from "./icons";
import { KIND_SIGN, Sign, type SignName } from "./sign";

// ── Foto met nette terugval ─────────────────────────────────────────────────

/**
 * Externe foto's lopen via wsrv.nl: een gratis, open-source beelddienst die de foto verkleint (WebP, juiste breedte)
 * en in de cache houdt. Scheelt op een telefoon vaak megabytes per foto. Lukt dat niet, dan het origineel.
 */
export function photoProxy(src: string, width: number): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=${width}&fit=cover&output=webp&q=72&we`;
}

export function PlacePhoto({
  src,
  alt,
  kind,
  town,
  className = "",
  sizes = "small",
  eager = sizes === "large",
  onFail,
}: {
  src?: string;
  alt: string;
  kind?: string;
  town?: string;
  className?: string;
  sizes?: "small" | "large";
  /** Bovenaan de pagina: meteen laden (grootste beeld bij openen, LCP) */
  eager?: boolean;
  onFail?: () => void;
}) {
  // Volgorde: verkleinde WebP van de grote versie (wsrv.nl), de grote versie zelf, het origineel van de site.
  // wsrv.nl vergroot nooit (&we), dus de echte breedte blijft meetbaar voor de scherptecheck hieronder. Bewust geen
  // srcset: daarmee rekent de browser naturalWidth om naar schermpixels en lijkt elke foto te klein.
  const w = sizes === "large" ? 1280 : 640;
  const upgraded = src ? upgradePhotoUrl(src) : undefined;
  const ownStorage = !!src?.startsWith(`${SUPABASE_URL}/storage/`);
  const sources = src && upgraded ? [...new Set([...(ownStorage ? [] : [photoProxy(upgraded, w)]), upgraded, src])] : [];
  const [stage, setStage] = useState(0);
  const [failed, setFailed] = useState(false);
  // Logo, tekening of een foto met een heel andere verhouding: passend tonen in plaats van half bijsnijden
  const [fit, setFit] = useState<"cover" | "photo" | "graphic">(src && looksLikeGraphic(src) ? "graphic" : "cover");
  const ref = useRef<HTMLImageElement>(null);
  const current = sources[stage];
  const pos = /\babsolute\b/.test(className) ? "" : "relative";
  // Volgende bron proberen; als alle bronnen op zijn, valt de foto af (tekening of volgende foto)
  const fail = useCallback(() => setStage((s) => s + 1), []);
  const exhausted = sources.length > 0 && stage >= sources.length;
  useEffect(() => {
    if (exhausted) onFail?.();
  }, [exhausted, onFail]);
  const loaded = useCallback(() => {
    const img = ref.current;
    if (!img?.naturalWidth) return;
    // Te klein voor dit vak wordt onscherp: dan liever de tekening (kaart) of de volgende foto (galerij)
    if (img.naturalWidth < (sizes === "large" ? 640 : 320)) {
      setFailed(true);
      onFail?.();
      return;
    }
    const ratio = img.naturalWidth / img.naturalHeight;
    const box = img.parentElement ? img.parentElement.clientWidth / Math.max(1, img.parentElement.clientHeight) : 1.6;
    // Een PNG die groot is en een fotoverhouding heeft, is een foto (luchtfoto, sfeerbeeld), geen logo
    if (fit === "graphic" && src && !/logo|embleem/i.test(src) && img.naturalWidth >= 800 && ratio >= 1.2 && ratio <= 2.2) {
      setFit("cover");
      return;
    }
    // Alleen in de grote galerij; een smalle kaartfoto mag gewoon bijgesneden worden
    if (sizes === "large" && fit === "cover" && (ratio / box > 1.8 || box / ratio > 1.45)) setFit("photo");
  }, [sizes, onFail, fit, src]);
  // Een foto die al vóór de hydratatie laadde of faalde, mist het load- of error-event
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete) return;
    if (img.naturalWidth === 0) fail();
    else loaded();
  }, [fail, loaded]);
  if (!current || failed || exhausted) {
    // Geen foto: een rustig leeg vlak met het soort plek, geen tekening of nepfoto (docs/stijlgids.md §10)
    return (
      <div
        className={`${pos} flex flex-col items-center justify-center gap-1.5 overflow-hidden bg-sunken text-muted ${className}`}
        role="img"
        aria-label={`${alt} (nog geen foto)`}
      >
        <Sign name={KIND_SIGN[kind ?? "camperplaats"] ?? "camper"} size={sizes === "large" ? 36 : 28} state="unknown" />
        {sizes === "large" && <span className="text-sm">Nog geen foto{town ? ` van deze plek in ${town}` : ""}</span>}
      </div>
    );
  }
  return (
    <div className={`${pos} overflow-hidden ${fit === "graphic" ? "bg-surface" : "bg-sunken"} ${className}`}>
      {/* Bij een passend getoonde foto vult een vervaagde kopie de randen, zodat er geen lege balken staan */}
      {fit === "photo" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={current} alt="" aria-hidden="true" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        key={current}
        src={current}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={fail}
        onLoad={loaded}
        className={`relative h-full w-full ${fit === "cover" ? "object-cover" : fit === "graphic" ? "object-contain p-[8%]" : "object-contain"}`}
      />
    </div>
  );
}

/** Foto met bronvermelding; de vermelding verdwijnt als de foto niet laadt (dan staat er een tekening) */
export function CreditedPhoto({ src, alt, credit, className = "" }: { src?: string; alt: string; credit?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  return (
    <>
      <PlacePhoto src={src} alt={alt} className={className} onFail={onFail} />
      {src && credit && !failed && (
        <span className="absolute top-2 right-2 max-w-[70%] truncate rounded-md bg-black/55 px-2 py-0.5 text-xs text-white">
          Foto: {credit}
        </span>
      )}
    </>
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
        <span className="block text-sm text-muted">
          {count} {count === 1 ? "review" : "reviews"}
        </span>
      </span>
    </span>
  );
}

// ── Bewaren ─────────────────────────────────────────────────────────────────

export function SaveButton({ slug, variant = "icon" }: { slug: string; variant?: "icon" | "full" | "plain" }) {
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
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold transition-colors hover:border-forest aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
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
      className={`grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-90 ${variant === "plain" ? "" : "bg-surface/95 shadow-lift"}`}
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
export function OpenChip({ place, onlyClosed = false }: { place: Pick<PlaceSummary, "openAllYear" | "season">; onlyClosed?: boolean }) {
  // "Nu open" hangt af van de datum van de bezoeker: pas na hydratatie berekenen
  const hydrated = useHydrated();
  const status = hydrated ? openStatus(place) : undefined;
  if (!status || (onlyClosed && status.open)) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${status.open ? "text-forest" : "text-alert"}`}>
      <span className={`h-2 w-2 rounded-full ${status.open ? "bg-forest" : "bg-alert"}`} aria-hidden="true" />
      {status.label}
    </span>
  );
}

/** Aankomst of toegang in een paar woorden, alleen wat de bron noemt */
function arrivalShort(p: Pick<PlaceSummary, "checkinFrom" | "checkinUntil" | "access24h" | "accessHours">): string | undefined {
  const arrival = arrivalText(p);
  if (arrival) return arrival;
  if (p.access24h) return "Dag en nacht open";
  if (p.accessHours) return `Poort open ${p.accessHours}`;
  return undefined;
}

export function PlaceCard({
  place,
  km,
  distanceLabel,
  active,
  onHover,
  layout = "row",
  eager,
}: {
  place: PlaceSummary;
  km?: number;
  /** Eigen afstandstekst (bijv. echte rijtijd); vervangt de hemelsbrede afstand */
  distanceLabel?: React.ReactNode;
  active?: boolean;
  onHover?: (slug: string | null) => void;
  layout?: "row" | "stack";
  /** Eerste kaarten van een lijst: foto meteen laden */
  eager?: boolean;
}) {
  const stack = layout === "stack";
  const hasPhoto = Boolean(place.imageUrl);
  // Afstand: rijtijd van de pagina, anders vanaf je eigen locatie (blijft op het apparaat), anders vanaf de zoekplek
  const me = useMyLocation().pos;
  const fromMe = me ? distanceKm(me, place) : undefined;
  const distance =
    distanceLabel ??
    (fromMe !== undefined ? (
      <span className="inline-flex items-center gap-1">
        <Icon name="locate" size={14} className="shrink-0" /> {formatKm(fromMe)} van je locatie
      </span>
    ) : (
      km !== undefined && (
        <span className="inline-flex items-center gap-1">
          <Icon name="locate" size={14} className="shrink-0" /> {formatKm(km)} hemelsbreed
        </span>
      )
    ));
  const arrival = arrivalShort(place);
  return (
    <article
      data-slug={place.slug}
      onMouseEnter={() => onHover?.(place.slug)}
      onMouseLeave={() => onHover?.(null)}
      className={`lift group relative flex overflow-hidden rounded-xl bg-surface ${
        active ? "shadow-raised outline-2 outline-forest" : "shadow-low outline-0 outline-transparent"
      } has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-forest outline ${stack ? "flex-col" : "flex-row"}`}
    >
      <div
        className={`relative shrink-0 ${
          stack ? (hasPhoto ? "aspect-[16/10]" : "aspect-[16/7]") : "w-[32%] max-w-36 self-stretch sm:w-56 sm:max-w-none"
        }`}
      >
        <ViewTransition name={`foto-${place.slug}`} share="photo-morph" default="none">
          <PlacePhoto src={place.imageUrl} alt={`Foto van ${place.name}`} kind={place.kind} town={place.town} eager={eager} className="h-full w-full" />
        </ViewTransition>
        {place.priceEur === 0 && (
          <span className="absolute top-2 left-2 rounded-md bg-ember px-2 py-0.5 font-display text-sm font-semibold text-on-ember">Gratis</span>
        )}
      </div>
      {/* Boven de link-overlay van de titel, anders opent een tik op het hartje de plek */}
      <div className={`absolute z-10 ${stack ? "top-3 right-3" : "top-0.5 right-0.5 sm:top-2 sm:right-2"}`}>
        <SaveButton slug={place.slug} variant={stack ? "icon" : "plain"} />
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${stack ? "gap-2 p-4" : "gap-2 py-2.5 pr-3 pl-3 sm:p-4"}`}>
        {/* Waar: naam, soort en plaats, afstand */}
        <div className={`min-w-0 ${stack ? "pr-12" : "pr-8 sm:pr-11"}`}>
          <h3 className={`font-display leading-snug font-semibold text-ink ${stack ? "text-xl" : "text-[1.0625rem] sm:text-xl"}`}>
            <Link href={`/plek/${place.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none" prefetch={false}>
              {place.name}
            </Link>
          </h3>
          <p className="truncate text-sm text-ink-2" title={`${place.town}, ${place.province}`}>
            {place.kind ? KIND_LABEL[place.kind] : "Camperplaats"} in {place.town}
          </p>
          {distance && <p className="text-sm font-semibold text-forest">{distance}</p>}
        </div>

        {/* Wanneer: vertrekken en aankomen, en alleen een seizoensmelding als het nu dicht is */}
        {(departureShort(place) || arrival) && (
          <div className="min-w-0 space-y-0.5">
            <DepartureChip place={place} />
            {arrival && <p className="text-sm text-ink-2">{arrival}</p>}
          </div>
        )}
        <OpenChip place={place} onlyClosed={!stack} />
        {place.ratingCount > 0 && <ScoreBadge avg={place.ratingAvg} count={place.ratingCount} />}

        {/* Wat en hoeveel: voorzieningen links, prijs rechts */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
          <FacilitySigns place={place} max={stack ? 5 : 3} size={stack ? 26 : 22} />
          <CardPrice place={place} />
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-xl bg-surface shadow-low">
      <div className="h-36 w-[34%] max-w-36 shrink-0 animate-pulse bg-sunken sm:h-48 sm:w-60 sm:max-w-none" />
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
export function DepartureChip({ place }: { place: DepartureFacts }) {
  const label = departureShort(place);
  if (!label) return null;
  const kind = departureKind(place);
  // Groen bij geen vaste vertrektijd (een bron is genoeg); met voorwaarde of afgewezen valt het onder "onbekend"
  const style = kind === "vrij" ? "bg-forest-tint text-forest" : kind === "uitslapers" ? "bg-lake-tint text-lake" : "bg-sunken text-ink-2";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm leading-tight font-semibold ${style}`}>
      <Sign name="clock" size={16} state={kind === "vrij" || kind === "uitslapers" ? "on" : "unknown"} tone={kind === "uitslapers" ? "lake" : "forest"} />
      {label}
    </span>
  );
}

function CardPrice({ place }: { place: PlaceSummary }) {
  const price = cardPrice(place);
  if (!price) return <p className="ml-auto max-w-20 shrink-0 text-right text-sm leading-tight text-muted">Prijs onbekend</p>;
  // Toeslagen bekend (toeristenbelasting apart, extra persoon, hond …): klein onder de prijs, details op de plekpagina
  const surcharges = price.extras || place.touristTaxIncluded === false;
  return (
    <div className="ml-auto shrink-0 text-right leading-tight">
      {place.priceFrom && <p className="text-sm text-muted">vanaf</p>}
      <p className="font-display text-xl leading-none font-semibold text-ink sm:text-2xl">{place.priceFrom ? price.value.replace(/^vanaf /, "") : price.value}</p>
      {price.perNight && <p className="mt-0.5 text-sm text-muted">per nacht</p>}
      {surcharges && <p className="text-sm text-muted">+ toeslagen</p>}
    </div>
  );
}
