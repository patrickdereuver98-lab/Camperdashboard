"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "@/lib/auth";
import { currentTheme, setTheme } from "@/lib/theme";
import { useDarkTheme } from "@/lib/use-media";
import { useTrip } from "@/lib/store";
import { useLastSearch } from "@/lib/last-search";
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
      className={`animate-pop grid h-6 min-w-6 place-items-center rounded-full bg-forest px-1.5 font-display text-sm font-semibold text-on-forest ${className}`}
    >
      {stops.length}
    </span>
  );
}

function HeaderView({ pathname }: { pathname: string }) {
  const isActive = activeIn(pathname);
  const onPlace = pathname.startsWith("/plek/");
  const lastSearch = useLastSearch();
  if (pathname.startsWith("/admin")) return null;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface">
      <a href="#inhoud" className="sr-only-focusable absolute left-2 top-2 z-50 flex min-h-11 items-center rounded-lg bg-forest px-4 font-semibold text-on-forest">
        Naar de inhoud
      </a>
      {/* flex-wrap: met grote tekst (200%) op 320 px gaan de knoppen naar een tweede regel in plaats van buiten beeld (R31) */}
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-1 px-3 min-[400px]:gap-x-2 min-[400px]:px-4 sm:min-h-16 sm:gap-x-4 sm:px-6">
        {onPlace && <BackButton />}
        <Link href="/" className="flex h-11 items-center gap-2.5" aria-label="VrijStaan, naar de startpagina">
          <Logo size={30} />
          {/* Op een heel smal scherm (onder 360 px, of met de terugknop erbij) alleen het logo, zodat Inloggen in beeld blijft;
              de naam staat dan in het aria-label van de link */}
          <span
            className={`font-display text-lg font-semibold tracking-tight text-forest sm:text-xl ${onPlace ? "hidden min-[400px]:inline" : "hidden min-[350px]:inline"}`}
          >
            VrijStaan
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Hoofdmenu">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href === "/zoeken" ? lastSearch : n.href}
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
            className="flex h-11 items-center gap-2 rounded-lg px-4 font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink aria-[current=page]:bg-forest-tint aria-[current=page]:text-forest"
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
        <div className="ml-auto flex items-center lg:hidden">
          <Link
            href="/plek-aanmelden"
            className="grid h-11 w-11 place-items-center rounded-md text-ink-2 hover:bg-sunken"
            aria-label="Plek aanmelden"
          >
            <Icon name="plus" size={22} />
          </Link>
          {/* Hulp en licht/donker in één menu (UI/UX-plan T39, 26 november 2026): op de telefoon hoogstens drie knoppen */}
          <MoreMenu pathname={pathname} helpActive={isActive("/veelgestelde-vragen")} />
        </div>
        <div className="hidden lg:block">
          <ThemeButton />
        </div>
        <AccountButton active={isActive("/account")} />
      </div>
      <OfflineBar />
    </header>
  );
}

/**
 * Zon/maan: wisselt tussen licht en donker (lib/theme.ts). De pictogrammen wisselen via CSS op data-theme, zodat de
 * knop al vóór hydratatie klopt; aria-pressed volgt na hydratatie.
 */
function ThemeButton() {
  const dark = useDarkTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
      aria-label="Donkere modus"
      aria-pressed={dark}
      data-testid="theme-button"
      className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-2 hover:bg-sunken hover:text-ink lg:ml-1"
    >
      <Icon name="moon" size={21} className="dark:hidden" />
      <Icon name="sun" size={22} className="hidden dark:block" />
    </button>
  );
}

