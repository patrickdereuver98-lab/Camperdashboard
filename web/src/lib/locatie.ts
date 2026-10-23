import { cacheLife } from "next/cache";
import { OFFLINE_BUILD } from "./env";
import { fetchLookup, fetchSuggest, type Location } from "./pdok";

// Korte cache per zoekterm: dezelfde letters bij veel bezoekers gaan maar één keer naar PDOK. Een fout wordt niet
// gecachet (de functie gooit), zodat het na een storing vanzelf weer werkt. Offline (VRIJSTAAN_OFFLINE=1) geen PDOK.

export async function suggestLocations(q: string): Promise<Location[]> {
  "use cache";
  cacheLife("hours");
  if (OFFLINE_BUILD) throw new Error("Offline: geen PDOK");
  return fetchSuggest(q);
}

export async function lookupLocation(id: string): Promise<Location | null> {
  "use cache";
  cacheLife("days");
  if (OFFLINE_BUILD) throw new Error("Offline: geen PDOK");
  return fetchLookup(id);
}
