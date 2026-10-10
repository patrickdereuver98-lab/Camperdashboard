"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTrip } from "@/lib/client-data";
import { Icon, LogoMark, type IconName } from "./icons";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/zoeken", label: "Zoeken", icon: "search" },
  { href: "/dichtbij", label: "Dichtbij", icon: "locate" },
  { href: "/mijn-reis", label: "Mijn reis", icon: "route" },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const isActive = useActive();
  const { stops } = useTrip();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label="VrijStaan, naar de homepage"
        >
          <LogoMark />
          <span className="font-display text-[1.35rem] font-semibold text-ink">
            VrijStaan
          </span>
        </Link>
        <nav
          className="ml-auto hidden items-center gap-1 md:flex"
          aria-label="Hoofdmenu"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className="relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-forest-tint aria-[current=page]:text-forest-deep"
            >
              <Icon name={l.icon} size={16} />
              {l.label}
              {l.href === "/mijn-reis" && stops.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 text-[11px] font-semibold text-surface">
                  {stops.length}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function TabBar() {
  const isActive = useActive();
  const { stops } = useTrip();
  const tabs: { href: string; label: string; icon: IconName }[] = [
    { href: "/", label: "Ontdek", icon: "compass" },
    ...LINKS,
  ];
  return (
    <nav
      aria-label="Hoofdmenu"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.href === "/" ? false : isActive(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted aria-[current=page]:text-forest"
              >
                <Icon
                  name={t.icon}
                  size={22}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {t.label}
                {t.href === "/mijn-reis" && stops.length > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-semibold text-surface">
                    {stops.length}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
