import { connection } from "next/server";
import { getSummaries } from "@/lib/places";
import { applyFilters, filtersToQuery, parseFilters, withPage, type DeparturePage } from "@/lib/search";
import { SearchApp, type InitialResults } from "./search-app";

/** Zoveel plekken staan meteen in de HTML; de rest laadt de browser (zelfde aantal als één pagina in de lijst) */
const FIRST = 20;

/**
 * Zoek- en vertrekpagina's op de server: de eerste plekken van deze zoekopdracht staan direct in de HTML, met
 * links naar de plekpagina's. Zoekmachines zien zo welke plekken er op /zonder-vertrektijd staan, en de eerste foto
 * hoeft niet te wachten tot de hele dataset in de browser is. Daarna neemt SearchApp het over met alle plekken.
 */
export async function Search({
  page,
  updated,
  searchParams,
}: {
  page?: DeparturePage;
  updated?: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  // applyFilters kijkt naar de datum (seizoen): pas rekenen bij een echt verzoek, niet bij het prerenderen
  await connection();
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) for (const x of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, x);
  const filters = withPage(parseFilters(params), page);

  let initial: InitialResults | undefined;
  try {
    const results = applyFilters(await getSummaries(), filters);
    initial = { key: filtersToQuery(filters), results: results.slice(0, FIRST), total: results.length };
  } catch {
    // Geen data op de server: de browser laadt de lijst zoals altijd
  }
  return <SearchApp page={page} updated={updated} initial={initial} />;
}
