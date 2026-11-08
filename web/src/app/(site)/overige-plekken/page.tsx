import type { Metadata } from "next";
import { Suspense } from "react";
import { CardSkeleton } from "@/components/place-ui";
import { HubIntro, ProvinceLinks } from "@/components/seo-ui";
import { formatDate } from "@/lib/format";
import { getStats, getSummaries } from "@/lib/places";
import { filterRobots, hubIntro, provinceLinks } from "@/lib/seo-pages";
import { PlacesPreload, Search } from "../zoeken/search";

// Met zoekparameters (filters, provincie, kaart) wel volgen, niet indexeren; de canonical is altijd het kale adres
export async function generateMetadata({ searchParams }: PageProps<"/overige-plekken">): Promise<Metadata> {
  const robots = filterRobots(await searchParams);
  return {
    title: "Overige camperplaatsen",
    description: "Camperplaatsen waar je vóór 12:00 weg moet, en plekken waarvan de vertrektijd nog niet bekend is.",
    alternates: { canonical: "/overige-plekken" },
    ...(robots ? { robots } : {}),
  };
}

export default async function Page({ searchParams }: PageProps<"/overige-plekken">) {
  const [{ updatedAt }, all] = await Promise.all([getStats(), getSummaries()]);
  return (
    <>
      <PlacesPreload />
      <HubIntro {...hubIntro("overig", all)} link={{ href: "/doe-mee", label: "Vertrektijd doorgeven" }} />
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
      <ProvinceLinks links={provinceLinks(all, "overig")} />
    </>
  );
}
