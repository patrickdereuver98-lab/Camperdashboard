import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinTrip } from "./join";

export const metadata: Metadata = { title: "Samen plannen", robots: { index: false } };

export default function JoinPage({ params }: PageProps<"/samen/[code]">) {
  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Samen een reis plannen</h1>
      <Suspense fallback={<p className="mt-3 text-muted">Laden…</p>}>
        <JoinTrip params={params} />
      </Suspense>
    </div>
  );
}
