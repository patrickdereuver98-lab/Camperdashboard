import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-bits";
import { SearchApp } from "./search-app";

export const metadata: Metadata = {
  title: "Zoeken",
  description:
    "Zoek camperplaatsen op plaats, provincie en voorzieningen, op de kaart of in een lijst.",
};

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 px-4 pt-24 sm:px-6 lg:w-1/2">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      }
    >
      <SearchApp />
    </Suspense>
  );
}
