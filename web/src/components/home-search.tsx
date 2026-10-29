import Link from "next/link";
import { DEFAULT_FILTERS } from "@/lib/search";
import { DestinationSearch } from "./destination-search";
import { Icon } from "./icons";

/**
 * Startpagina (concept "Eén vraag", 29 oktober 2026): de hoofdactie is "Plekken bij mij in de buurt" in avondzon,
 * daaronder één zoekveld. De keuze voor vertrektijd staat in "Hoe wil je staan?" direct eronder.
 */
export function HomeSearch() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
      <Link
        href="/dichtbij"
        className="flex h-14 shrink-0 items-center justify-center gap-2 rounded-lg bg-ember px-6 text-[17px] font-semibold text-on-ember shadow-float transition-[filter] duration-200 hover:brightness-105 active:scale-[0.98] lg:h-auto"
      >
        <Icon name="locate" size={22} /> Plekken bij mij in de buurt
      </Link>
      {/* Eén regel: zoekveld en knop naast elkaar, zodat "Hoe wil je staan?" op de telefoon in beeld blijft */}
      <div className="min-w-0 flex-1">
        <DestinationSearch variant="bar" base={DEFAULT_FILTERS} />
      </div>
    </div>
  );
}
