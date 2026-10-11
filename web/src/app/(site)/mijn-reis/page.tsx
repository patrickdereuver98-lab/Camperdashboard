import type { Metadata } from "next";
import { Suspense } from "react";
import { TripApp } from "./trip-app";

export const metadata: Metadata = {
  title: "Mijn reis",
  description: "Je bewaarde camperplaatsen op volgorde, met echte rijtijden en een kostenoverzicht.",
};

export default function TripPage() {
  return (
    <Suspense fallback={<p className="px-6 pt-12 text-center text-muted">Je reis laden…</p>}>
      <TripApp />
    </Suspense>
  );
}
