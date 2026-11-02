"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/marketing", label: "Overzicht" },
  { href: "/admin/marketing/vindbaarheid", label: "Vindbaarheid" },
  { href: "/admin/marketing/content", label: "Content" },
  { href: "/admin/marketing/studio", label: "Studio" },
  { href: "/admin/marketing/kalender", label: "Kalender" },
  { href: "/admin/marketing/campagnes", label: "Campagnes" },
];

/** Onderdelen van het marketingdashboard: op mobiel een veegbare rij, zoals de filters op de site */
export function MarketingNav() {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin/marketing" ? pathname === href : pathname.startsWith(href));
  return (
    <nav aria-label="Marketing" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {ITEMS.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active(i.href) ? "page" : undefined}
          className="flex h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-on-forest"
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
