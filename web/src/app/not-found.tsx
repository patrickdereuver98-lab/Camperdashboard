import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-10 pb-16">
      <div className="sign-panel animate-sign-in p-7">
        <p className="font-sign text-6xl font-extrabold leading-none">404</p>
        <p className="mt-3 font-sign text-2xl font-bold">Deze weg loopt dood</p>
        <p className="mt-2 text-white/85">De pagina bestaat niet (meer). Misschien is de plek hernoemd of offline gehaald.</p>
      </div>
      <div className="mt-6 grid gap-3">
        <Link href="/zoeken" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-road font-semibold text-on-road">
          <Icon name="search" size={20} /> Zoek een camperplaats
        </Link>
        <Link href="/" className="flex h-14 items-center justify-center rounded-xl border-2 border-line bg-surface font-semibold">
          Naar de startpagina
        </Link>
      </div>
    </main>
  );
}
