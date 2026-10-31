"use client";

import { useHydrated } from "@/lib/use-media";
import { useMyLocation } from "@/lib/my-location";
import { distanceKm, formatKm } from "@/lib/geo";
import { openStatus } from "@/lib/search";
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
