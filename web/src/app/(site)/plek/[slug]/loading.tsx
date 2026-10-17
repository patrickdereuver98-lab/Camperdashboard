/** Direct zichtbaar bij het openen van een plek: dezelfde maten als de pagina, zodat er niets verspringt */
export default function Loading() {
  return (
    <div className="pb-24 md:pb-8" aria-busy="true" aria-label="Plek laden">
      <div className="mx-auto max-w-6xl sm:px-6 sm:pt-4">
        <div className="hidden h-5 pb-3 sm:block" />
        <div className="aspect-[16/9] animate-pulse bg-sunken sm:aspect-[21/9] sm:rounded-xl" />
      </div>
      <div className="mx-auto max-w-6xl space-y-3 px-4 pt-6 sm:px-6">
        <div className="h-5 w-28 animate-pulse rounded bg-sunken" />
        <div className="h-8 w-3/4 animate-pulse rounded bg-sunken" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-sunken" />
        <div className="mt-5 h-48 animate-pulse rounded-xl bg-sunken lg:w-[58%]" />
      </div>
    </div>
  );
}
