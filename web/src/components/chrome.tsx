"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOffline } from "next/offline";
import { Suspense, useEffect } from "react";
import { useTrip } from "@/lib/store";
import { track } from "@/lib/track";
import { Icon, Logo, type IconName } from "./icons";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/zoeken", label: "Zoeken", icon: "search" },
  { href: "/dichtbij", label: "Dichtbij", icon: "locate" },
  { href: "/mijn-reis", label: "Mijn reis", icon: "heart" },
];

const activeIn = (pathname: string) => (href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

// usePathname() is pas bij het verzoek bekend op dynamische routes: de chrome
// streamt daarom binnen <Suspense>, met dezelfde opmaak zonder actieve tab als placeholder.
export function Header() {
  return (
    <Suspense fallback={<HeaderView pathname="" />}>
      <HeaderLive />
    </Suspense>
  );
}

function HeaderLive() {
  return <HeaderView pathname={usePathname()} />;
}

export function TabBar() {
  return (
    <Suspense fallback={<TabBarView pathname="" />}>
      <TabBarLive />
    </Suspense>
  );
}

function TabBarLive() {
  return <TabBarView pathname={usePathname()} />;
}

function TripBadge({ className = "" }: { className?: string }) {
  const { stops } = useTrip();
  if (!stops.length) return null;
  return (
    <span
      key={stops.length}
      className={`animate-pop grid h-5 min-w-5 place-items-center rounded-full bg-signal px-1 font-sign text-xs font-bold text-on-signal ${className}`}
    >
      {stops.length}
    </span>
  );
}

function HeaderView({ pathname }: { pathname: string }) {
  const isActive = activeIn(pathname);
  if (pathname.startsWith("/admin")) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a href="#inhoud" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-lg bg-signal px-3 py-2 font-semibold text-on-signal">
        Naar de inhoud
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="VrijStaan, naar de startpagina">
          <Logo />
          <span className="font-sign text-xl font-extrabold tracking-tight text-road">VrijStaan</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Hoofdmenu">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className="flex h-11 items-center gap-2 rounded-xl px-4 font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink aria-[current=page]:bg-road-tint aria-[current=page]:text-road"
            >
              <Icon name={n.icon} size={19} />
              {n.label}
              {n.href === "/mijn-reis" && <TripBadge />}
            </Link>
          ))}
          <Link
            href="/plek-aanmelden"
            className="ml-2 flex h-11 items-center rounded-xl border border-line px-4 font-semibold text-ink-2 transition-colors hover:border-road hover:text-road"
          >
            Plek aanmelden
          </Link>
        </nav>
        <Link
          href="/veelgestelde-vragen"
          className="ml-auto grid h-11 w-11 place-items-center rounded-xl text-ink-2 hover:bg-sunken md:hidden"
          aria-label="Hulp en veelgestelde vragen"
        >
          <Icon name="help" size={22} />
        </Link>
      </div>
      <OfflineBar />
    </header>
  );
}

function OfflineBar() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-ink px-4 py-2 text-sm font-semibold text-surface">
      <Icon name="wifiOff" size={16} /> Geen verbinding. Bewaarde plekken en eerder bekeken pagina&apos;s werken nog.
    </div>
  );
}

function TabBarView({ pathname }: { pathname: string }) {
  const isActive = activeIn(pathname);
  if (pathname.startsWith("/admin")) return null;
  const tabs: { href: string; label: string; icon: IconName }[] = [{ href: "/", label: "Start", icon: "home" }, ...NAV];
  return (
    <nav
      aria-label="Hoofdmenu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="relative flex h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold text-muted aria-[current=page]:text-road"
              >
                {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-road" />}
                <Icon name={t.icon} size={24} strokeWidth={active ? 2.3 : 1.9} />
                {t.label}
                {t.href === "/mijn-reis" && <TripBadge className="absolute top-2 left-[calc(50%+6px)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Paginaweergaven meten (alleen met toestemming) en de service worker registreren */
export function Runtime() {
  return (
    <Suspense fallback={null}>
      <RuntimeLive />
    </Suspense>
  );
}

function RuntimeLive() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/admin")) track("page_view");
  }, [pathname]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
