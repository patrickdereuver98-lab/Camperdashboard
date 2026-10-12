import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Inloggen",
  description: "Log in met Google, Apple, Facebook of je e-mailadres en bewaar je reis op al je apparaten.",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Inloggen</h1>
      <p className="mt-3 text-lg text-ink-2">Bewaar je reis en plekken op al je apparaten. Geen wachtwoord nodig.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
