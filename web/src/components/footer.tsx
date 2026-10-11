import Link from "next/link";
import { PROVINCES } from "@/lib/types";
import { searchHref } from "@/lib/search";
import { Logo } from "./icons";
import { CookieSettingsLink } from "./cookie-banner";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Ontdekken",
    links: [
      { href: "/zoeken", label: "Alle camperplaatsen" },
      { href: "/dichtbij", label: "Plekken dichtbij" },
      { href: searchHref({ free: true }), label: "Gratis overnachten" },
      { href: "/mijn-reis", label: "Mijn reis plannen" },
    ],
  },
  {
    title: "Hulp",
    links: [
      { href: "/veelgestelde-vragen", label: "Veelgestelde vragen" },
      { href: "/contact", label: "Contact en support" },
      { href: "/plek-aanmelden", label: "Plek aanmelden" },
      { href: "/plek-aanmelden?soort=eigenaar", label: "Voor eigenaren" },
    ],
  },
  {
    title: "Over VrijStaan",
    links: [
      { href: "/over-ons", label: "Over ons" },
      { href: "/privacy", label: "Privacyverklaring" },
      { href: "/cookies", label: "Cookiebeleid" },
      { href: "/voorwaarden", label: "Gebruiksvoorwaarden" },
      { href: "/disclaimer", label: "Disclaimer" },
      { href: "/toegankelijkheid", label: "Toegankelijkheid" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-sign text-xl font-extrabold text-road">VrijStaan</span>
          </Link>
          <p className="mt-4 max-w-xs text-ink-2">
            Onafhankelijke gids voor camperplaatsen in Nederland. We tonen alleen plekken waarvan we de belangrijkste
            informatie hebben gecontroleerd.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sign text-base font-bold text-ink">{c.title}</h2>
            <ul className="mt-3 space-y-1">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-1.5 text-ink-2 hover:text-road hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
              {c.title === "Over VrijStaan" && (
                <li>
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-sm text-muted">
            Camperplaatsen per provincie:{" "}
            {PROVINCES.map((p, i) => (
              <span key={p}>
                <Link href={`/camperplaatsen/${p.toLowerCase()}`} className="hover:text-road hover:underline">
                  {p}
                </Link>
                {i < PROVINCES.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
          <p className="mt-3 text-sm text-muted">
            Kaartgegevens © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap-bijdragers</a>.
            Routes via OpenRouteService en OSRM. Kaarten van OpenFreeMap.
          </p>
        </div>
      </div>
    </footer>
  );
}
