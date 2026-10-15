import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { COMPANY } from "@/lib/company";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact en support", description: "Stel een vraag, meld een fout of neem contact op met VrijStaan." };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Contact en support</h1>
      <p className="mt-3 text-lg text-ink-2">
        We reageren meestal binnen twee werkdagen. Veel antwoorden staan al bij de{" "}
        <Link href="/veelgestelde-vragen" className="font-semibold text-forest underline">veelgestelde vragen</Link>.
      </p>
      <p className="mt-2 text-ink-2">
        Liever mailen? Dat kan naar{" "}
        <a href={`mailto:${COMPANY.email}`} className="font-semibold text-forest underline">{COMPANY.email}</a>.
      </p>
      <Suspense>
        <ContactForm />
      </Suspense>
    </div>
  );
}
