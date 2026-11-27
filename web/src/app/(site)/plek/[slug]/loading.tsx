/**
 * Direct zichtbaar bij het openen van een plek: dezelfde maten als de pagina (foto 200 px, vanaf sm 21:9, vanaf lg
 * 320 px; naam; beslisblok met vertrek, prijs en drie regels), zodat er niets verspringt (UX-audit 27 november 2026).
 */
export default function Loading() {
  return (
    <div className="pb-24 md:pb-8" aria-busy="true" aria-label="Plek laden">
      <div className="mx-auto max-w-6xl sm:px-6 sm:pt-4">
        <div className="hidden h-5 pb-3 sm:block" />
        <div className="h-[200px] animate-pulse bg-sunken sm:aspect-[21/9] sm:h-auto sm:rounded-lg lg:aspect-auto lg:h-80" />
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6 md:pt-5">
        <div className="h-8 w-3/4 animate-pulse rounded bg-sunken" />
        <div className="mt-2 h-5 w-1/2 animate-pulse rounded bg-sunken" />
        <div className="mt-2 h-4 w-40 animate-pulse rounded bg-sunken" />
        <div className="mt-4 overflow-hidden rounded-lg border border-line lg:mt-6 lg:w-[58%]">
          <div className="h-28 animate-pulse bg-sunken" />
          <div className="h-14 border-t border-line" />
          <div className="h-11 border-t border-line" />
          <div className="h-11 border-t border-line" />
          <div className="h-11 border-t border-line" />
        </div>
      </div>
    </div>
  );
}
