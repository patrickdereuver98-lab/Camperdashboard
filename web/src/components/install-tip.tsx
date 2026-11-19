"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConsent, useWelcomeSeen } from "@/lib/store";
import { Icon } from "./icons";

const KEY = "vrijstaan:tip-beginscherm";

/**
 * Eén keer een tip voor iPhone-gebruikers in Safari die VrijStaan nog niet op hun beginscherm hebben (UX-audit). Pas
 * na de welkomstuitleg en de cookiekeuze, zodat er nooit twee dingen tegelijk om aandacht vragen. Weggeklikt = weg.
 */
export function InstallTip() {
  const welcomed = useWelcomeSeen();
  const consent = useConsent();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!welcomed || !consent) return;
    const nav = navigator as Navigator & { standalone?: boolean };
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = nav.standalone || window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = true;
    try {
      dismissed = localStorage.getItem(KEY) !== null;
    } catch {
      // Geen opslag: dan ook geen tip (anders komt hij elke keer terug)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- toestel en opslag bestaan pas in de browser
    if (ios && !installed && !dismissed) setShow(true);
  }, [welcomed, consent]);
  if (!show) return null;
  const hide = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Niet bewaard: dan alleen voor nu weg
    }
  };
  return (
    <aside aria-label="Tip" className="mx-auto mt-4 flex max-w-6xl items-start gap-3 rounded-lg border border-line bg-surface p-4 sm:mx-6 lg:mx-auto">
      <Icon name="share" size={22} className="mt-0.5 shrink-0 text-forest" />
      <p className="min-w-0 flex-1 text-ink-2">
        Zet VrijStaan op je beginscherm: tik in Safari op Delen en kies <strong>Zet op beginscherm</strong>. Dan opent Mijn
        reis ook zonder bereik.{" "}
        <Link href="/veelgestelde-vragen" className="font-semibold text-forest underline underline-offset-2">
          Hoe werkt dat?
        </Link>
      </p>
      <button type="button" onClick={hide} aria-label="Tip sluiten" className="-mt-2 -mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-sunken">
        <Icon name="x" size={18} />
      </button>
    </aside>
  );
}
