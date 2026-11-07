"use client";

import { useState } from "react";
import { useStorageFailed } from "@/lib/store";
import { Icon } from "./icons";

/**
 * Eén keer per bezoek een melding als opslaan op dit toestel niet lukt (privévenster, volle of geblokkeerde opslag).
 * Bewaren werkt dan nog wel, maar alleen in het geheugen: na sluiten van de pagina is het weg.
 */
export function StorageNotice() {
  const failed = useStorageFailed();
  const [closed, setClosed] = useState(false);
  if (!failed || closed) return null;
  return (
    <div
      role="status"
      data-testid="storage-notice"
      className="animate-toast fixed top-[calc(4rem+env(safe-area-inset-top))] left-1/2 z-50 flex w-[min(92vw,28rem)] items-start gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-surface shadow-float sm:top-20"
    >
      <Icon name="info" size={20} className="mt-2.5 shrink-0" />
      <p className="min-w-0 flex-1 py-2">Opslaan op dit toestel lukt niet. Je reis blijft alleen tijdens dit bezoek bewaard.</p>
      <button type="button" onClick={() => setClosed(true)} aria-label="Melding sluiten" className="grid h-11 w-11 shrink-0 place-items-center rounded-md">
        <Icon name="x" size={20} />
      </button>
    </div>
  );
}
