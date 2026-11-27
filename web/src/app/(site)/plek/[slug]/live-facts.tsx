"use client";

import { useHydrated } from "@/lib/use-media";
import { useMyLocation } from "@/lib/my-location";
import { distanceKm, formatKm } from "@/lib/geo";
import { isOpenOn, nowInNL, openStatus } from "@/lib/search";
import { arrivalToday } from "@/lib/arrival-today";
import { readResultOrder } from "@/lib/last-search";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import type { Place } from "@/lib/types";

/** "Nu open" hangt af van de datum van de bezoeker: pas na hydratatie berekenen (daarvoor het seizoen) */
export function OpenValue({ place }: { place: Pick<Place, "openAllYear" | "season"> }) {
  const hydrated = useHydrated();
  const status = hydrated ? openStatus(place) : undefined;
  if (!place.openAllYear && !place.season) return <span className="text-muted">Onbekend</span>;
  if (!status) return <span>{place.openAllYear ? "Hele jaar" : place.season?.replace(" – ", " t/m ")}</span>;
  return <span className={status.open ? "text-ink" : "text-alert"}>{status.label}</span>;
}

/** Afstand vanaf je eigen locatie, alleen als je die al hebt gedeeld (we vragen er hier niet om) */
export function DistanceFromMe({ place }: { place: Pick<Place, "lat" | "lng"> }) {
  const { pos } = useMyLocation();
  if (!pos) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-forest">
      <Icon name="locate" size={15} /> {formatKm(distanceKm(pos, place))} van je locatie
    </span>
  );
}

/** "Nog 2 uur om vandaag aan te komen" (UX-audit): pas na hydratatie, met de klok in Nederland */
export function ArrivalTodayNote({ place }: { place: Pick<Place, "checkinFrom" | "checkinUntil" | "access24h" | "openAllYear" | "season"> }) {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  // Volgens het seizoen dicht: dan zegt de klok niets
  if (isOpenOn(place) === false) return null;
  const now = nowInNL();
  const note = arrivalToday(place, now.getHours() * 60 + now.getMinutes());
  if (!note) return null;
  return (
    <p role="status" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${note.closed ? "bg-alert-tint text-alert" : "bg-forest-tint text-forest"}`}>
      <Icon name="clock" size={17} className="shrink-0" /> {note.text}
    </p>
  );
}

/** Kopieerknop naast het adres; het adres zelf staat ernaast als tekst */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          // Geen toegang tot het klembord: het adres staat er als tekst, selecteren kan altijd
        }
      }}
      aria-label={done ? "Gekopieerd" : label}
      className="-my-2 ml-1 inline-grid h-11 w-11 shrink-0 place-items-center rounded-lg align-middle text-forest hover:bg-sunken"
    >
      <Icon name={done ? "check" : "copy"} size={17} />
    </button>
  );
}

/**
 * "Vorige" en "Volgende" uit je laatste zoekresultaten (UX-audit), zodat je niet heen en weer hoeft. Alleen als je
 * via die lijst op deze plek kwam (de plek staat erin).
 */
export function ResultsNav({ slug }: { slug: string }) {
  const hydrated = useHydrated();
  const order = hydrated ? readResultOrder() : null;
  const i = order ? order.items.findIndex((x) => x.slug === slug) : -1;
  if (!order || i < 0 || order.items.length < 2) return null;
  const prev = order.items[i - 1];
  const next = order.items[i + 1];
  return (
    <nav aria-label="Zoekresultaten" className="flex items-center justify-between gap-2 border-b border-line bg-surface px-1 text-sm sm:mb-1 sm:border-0 sm:bg-transparent sm:px-0">
      {prev ? (
        <Link href={`/plek/${prev.slug}`} className="flex min-h-11 min-w-0 flex-1 items-center gap-1 px-2 font-semibold text-forest">
          <Icon name="chevronLeft" size={17} className="shrink-0" /> <span className="truncate">{prev.name}</span>
        </Link>
      ) : (
        <span className="flex-1" />
      )}
      <Link href={order.href} className="flex min-h-11 shrink-0 items-center px-2 text-muted tabular-nums hover:underline">
        {i + 1} van {order.items.length}
      </Link>
      {next ? (
        <Link href={`/plek/${next.slug}`} className="flex min-h-11 min-w-0 flex-1 items-center justify-end gap-1 px-2 text-right font-semibold text-forest">
          <span className="truncate">{next.name}</span> <Icon name="chevronRight" size={17} className="shrink-0" />
        </Link>
      ) : (
        <span className="flex-1" />
      )}
    </nav>
  );
}

/**
 * Vaste balk onderaan op de telefoon (UX-audit 27 november, K4): Route openen staat er altijd; de prijs verschijnt pas
 * als de prijs in het beslisblok uit beeld is, zodat hij niet twee keer tegelijk in beeld staat. De ruimte voor de
 * prijs is er altijd (alleen onzichtbaar), dus de knop verspringt niet.
 */
export function StickyRouteBar({ price, priceSub, known, children }: { price: string; priceSub?: string; known: boolean; children: React.ReactNode }) {
  const [showPrice, setShowPrice] = useState(false);
  useEffect(() => {
    const el = document.querySelector('[data-testid="decision-price"]');
    if (!el || !("IntersectionObserver" in window)) return;
    // Alleen tonen als de prijs boven de rand is weggescrold, niet als hij nog onder de balk ligt
    const io = new IntersectionObserver(([e]) => setShowPrice(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden" data-testid="sticky-route">
      <div className="flex items-center gap-3">
        <div className={`min-w-0 shrink-0 transition-opacity duration-150 motion-reduce:transition-none ${showPrice ? "opacity-100" : "invisible opacity-0"}`} aria-hidden={!showPrice} data-testid="sticky-price">
          <p className={`font-display leading-none font-semibold ${known ? "text-lg" : "text-sm text-muted"}`}>{price}</p>
          {priceSub && <p className="mt-0.5 text-sm leading-tight whitespace-nowrap text-muted">{priceSub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
