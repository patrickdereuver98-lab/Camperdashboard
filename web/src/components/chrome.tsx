"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { useTrip } from "@/lib/store";
import { track } from "@/lib/track";
import { Icon, Logo, type IconName } from "./icons";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/zoeken", label: "Zoeken", icon: "search" },
  { href: "/dichtbij", label: "Dichtbij", icon: "locate" },
  { href: "/mijn-reis", label: "Mijn reis", icon: "heart" },
];

// De vertrekpagina's en provinciepagina's zijn zoekresultaten: daar hoort het tabblad Zoeken bij
const SEARCH_PATHS = ["/zonder-vertrektijd", "/uitslapers", "/overige-plekken", "/camperplaatsen"];

const activeIn = (pathname: string) => (href: string) =>
  href === "/"
    ? pathname === "/"
    : pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === "/zoeken" && SEARCH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)));

/** Aantal pagina's binnen dit bezoek; bij 1 kwam je van buiten (Google, een gedeelde link) */
let pagesSeen = 0;

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
      className={`animate-pop grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 font-display text-xs font-semibold text-on-ember ${className}`}
    >
      {stops.length}
    </span>
  );
}

function HeaderView({ pathname }: { pathname: string }) {
  const isActive = activeIn(pathname);
  if (pathname.startsWith("/admin")) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <a href="#inhoud" className="sr-only-focusable absolute left-2 top-2 z-50 rounded-lg bg-ember px-3 py-2 font-semibold text-on-ember">
        Naar de inhoud
      </a>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-4 sm:px-6">
        {pathname.startsWith("/plek/") && <BackButton />}
        <Link href="/" className="flex items-center gap-2.5" aria-label="VrijStaan, naar de startpagina">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold tracking-tight text-forest sm:text-xl">VrijStaan</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Hoofdmenu">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className="flex h-11 items-center gap-2 rounded-lg px-4 font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink aria-[current=page]:bg-forest-tint aria-[current=page]:text-forest"
            >
              <Icon name={n.icon} size={19} />
              {n.label}
              {n.href === "/mijn-reis" && <TripBadge />}
            </Link>
          ))}
          <Link
            href="/veelgestelde-vragen"
            aria-current={isActive("/veelgestelde-vragen") ? "page" : undefined}
            className="flex h-11 items-center gap-2 rounded-xl px-4 font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink aria-[current=page]:bg-forest-tint aria-[current=page]:text-forest"
          >
            <Icon name="help" size={19} />
            Hulp
          </Link>
          <Link
            href="/plek-aanmelden"
            className="ml-2 flex h-11 items-center rounded-lg border border-line px-4 font-semibold text-ink-2 transition-colors hover:border-forest hover:text-forest"
          >
            Plek aanmelden
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <Link
            href="/plek-aanmelden"
            className="grid h-11 w-11 place-items-center rounded-xl text-ink-2 hover:bg-sunken"
            aria-label="Plek aanmelden"
          >
            <Icon name="plus" size={22} />
          </Link>
          <Link href="/veelgestelde-vragen" className="flex h-11 items-center gap-1.5 rounded-xl px-2.5 font-semibold text-ink-2 hover:bg-sunken">
            <Icon name="help" size={22} />
            Hulp
          </Link>
        </div>
        <AccountButton active={isActive("/account")} />
      </div>
      <OfflineBar />
    </header>
  );
}

function AccountButton({ active }: { active: boolean }) {
  const { session, loading } = useSession();
  const meta = session?.user.user_metadata as { avatar_url?: string; picture?: string; full_name?: string; name?: string } | undefined;
  const avatar = meta?.avatar_url ?? meta?.picture;
  const label = session ? `Mijn account${meta?.full_name || meta?.name ? ` (${meta.full_name ?? meta.name})` : ""}` : "Inloggen";
  return (
    <Link
      href={session ? "/account" : "/inloggen"}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-testid="account-button"
      data-state={loading ? "loading" : session ? "in" : "out"}
      className="-mr-1 grid h-11 min-w-11 place-items-center rounded-xl px-1 text-ink-2 hover:bg-sunken aria-[current=page]:text-forest md:ml-1"
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover outline-2 outline-forest outline" />
      ) : (
        <span className="flex items-center gap-2 font-semibold">
          <Icon name="user" size={22} />
          <span className="hidden lg:inline">{session ? "Account" : "Inloggen"}</span>
        </span>
      )}
    </Link>
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
  // Op een plekpagina neemt de actiebalk (prijs, bewaren, website) de onderrand over
  if (pathname.startsWith("/admin") || pathname.startsWith("/plek/")) return null;
  const tabs: { href: string; label: string; icon: IconName }[] = [{ href: "/", label: "Start", icon: "home" }, ...NAV];
  return (
    <>
    {/* Ruimte zodat de vaste tabbalk geen inhoud bedekt */}
    <div aria-hidden="true" className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
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
                className="relative flex h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold text-muted aria-[current=page]:text-forest"
              >
                {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-forest" />}
                <Icon name={t.icon} size={24} strokeWidth={active ? 2.3 : 1.9} />
                {t.label}
                {t.href === "/mijn-reis" && <TripBadge className="absolute top-2 left-[calc(50%+6px)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
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
    pagesSeen += 1;
    if (!pathname.startsWith("/admin")) track("page_view");
  }, [pathname]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

/** Korte bevestiging na bewaren, met een link naar Mijn reis */
export const SAVED_EVENT = "vrijstaan:bewaard";

export function SaveToast() {
  return (
    <Suspense fallback={null}>
      <SaveToastLive />
    </Suspense>
  );
}

function SaveToastLive() {
  const [toast, setToast] = useState<{ id: number; name?: string } | null>(null);
  const pathname = usePathname();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (e: Event) => {
      setToast({ id: Date.now(), name: (e as CustomEvent<{ name?: string }>).detail?.name });
      clearTimeout(timer);
      timer = setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener(SAVED_EVENT, show);
    return () => {
      window.removeEventListener(SAVED_EVENT, show);
      clearTimeout(timer);
    };
  }, []);
  if (!toast || pathname.startsWith("/mijn-reis")) return null;
  const onDetail = pathname.startsWith("/plek/");
  return (
    <div
      key={toast.id}
      role="status"
      className={`animate-toast fixed left-1/2 z-50 flex w-[min(92vw,26rem)] items-center gap-3 rounded-xl bg-ink py-2 pr-2 pl-4 text-surface shadow-lift md:bottom-6 ${
        onDetail ? "bottom-[calc(88px+env(safe-area-inset-bottom))]" : "bottom-[calc(76px+env(safe-area-inset-bottom))]"
      }`}
    >
      <Icon name="heart" size={20} filled className="shrink-0 text-ember" />
      <span className="min-w-0 flex-1 truncate font-semibold">Bewaard in Mijn reis</span>
      <Link href="/mijn-reis" className="flex h-11 shrink-0 items-center rounded-lg px-3 font-semibold text-ember underline">
        Bekijk
      </Link>
    </div>
  );
}

/** Terug naar de resultaten; ook in de geïnstalleerde app, waar geen browserknop is */
function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      // Alleen terug als de vorige pagina ook van VrijStaan was; wie via Google binnenkwam, gaat naar de resultaten
      onClick={() => (pagesSeen > 1 ? router.back() : router.push("/zoeken"))}
      aria-label="Terug"
      className="-ml-2 grid h-11 w-11 place-items-center rounded-lg text-ink-2 hover:bg-sunken"
    >
      <Icon name="arrowLeft" size={22} />
    </button>
  );
}
