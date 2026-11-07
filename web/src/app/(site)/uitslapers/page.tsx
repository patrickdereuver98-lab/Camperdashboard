import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { HubIntro, ProvinceLinks } from "@/components/seo-ui";
import { formatDate } from "@/lib/format";
import { getStats, getSummaries } from "@/lib/places";
import { filterRobots, hubIntro, provinceLinks } from "@/lib/seo-pages";
import { Search } from "../zoeken/search";

// Met zoekparameters (filters, provincie, kaart) wel volgen, niet indexeren; de canonical is altijd het kale adres
export async function generateMetadata({ searchParams }: PageProps<"/uitslapers">): Promise<Metadata> {
  const robots = filterRobots(await searchParams);
  return {
    title: "Camperplaatsen voor uitslapers",
    description: "Camperplaatsen waar je pas om 12:00 of later weg hoeft.",
    alternates: { canonical: "/uitslapers" },
    ...(robots ? { robots } : {}),
  };
}

export default async function Page({ searchParams }: PageProps<"/uitslapers">) {
  const [{ updatedAt }, all] = await Promise.all([getStats(), getSummaries()]);
  return (
    <>
      <HubIntro {...hubIntro("uitslapers", all)} />
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
      <ProvinceLinks links={provinceLinks(all, "uitslapers")} />
    </>
  );
}
