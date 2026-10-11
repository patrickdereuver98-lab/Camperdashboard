import Link from "next/link";
import { Icon } from "@/components/icons";
import { Landscape } from "@/components/landscape";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-8 pb-16">
      <div className="animate-rise relative h-48 overflow-hidden rounded-[1.75rem] shadow-lift">
        <Landscape seed="verdwaald" variant={3} van wide className="absolute inset-0 h-full w-full" />
      </div>
      <h1 className="mt-8 font-display text-4xl font-semibold">Verkeerd afgeslagen</h1>
      <p className="mt-2 text-lg text-ink-2">Deze pagina bestaat niet (meer). Misschien is de plek hernoemd of offline gehaald.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/zoeken" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-forest font-semibold text-on-forest">
          <Icon name="search" size={20} /> Zoek een camperplaats
        </Link>
        <Link href="/" className="flex h-14 items-center justify-center rounded-xl border-2 border-line bg-surface font-semibold">
          Naar de startpagina
        </Link>
      </div>
    </main>
  );
}
