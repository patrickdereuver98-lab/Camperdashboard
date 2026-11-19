import type { Metadata } from "next";
import { Suspense } from "react";
import { ProsePage } from "@/components/prose";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Je bent afgemeld", robots: { index: false, follow: false } };

export default function UnsubscribedPage({ searchParams }: PageProps<"/afmelden/klaar">) {
  return (
    <Suspense fallback={<p className="px-4 pt-12 text-center text-muted">Laden…</p>}>
      <Done searchParams={searchParams} />
    </Suspense>
  );
}

async function Done({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const removed = (await searchParams).plek === "weg";
  return (
    <ProsePage title="Je bent afgemeld">
      <p>
        We sturen dit e-mailadres geen mail meer.{" "}
        {removed ? "Je plek halen we van de site." : "Je plek blijft staan."} Klopt dat niet, of wil je iets anders, mail dan naar{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </ProsePage>
  );
}
