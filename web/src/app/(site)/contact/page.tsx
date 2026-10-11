import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact en support", description: "Stel een vraag, meld een fout of neem contact op met VrijStaan." };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <h1 className="font-sign text-3xl font-extrabold sm:text-4xl">Contact en support</h1>
      <p className="mt-3 text-lg text-ink-2">
        We reageren meestal binnen twee werkdagen. Veel antwoorden staan al bij de{" "}
        <Link href="/veelgestelde-vragen" className="font-semibold text-road underline">veelgestelde vragen</Link>.
      </p>
      <Suspense>
        <ContactForm />
      </Suspense>
    </div>
  );
}
