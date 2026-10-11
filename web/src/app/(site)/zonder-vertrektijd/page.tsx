import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { SearchApp } from "../zoeken/search-app";

export const metadata: Metadata = {
  title: "Camperplaatsen zonder vertrektijd",
  description: "Camperplaatsen waar je volgens de eigen website vertrekt wanneer je wilt, of 24 uur mag blijven vanaf aankomst. Met de bronzin als bewijs.",
  alternates: { canonical: "/zonder-vertrektijd" },
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
      <SearchApp page="vrij" />
    </Suspense>
  );
}
