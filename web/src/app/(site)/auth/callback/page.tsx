import type { Metadata } from "next";
import { Suspense } from "react";
import { Callback } from "./callback";

export const metadata: Metadata = { title: "Inloggen", robots: { index: false } };

export default function CallbackPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-16 text-center sm:px-6">
      <Suspense>
        <Callback />
      </Suspense>
    </div>
  );
}
