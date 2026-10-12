import type { Metadata } from "next";
import { Suspense } from "react";
import { StatsApp } from "./stats-app";

export const metadata: Metadata = {
  title: "Reisstatistieken",
  description: "Je reis in cijfers: kilometers, nachten, nachtprijs, nachten zonder stroom en wat je uitgaf.",
  robots: { index: false },
};

export default function StatsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6">
      <Suspense fallback={<p className="text-muted">Laden…</p>}>
        <StatsApp />
      </Suspense>
    </div>
  );
}
