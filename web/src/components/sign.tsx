import type { ReactNode } from "react";

/**
 * Voorzieningen als kleine lijniconen op een lichte ondergrond.
 * Aanwezig = bosgroen icoon op lichtgroen, niet aanwezig = grijs en doorgestreept, onbekend = lichtgrijs.
 */

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const GLYPHS = {
  camper: (
    <>
      <path d="M2.5 7.4c0-.8.6-1.4 1.4-1.4h10.6c.5 0 .9.2 1.2.6l3.3 4.2h.9c1.1 0 2 .9 2 2v3.3c0 .5-.4.9-.9.9H19.6a2.4 2.4 0 0 0-4.7 0H9a2.4 2.4 0 0 0-4.7 0H3.4a.9.9 0 0 1-.9-.9Z" fill="currentColor" />
      <path d="M14.6 8.2h-2.2v2.7h4.3Z M5 8.2h5.4v2.7H5Z" fill="var(--sign-bg)" />
      <circle cx="6.7" cy="17.4" r="1.9" fill="currentColor" />
      <circle cx="17.3" cy="17.4" r="1.9" fill="currentColor" />
    </>
  ),
  power: (
    <path {...stroke} d="M9 3v4.5M15 3v4.5M6.5 7.5h11V11a5.5 5.5 0 0 1-11 0ZM12 16.5V21" />
  ),
  water: (
    <>
      <path {...stroke} d="M3 8h10a3 3 0 0 1 3 3v1.5M8 8V5M5.5 5h5" />
      <path d="M16 15.5c-1.1 1.4-1.7 2.4-1.7 3.2a1.7 1.7 0 0 0 3.4 0c0-.8-.6-1.8-1.7-3.2Z" fill="currentColor" />
    </>
  ),
  dump: <path {...stroke} d="M12 3v9M8.5 8.5 12 12l3.5-3.5M4.5 15.5h15v4.5h-15ZM8.5 15.5V20M12 15.5V20M15.5 15.5V20" />,
  toilet: <path {...stroke} d="M7 3.5h3.5v7.5H7ZM5.5 11h13a6.5 6.5 0 0 1-6.5 6.5h-.5l.8 3H8.6l.6-3.4A6.5 6.5 0 0 1 5.5 11Z" />,
  shower: (
    <>
      <path {...stroke} d="M5 21V9.5A5.5 5.5 0 0 1 10.5 4h0A5.5 5.5 0 0 1 16 9.5M12.5 9.5h7" />
      <path {...stroke} d="M14 13.5v.5M17 13.5v.5M20 13.5v.5M15.5 17v.5M18.5 17v.5" />
    </>
  ),
  wifi: <path {...stroke} d="M2.5 9.5a14 14 0 0 1 19 0M5.8 13a9.5 9.5 0 0 1 12.4 0M9.2 16.4a4.8 4.8 0 0 1 5.6 0M12 19.8h.01" />,
  dog: (
    <path
      fill="currentColor"
      d="M8.2 4.6a1.9 1.9 0 1 1-3.8.6 1.9 1.9 0 0 1 3.8-.6Zm11.4.6a1.9 1.9 0 1 1-3.8-.6 1.9 1.9 0 0 1 3.8.6ZM10.9 3.8a2 2 0 1 1-4 .2 2 2 0 0 1 4-.2Zm6.2.2a2 2 0 1 1-4-.2 2 2 0 0 1 4 .2ZM12 9.5c2.2 0 3.6 1.9 4.8 3.7.9 1.4 2.7 2.4 2.7 4.3 0 1.8-1.4 3-3.1 3-1.5 0-2.6-.8-4.4-.8s-2.9.8-4.4.8c-1.7 0-3.1-1.2-3.1-3 0-1.9 1.8-2.9 2.7-4.3 1.2-1.8 2.6-3.7 4.8-3.7Z"
    />
  ),
  tent: <path {...stroke} d="M2 20h20M4 20 12 5l8 15M9 20l3-6 3 6" />,
  parking: <path {...stroke} strokeWidth={2.6} d="M8 20V4h5a4.5 4.5 0 0 1 0 9H8" />,
  farm: <path {...stroke} d="M3.5 20v-9.5L12 4.5l8.5 6V20ZM9 20v-6h6v6M3.5 10.5h17" />,
  harbor: <path {...stroke} d="M12 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 7.5V20M4.5 13a7.5 7.5 0 0 0 15 0M8.5 10.5h7" />,
  euro: <path {...stroke} d="M17.5 6.5A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10.5 5.5M4.5 10.5h8M4.5 13.5h7" />,
  length: <path {...stroke} d="M3 12h18M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3M3 6v12M21 6v12" />,
  calendar: <path {...stroke} d="M4 6h16v14H4ZM4 10.5h16M8.5 3.5v4M15.5 3.5v4" />,
  clock: <path {...stroke} d="M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM12 7.5V12l3 2" />,
  reserve: <path {...stroke} d="M4 6h16v14H4ZM4 10.5h16M8.5 3.5v4M15.5 3.5v4M9 15.5l2 2 4-4" />,
  spots: <path {...stroke} d="M4 4h16v16H4ZM12 4v16M4 12h16" />,
  surface: <path {...stroke} d="M3 18h18M5 18l2.5-5h9L19 18M8 13l1.5-3h5l1.5 3" />,
} satisfies Record<string, ReactNode>;

export type SignName = keyof typeof GLYPHS;

export function Sign({
  name,
  size = 36,
  state = "on",
  tone = "forest",
  title,
  className = "",
}: {
  name: SignName;
  size?: number;
  /** on = aanwezig, off = niet aanwezig, unknown = onbekend */
  state?: "on" | "off" | "unknown";
  /** kleur van het vlak bij "on" */
  tone?: "forest" | "lake";
  title?: string;
  className?: string;
}) {
  const on = state === "on";
  // Rustige lijniconen op een lichte ondergrond; kleur alleen als het iets betekent (docs/stijlgids.md §8)
  const bg = on ? `var(--${tone}-tint)` : "var(--sunken)";
  const fg = on ? `var(--${tone})` : state === "off" ? "var(--muted)" : "color-mix(in srgb, var(--muted) 70%, transparent)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${className}`}
      style={{ ["--sign-bg" as string]: bg }}
    >
      <rect width="32" height="32" rx="8" fill={bg} />
      <g transform="translate(5 5) scale(0.917)" color={fg}>
        {GLYPHS[name]}
      </g>
      {state === "off" && <path d="M8 24 24 8" stroke="var(--alert)" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

export const KIND_SIGN: Record<string, SignName> = {
  camperplaats: "camper",
  camping: "tent",
  parkeerplaats: "parking",
  boerderij: "farm",
  jachthaven: "harbor",
};
