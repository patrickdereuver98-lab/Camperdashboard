import type { Metadata } from "next";
import { departureMetadata, departureParams, DepartureProvincePage } from "@/components/departure-province";

export function generateStaticParams() {
  return departureParams();
}

export async function generateMetadata({ params }: PageProps<"/uitslapers/[provincie]">): Promise<Metadata> {
  return departureMetadata("uitslapers", (await params).provincie);
}

export default async function Page({ params }: PageProps<"/uitslapers/[provincie]">) {
  return <DepartureProvincePage group="uitslapers" slug={(await params).provincie} />;
}
