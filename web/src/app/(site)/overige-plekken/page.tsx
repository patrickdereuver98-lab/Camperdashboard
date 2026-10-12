import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/places";
import { SearchApp } from "../zoeken/search-app";

export const metadata: Metadata = {
  title: "Overige camperplaatsen",
  description: "Camperplaatsen waar je vóór 12:00 weg moet, en plekken waarvan de vertrektijd nog niet bekend is.",
  alternates: { canonical: "/overige-plekken" },
};

export default async function Page() {
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
      <SearchApp page="overig" updated={updatedAt ? formatDate(updatedAt) : undefined} />
    </Suspense>
  );
}
