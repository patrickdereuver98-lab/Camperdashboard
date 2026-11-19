"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { directionsUrl } from "@/lib/geo";
import { useTrip } from "@/lib/store";
import { track } from "@/lib/track";
import { departureShort } from "@/lib/format";
import type { PlaceSummary } from "@/lib/types";
import { Icon } from "./icons";
import { Sheet } from "./sheet";

/**
 * Snelmenu van een plekkaart (UX-audit G5): lang indrukken (telefoon) of rechtsklikken (computer) geeft Bekijk plek,
 * Bewaren, Route en Delen zonder de plek te openen. Alles staat ook op de plekpagina zelf; dit is een snelkoppeling.
 */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  // Na lang indrukken niet ook nog de link volgen
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      cancel();
      fired.current = true;
      onLongPress();
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!fired.current) return;
      e.preventDefault();
      e.stopPropagation();
      fired.current = false;
    },
  };
}

export function QuickMenu({ place, open, onClose }: { place: PlaceSummary; open: boolean; onClose: () => void }) {
  const trip = useTrip();
  const saved = trip.has(place.slug);
  const [shared, setShared] = useState(false);
  const apps = [
    { label: "Google Maps", href: directionsUrl(place) },
    { label: "Apple Kaarten", href: `https://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=d` },
    { label: "Waze", href: `https://waze.com/ul?ll=${place.lat},${place.lng}&navigate=yes` },
  ];
  const row = "flex min-h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 text-left font-semibold hover:border-forest";
  return (
    <Sheet open={open} onClose={onClose} title={place.name}>
      <div className="grid gap-2">
        <Link href={`/plek/${place.slug}`} className={row} onClick={onClose}>
          <Icon name="eye" size={19} /> Bekijk plek
        </Link>
        <button
          type="button"
          className={row}
          aria-pressed={saved}
          onClick={() => {
            trip.toggle(place.slug);
            if (!saved) track("save", { slug: place.slug });
            onClose();
          }}
        >
          <Icon name="heart" size={19} filled={saved} className={saved ? "text-forest" : undefined} /> {saved ? "Uit Mijn reis halen" : "Bewaren in Mijn reis"}
        </button>
        <button
          type="button"
          className={row}
          onClick={async () => {
            const url = `${location.origin}/plek/${place.slug}`;
            const text = [place.name, departureShort(place)].filter(Boolean).join(": ");
            if (navigator.share) await navigator.share({ title: place.name, text, url }).catch(() => undefined);
            else {
              await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => undefined);
              setShared(true);
              setTimeout(() => setShared(false), 2000);
            }
          }}
        >
          <Icon name={shared ? "check" : "share"} size={19} /> {shared ? "Link gekopieerd" : "Delen"}
        </button>
        <p className="mt-2 text-sm font-semibold text-muted">Route met</p>
        {apps.map((a) => (
          <a key={a.label} href={a.href} target="_blank" rel="noopener noreferrer" onClick={() => track("route", { slug: place.slug, app: a.label })} className={row}>
            <Icon name="route" size={19} /> {a.label}
            <Icon name="external" size={17} className="ml-auto text-muted" />
          </a>
        ))}
      </div>
    </Sheet>
  );
}
