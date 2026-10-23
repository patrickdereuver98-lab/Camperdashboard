import type { Metadata } from "next";
import { departureMetadata, departureParams, DepartureProvincePage } from "@/components/departure-province";

export function generateStaticParams() {
  return departureParams();
}

export async function generateMetadata({ params }: PageProps<"/zonder-vertrektijd/[provincie]">): Promise<Metadata> {
  return departureMetadata("vrij", (await params).provincie);
}

export default async function Page({ params }: PageProps<"/zonder-vertrektijd/[provincie]">) {
  return <DepartureProvincePage group="vrij" slug={(await params).provincie} />;
}
