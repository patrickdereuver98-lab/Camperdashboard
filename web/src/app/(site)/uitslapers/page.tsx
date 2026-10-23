import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/places";
import { Search } from "../zoeken/search";

export const metadata: Metadata = {
  title: "Camperplaatsen voor uitslapers",
  description: "Camperplaatsen waar je pas om 12:00 of later weg hoeft.",
  alternates: { canonical: "/uitslapers" },
};

export default async function Page({ searchParams }: PageProps<"/uitslapers">) {
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
      <Search page="uitslapers" searchParams={searchParams} updated={updatedAt ? formatDate(updatedAt) : undefined} />
    </Suspense>
  );
}
