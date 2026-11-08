"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
};

// motion (±50 KB gz) zit alleen in het paneel; dat komt pas binnen als een sheet voor het eerst opengaat (R34)
const SheetPanel = lazy(() => import("./sheet-panel").then((m) => ({ default: m.SheetPanel })));

/**
 * Bottom sheet op mobiel, gecentreerd paneel op grotere schermen.
 * Omlaag vegen of Escape sluit. Focus blijft binnen het paneel.
 * Na de eerste keer openen blijft het paneel staan, zodat het ook netjes wegschuift bij sluiten.
 */
export function Sheet(props: SheetProps) {
  const [used, setUsed] = useState(props.open);
  if (props.open && !used) setUsed(true);
  if (!used) return null;
  return (
    <Suspense fallback={null}>
      <SheetPanel {...props} />
    </Suspense>
  );
}
