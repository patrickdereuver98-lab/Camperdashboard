import type { Metadata } from "next";
import { NearbyApp } from "./nearby-app";

export const metadata: Metadata = {
  title: "Dichtbij",
  description:
    "Camperplaatsen in de buurt van je huidige locatie, gesorteerd op afstand.",
};

export default function NearbyPage() {
  return <NearbyApp />;
}