/** Menu "Meer" in de telefoonkop: Hulp en licht/donker. Escape of een tik ernaast sluit het, focus gaat terug. */
function MoreMenu({ pathname, helpActive }: { pathname: string; helpActive: boolean }) {
  // Open op één pad: na het navigeren is het menu vanzelf dicht (pad uit de kop, die het binnen Suspense leest)
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (o: boolean | ((o: boolean) => boolean)) => setOpenAt((typeof o === "function" ? o(open) : o) ? pathname : null);
  const dark = useDarkTheme();
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent | PointerEvent) => {
      if (e instanceof KeyboardEvent) {
        if (e.key !== "Escape") return;
        setOpenAt(null);
        document.getElementById("meer-knop")?.focus();
        return;
      }
      if (!(e.target as Element).closest?.("[data-meer]")) setOpenAt(null);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  const item = "flex min-h-11 w-full items-center gap-3 px-4 text-left font-semibold text-ink hover:bg-sunken";
  return (
    <div
      className="relative"
      data-meer
      // Tab uit het menu sluit het ook (review): focus gaat naar iets buiten deze knop en het menu
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenAt(null);
      }}
    >
      <button
        id="meer-knop"
        type="button"
        aria-label="Meer"
        aria-expanded={open}
        aria-controls={open ? "meer-menu" : undefined}
        data-testid="menu-button"
        onClick={() => setOpen((o) => !o)}
        className="grid h-11 w-11 place-items-center rounded-md text-ink-2 hover:bg-sunken aria-expanded:text-forest"
      >
        <Icon name="more" size={24} strokeWidth={3} />
      </button>
      {open && (
        <div id="meer-menu" className="animate-rise absolute top-full right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-float">
          <Link href="/veelgestelde-vragen" onClick={() => setOpenAt(null)} aria-current={helpActive ? "page" : undefined} className={`${item} aria-[current=page]:text-forest`}>
            <Icon name="help" size={20} /> Hulp
          </Link>
          <button
            type="button"
            aria-pressed={dark}
            data-testid="theme-menu-item"
            onClick={() => setTheme(currentTheme() === "dark" ? "light" : "dark")}
            className={item}
          >
            <Icon name="moon" size={20} className="dark:hidden" />
            <Icon name="sun" size={20} className="hidden dark:block" />
            Donkere modus
          </button>
        </div>
      )}
    </div>
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
      className="-mr-1 grid h-11 min-w-11 shrink-0 place-items-center rounded-xl px-1 text-ink-2 hover:bg-sunken aria-[current=page]:text-forest lg:ml-1"
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
      <Icon name="wifiOff" size={16} className="shrink-0" />
      <span>
        Geen verbinding. Mijn reis, je bewaarde plekken en de pagina&apos;s die je eerder bekeek werken gewoon.{" "}
        <Link href="/mijn-reis" className="underline underline-offset-2">
          Naar Mijn reis
        </Link>
      </span>
    </div>
  );
}

/**
 * Tik op het tabblad waar je al bent, zoals op een iPhone (UX-audit november, G2): eerst naar boven; sta je al boven,
 * dan de cursor in het zoekvak (Start en Zoeken). Op een subpagina (bv. Reisstatistieken) gaat de link gewoon door.
 */
function tapCurrentTab(e: React.MouseEvent, here: boolean) {
  if (!here || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  if (window.scrollY > 4) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    return;
  }
  document.querySelector<HTMLInputElement>('form[role="search"] input[role="combobox"]')?.focus();
}

function TabBarView({ pathname }: { pathname: string }) {
  const isActive = activeIn(pathname);
  const lastSearch = useLastSearch();
  // Op een plekpagina neemt de actiebalk (prijs, bewaren, website) de onderrand over
  if (pathname.startsWith("/admin") || pathname.startsWith("/plek/")) return null;
  const tabs: { href: string; label: string; icon: IconName }[] = [{ href: "/", label: "Start", icon: "home" }, ...NAV];
  // Zoeken brengt je terug naar je laatste zoekopdracht van dit bezoek, met alle filters
  const linkOf = (href: string) => (href === "/zoeken" ? lastSearch : href);
  const hereOn = (href: string) => pathname === href || (href === "/zoeken" && pathname === lastSearch.split("?")[0]);
  return (
    <>
    {/* Ruimte zodat de vaste tabbalk geen inhoud bedekt */}
    <div aria-hidden="true" className="h-[calc(64px+env(safe-area-inset-bottom))] shrink-0 lg:hidden" />
    <nav
      aria-label="Hoofdmenu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href}>
              <Link
                href={linkOf(t.href)}
                aria-current={active ? "page" : undefined}
                onClick={(e) => tapCurrentTab(e, hereOn(t.href))}
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
  // Aantal stops op het app-icoon (alleen als app op het beginscherm; iPhone vanaf iOS 16.4 met toestemming voor meldingen)
  const { stops } = useTrip();
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!nav.setAppBadge) return;
    (stops.length ? nav.setAppBadge(stops.length) : (nav.clearAppBadge?.() ?? Promise.resolve())).catch(() => undefined);
  }, [stops.length]);
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
      className={`animate-toast fixed left-1/2 z-50 flex w-[min(92vw,26rem)] items-center gap-3 rounded-lg bg-ink py-2 pr-2 pl-4 text-surface shadow-float lg:bottom-6 ${
        onDetail ? "bottom-[calc(88px+env(safe-area-inset-bottom))]" : "bottom-[calc(76px+env(safe-area-inset-bottom))]"
      }`}
    >
      <Icon name="heart" size={20} filled className="shrink-0" />
      <span className="min-w-0 flex-1 truncate font-semibold">Bewaard in Mijn reis</span>
      <Link href="/mijn-reis" className="flex h-11 shrink-0 items-center rounded-lg px-3 font-semibold text-surface underline underline-offset-2">
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
