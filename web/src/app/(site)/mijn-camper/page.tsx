import type { Metadata } from "next";
import { VehicleApp } from "./vehicle-app";

export const metadata: Metadata = {
  title: "Mijn camper",
  description: "Sla de maten van je camper op. Bij het zoeken zie je dan alleen plekken waar hij past.",
  robots: { index: false },
};

export default function VehiclePage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Mijn camper</h1>
      <p className="mt-3 text-lg text-ink-2">Vul de maten van je camper in. Bij het zoeken laten we dan plekken weg waar hij niet past.</p>
      <VehicleApp />
    </div>
  );
}
