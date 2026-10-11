import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketView } from "./ticket-view";

export const metadata: Metadata = { title: "Je bericht", robots: { index: false, follow: false } };

export default function TicketPage({ params }: PageProps<"/support/[token]">) {
  return (
    <Suspense fallback={<p className="px-4 pt-12 text-center text-muted">Bericht laden…</p>}>
      <TicketView params={params} />
    </Suspense>
  );
}
