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
