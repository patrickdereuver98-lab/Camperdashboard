import type { Metadata } from "next";
import Link from "next/link";
import { getFaq } from "@/lib/places";
import { FaqList } from "./faq-list";

export const metadata: Metadata = {
  title: "Veelgestelde vragen",
  description: "Antwoorden op vragen over VrijStaan, camperplaatsen, prijzen, reviews en privacy.",
  alternates: { canonical: "/veelgestelde-vragen" },
};

export default async function FaqPage() {
  const faq = await getFaq();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="font-display text-h1 font-semibold">Veelgestelde vragen</h1>
      <p className="mt-3 text-lg text-ink-2">Staat je vraag er niet bij, stel hem dan via het <Link href="/contact" className="font-semibold text-forest underline">contactformulier</Link>.</p>
      <FaqList items={faq} />
    </div>
  );
}
