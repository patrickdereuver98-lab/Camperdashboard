import type { Metadata } from "next";
import { TripApp } from "./trip-app";

export const metadata: Metadata = {
  title: "Mijn reis",
  description:
    "Je bewaarde camperplaatsen op volgorde, met afstand en een schatting van de kosten.",
};

export default function TripPage() {
  return <TripApp />;
}
