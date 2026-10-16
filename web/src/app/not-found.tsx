import Link from "next/link";
import { Icon } from "@/components/icons";
import { Landscape } from "@/components/landscape";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-8 pb-16">
      <div className="animate-rise relative h-48 overflow-hidden rounded-2xl shadow-lift">
        <Landscape seed="verdwaald" variant={3} van wide className="absolute inset-0 h-full w-full" />
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold">Verkeerd afgeslagen</h1>
      <p className="mt-2 text-lg text-ink-2">Deze pagina bestaat niet. Misschien heeft de plek een andere naam gekregen of staat hij niet meer online. Zoek hem opnieuw of ga naar de startpagina.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/zoeken" className="flex h-14 items-center justify-center gap-2 rounded-lg bg-forest font-semibold text-on-forest">
          <Icon name="search" size={20} /> Camperplaats zoeken
        </Link>
        <Link href="/" className="flex h-14 items-center justify-center rounded-lg border border-line bg-surface font-semibold">
          Naar de startpagina
        </Link>
      </div>
    </main>
  );
}
