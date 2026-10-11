import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { SearchApp } from "../zoeken/search-app";

export const metadata: Metadata = {
  title: "Camperplaatsen voor uitslapers",
  description: "Camperplaatsen waar je volgens de eigen website tot 12:00 of later mag blijven staan. Met de bronzin als bewijs.",
  alternates: { canonical: "/uitslapers" },
};

export default function Page() {
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
      <SearchApp page="uitslapers" />
    </Suspense>
  );
}
