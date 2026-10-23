import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { formatDate } from "@/lib/format";
import { getStats } from "@/lib/places";
import { Search } from "../zoeken/search";

export const metadata: Metadata = {
  title: "Camperplaatsen zonder vertrektijd",
  description: "Camperplaatsen zonder vaste vertrektijd. Je vertrekt wanneer je wilt, of je betaalt per 24 uur vanaf aankomst.",
  alternates: { canonical: "/zonder-vertrektijd" },
};

export default async function Page({ searchParams }: PageProps<"/zonder-vertrektijd">) {
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
      <Search page="vrij" searchParams={searchParams} updated={updatedAt ? formatDate(updatedAt) : undefined} />
    </Suspense>
  );
}
