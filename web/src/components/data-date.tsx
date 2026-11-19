"use client";

import { useState } from "react";
import { dataDateText } from "@/app/(site)/mijn-reis/trip-notes";
import { refreshPlaces } from "@/lib/store";
import { Icon } from "./icons";

/**
 * "Gegevens van vandaag om 09:12 · Ververs" als de plekkenlijst uit de cache van de app komt (UX-audit G6). Als app op
 * het beginscherm kun je niet omlaag trekken om te verversen; deze knop doet dat. Vers van de server: niets.
 */
export function DataDate({ cachedAt }: { cachedAt: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const text = dataDateText(cachedAt);
  if (!text) return null;
  const refreshing = busy === cachedAt;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
      Gegevens van {text}.
      <button
        type="button"
        disabled={refreshing}
        onClick={() => {
          setBusy(cachedAt);
          refreshPlaces();
          // Geen netwerk: dan komt dezelfde bewaarde lijst terug; de knop weer vrijgeven
          setTimeout(() => setBusy(null), 10000);
        }}
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-forest hover:underline disabled:opacity-60"
      >
        <Icon name="refresh" size={15} /> {refreshing ? "Verversen…" : "Ververs"}
      </button>
    </p>
  );
}
