"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { parseSharedLocation } from "@/lib/shared-location";
import { searchHref } from "@/lib/search";
import { DestinationSearch } from "@/components/destination-search";

/**
 * Een gedeelde locatie (Google Maps, WhatsApp): met een punt meteen naar Zoeken rond dat punt; met alleen een naam het
 * zoekvak met die naam erin, zodat je zelf kiest. Niets bruikbaars: gewoon het zoekvak.
 */
export function SharedIn() {
  const params = useSearchParams();
  const router = useRouter();
  const found = parseSharedLocation({ title: params.get("title"), text: params.get("text"), url: params.get("url") });
  const point = found?.kind === "point" ? found : null;

  const lat = point?.lat;
  const lng = point?.lng;
  const label = point?.label;
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) router.replace(searchHref({ where: label ?? "Gedeelde locatie", center: { lat, lng }, sort: "afstand" }));
  }, [lat, lng, label, router]);

  if (point) return <p className="mt-3 text-muted">Plekken rond de gedeelde locatie zoeken…</p>;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-ink-2">
        {found ? "Uit wat je deelde kunnen we geen precieze plek halen. Klopt de naam hieronder? Kies dan een suggestie." : "Uit wat je deelde kunnen we geen plek halen. Typ een plaats, adres of postcode."}
      </p>
      <DestinationSearch initial={found?.kind === "text" ? found.text : ""} />
    </div>
  );
}
