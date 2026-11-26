import Link from "next/link";
import { Icon } from "@/components/icons";

/** Niet gevonden: een rustige foutstaat met één herstelactie, zonder tekening (UI/UX-plan T37, 26 november 2026) */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-10 pb-16">
      <h1 className="font-display text-h1 font-semibold">Deze pagina bestaat niet meer</h1>
      <p className="mt-2 text-ink-2">
        Misschien heeft de plek een andere naam gekregen of staat hij niet meer online. Zoek de plek opnieuw.
      </p>
      <div className="mt-6 grid gap-3">
        <Link href="/zoeken" className="flex h-12 items-center justify-center gap-2 rounded-md bg-forest font-semibold text-on-forest hover:bg-forest-deep">
          <Icon name="search" size={20} /> Naar zoeken
        </Link>
        <Link href="/" className="-my-3 self-center py-3 font-semibold text-forest underline underline-offset-2">
          Naar start
        </Link>
      </div>
    </main>
  );
}
