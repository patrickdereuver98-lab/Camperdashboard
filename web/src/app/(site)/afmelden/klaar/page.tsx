import type { Metadata } from "next";
import { ProsePage } from "@/components/prose";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Je bent afgemeld", robots: { index: false, follow: false } };

export default function UnsubscribedPage() {
  return (
    <ProsePage title="Je bent afgemeld">
      <p>
        We sturen dit e-mailadres geen mail meer. Staat er iets niet goed bij je plek op VrijStaan, mail dan naar{" "}
        <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>
    </ProsePage>
  );
}
