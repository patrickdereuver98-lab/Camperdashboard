import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/places";
import { SearchApp } from "./search-app";

export const metadata: Metadata = {
  title: "Camperplaats zoeken",
  description: "Zoek camperplaatsen op plaats, provincie, vertrektijd, voorzieningen en prijs.",
};

export default async function SearchPage() {
  const { updatedAt } = await getStats();
  return (
    <Suspense
      fallback={
        <div className="space-y-3 px-3 pt-28 sm:px-6 lg:w-[54%]">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <SearchApp updated={updatedAt ? formatDate(updatedAt) : undefined} />
    </Suspense>
  );
}
