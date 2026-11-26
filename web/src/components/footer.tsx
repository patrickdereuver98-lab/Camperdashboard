"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { PROVINCES } from "@/lib/types";
import { searchHref } from "@/lib/search";
import { Logo } from "./icons";
import { CookieSettingsLink } from "./cookie-banner";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Camperplaatsen",
    links: [
      { href: "/zoeken", label: "Alle camperplaatsen" },
      { href: "/zonder-vertrektijd", label: "Zonder vertrektijd" },
      { href: "/uitslapers", label: "Voor uitslapers" },
      { href: "/overige-plekken", label: "Overige plekken" },
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
      { href: "/doe-mee", label: "Doe mee" },
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
      { href: "/reviews-en-ranking", label: "Reviews en ranking" },
      { href: "/melden", label: "Meld inhoud" },
      { href: "/toegankelijkheid", label: "Toegankelijkheid" },
    ],
  },
];

/** Taakpagina's: daar sluit de footer de taak af en is hij geen tweede sitemap (UI/UX-plan T40, 26 november 2026) */
const TASK_PATHS = ["/plek/", "/zoeken", "/zonder-vertrektijd", "/uitslapers", "/overige-plekken", "/dichtbij", "/mijn-reis"];

const ATTRIBUTION = (
  <p className="text-sm text-muted">
    Kaartgegevens © <a className="underline" href="https://www.openstreetmap.org/copyright">OpenStreetMap-bijdragers</a>.
    Routes via OpenRouteService en OSRM. Kaarten van OpenFreeMap.
  </p>
);

/** Het pad is pas bekend tijdens het streamen (Partial Prerender): de schil heeft de volledige footer, net als de kop */
export function Footer() {
  return (
    <Suspense fallback={<FullFooter />}>
      <FooterByPath />
    </Suspense>
  );
}

function FooterByPath() {
  const pathname = usePathname() ?? "";
  if (TASK_PATHS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) return <CompactFooter />;
  return <FullFooter />;
}

function FullFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)] md:gap-10 md:py-12">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="inline-flex h-11 items-center gap-2.5">
            <Logo />
            <span className="font-display text-h2 font-semibold text-forest">VrijStaan</span>
          </Link>
          <p className="mt-4 max-w-xs text-ink-2">
            Onafhankelijke gids voor camperplaatsen in Nederland. Je ziet hier alleen plekken waarvan we de belangrijkste
            gegevens kennen.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className={c.title === "Over VrijStaan" ? "col-span-2 md:col-span-1" : ""}>
            <h2 className="font-display text-base font-semibold text-ink">{c.title}</h2>
            {/* Onder 360 px één kolom: "Gebruiksvoorwaarden" past niet in een halve breedte (R27) */}
            <ul className={`mt-2 ${c.title === "Over VrijStaan" ? "grid grid-cols-1 gap-x-6 min-[360px]:grid-cols-2 md:block" : ""}`}>
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-2.5 text-ink-2 hover:text-forest hover:underline">
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
          <h2 className="text-sm font-semibold text-ink-2">Camperplaatsen per provincie</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {PROVINCES.map((p) => (
              <li key={p}>
                <Link
                  href={`/camperplaatsen/${p.toLowerCase()}`}
                  className="inline-flex h-11 items-center rounded-full bg-sunken px-4 text-sm font-semibold text-ink-2 hover:text-forest"
                >
                  {p}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3">{ATTRIBUTION}</div>
        </div>
      </div>
    </footer>
  );
}

/** Korte footer: twee groepen (hulp en over VrijStaan) en de verplichte kaartvermelding */
function CompactFooter() {
  const groups = COLUMNS.filter((c) => c.title !== "Camperplaatsen");
  return (
    <footer className="mt-12 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {groups.map((c) => (
          <nav key={c.title} aria-label={c.title} className="mt-2 first:mt-0">
            <h2 className="sr-only">{c.title}</h2>
            <ul className="flex flex-wrap gap-x-5">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-block py-2.5 text-sm text-ink-2 hover:text-forest hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
              {c.title === "Over VrijStaan" && (
                <li className="text-sm">
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </nav>
        ))}
        <div className="mt-3">{ATTRIBUTION}</div>
      </div>
    </footer>
  );
}
