"use client";

import { useEffect, useRef } from "react";

/**
 * Een open sheet heeft een eigen stap in de browsergeschiedenis, zodat terugvegen (iPhone) of de terugknop (Android)
 * eerst de sheet sluit in plaats van de pagina te verlaten (UX-audit november, G1). Sluit je de sheet zelf (×, vegen,
 * Escape), dan halen we die stap weer weg met `history.back()`. Dat gaat niet meteen: de browser meldt het later met
 * `popstate`. Wie na het sluiten het adres verandert (Filters → Toon plekken), wacht daarop met `afterSheetClose`,
 * anders zou de terugstap de nieuwe filters ongedaan maken.
 */

export const SHEET_STATE_KEY = "vrijstaanSheet";

let waiting: (() => void)[] | null = null;

/** De stap van de sheet weghalen; wat in de wachtrij staat, draait zodra de browser terug is */
export function backFromSheet() {
  waiting = waiting ?? [];
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", finish);
    const run = waiting ?? [];
    waiting = null;
    for (const fn of run) fn();
  };
  window.addEventListener("popstate", finish);
  // Komt er geen popstate (zou niet moeten), dan blijft de wachtrij niet hangen
  setTimeout(finish, 600);
  history.back();
}

/** Draai `fn` pas als een sheet die nu sluit zijn stap uit de geschiedenis heeft gehaald (of meteen als er niets is) */
export function afterSheetClose(fn: () => void) {
  // De sheet sluit pas bij de volgende commit van React; even wachten tot de terugstap is gestart
  setTimeout(() => (waiting ? waiting.push(fn) : fn()), 0);
}

/**
 * Terug (vegen of knop) sluit dit eerst: sheets, de schermvullende foto's en het snelmenu van een plekkaart. Zet bij
 * openen een eigen stap in de geschiedenis en haalt die weer weg als je het zelf sluit.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    // Pas na een tik, zodat de dubbele effecten van StrictMode geen stap toevoegen en weer weghalen
    const token = Math.random().toString(36).slice(2);
    let pushed = false;
    let popped = false;
    const push = setTimeout(() => {
      history.pushState({ [SHEET_STATE_KEY]: token }, "");
      pushed = true;
    }, 0);
    const onPop = () => {
      if (history.state?.[SHEET_STATE_KEY] === token) return;
      popped = true;
      close.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(push);
      window.removeEventListener("popstate", onPop);
      // Zelf gesloten: de stap weer weghalen, maar alleen als hij nog bovenaan staat. Ging je met een link naar een
      // andere pagina, dan staat daar nu die pagina en blijft alles zoals het is.
      if (pushed && !popped && history.state?.[SHEET_STATE_KEY] === token) backFromSheet();
    };
  }, [open]);
}
