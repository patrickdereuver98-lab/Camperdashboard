import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmitForm } from "./submit-form";

export const metadata: Metadata = {
  title: "Plek aanmelden",
  description: "Meld een camperplaats aan of pas de gegevens van je eigen plek aan. Gratis.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Plek aanmelden</h1>
      <p className="mt-3 text-lg text-ink-2">
        Mis je een camperplaats, of ben je eigenaar? Vul in wat je zeker weet. We controleren alles voordat het online komt.
      </p>
      <Suspense>
        <SubmitForm />
      </Suspense>
    </div>
  );
}
