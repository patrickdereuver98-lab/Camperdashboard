import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { SearchApp } from "../zoeken/search-app";

export const metadata: Metadata = {
  title: "Overige camperplaatsen",
  description: "Camperplaatsen met een vertrektijd vóór 12:00 of waarvan de vertrektijd nog onbekend is.",
  alternates: { canonical: "/overige-plekken" },
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
      <SearchApp page="overig" />
    </Suspense>
  );
}
