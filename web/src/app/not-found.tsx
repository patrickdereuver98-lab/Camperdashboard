import Link from "next/link";
import { Landscape } from "@/components/landscape";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-12 pb-16 text-center">
      <div className="overflow-hidden rounded-[2rem] shadow-lift">
        <Landscape seed="verdwaald" variant={3} className="h-52 w-full" />
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold text-ink">
        Verkeerd afgeslagen
      </h1>
      <p className="mt-3 text-lg text-ink-soft">
        Deze pagina bestaat niet (meer). Misschien is de plek hernoemd.
      </p>
      <Link
        href="/zoeken"
        className="mt-8 inline-flex rounded-full bg-forest px-7 py-4 font-semibold text-on-forest transition hover:bg-forest-deep"
      >
        Terug naar zoeken
      </Link>
    </main>
  );
}
