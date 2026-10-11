import type { Metadata } from "next";
import { NearbyApp } from "./nearby-app";

export const metadata: Metadata = {
  title: "Camperplaatsen dichtbij",
  description: "Vind camperplaatsen bij jou in de buurt, gesorteerd op echte rijtijd.",
};

export default function NearbyPage() {
  return <NearbyApp />;
}
