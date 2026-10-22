import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/places";
import { Search } from "../zoeken/search";

export const metadata: Metadata = {
  title: "Overige camperplaatsen",
  description: "Camperplaatsen waar je vóór 12:00 weg moet, en plekken waarvan de vertrektijd nog niet bekend is.",
  alternates: { canonical: "/overige-plekken" },
};

export default async function Page({ searchParams }: PageProps<"/overige-plekken">) {
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
      <Search page="overig" searchParams={searchParams} updated={updatedAt ? formatDate(updatedAt) : undefined} />
    </Suspense>
  );
}
