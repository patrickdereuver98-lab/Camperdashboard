import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Eén chip voor elke aan/uit-keuze (review R49, docs/stijlgids.md §10). Uit = 1 px rand op `surface`, aan = vol
 * bosgroen met een vinkje. Geen getinte tussenvorm meer: een chip die uit staat, mag er nooit aan uitzien.
 * `aria-pressed` volgt `pressed`; het vinkje is voor het oog, schermlezers horen "ingedrukt".
 */
export function Chip({
  pressed,
  icon,
  wide = false,
  className = "",
  children,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed" | "type"> & {
  pressed: boolean;
  /** Klein lijnicoon vóór de tekst, in de tekstkleur */
  icon?: ReactNode;
  /** Vult de cel van een raster (filtersheet); tekst links en mag afbreken */
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`flex items-center rounded-md border font-semibold transition-colors duration-150 disabled:opacity-60 ${
        wide ? "min-h-12 w-full gap-2 px-2.5 py-1.5 text-left" : "min-h-11 min-w-11 shrink-0 justify-center gap-1.5 px-3 whitespace-nowrap"
      } ${pressed ? "border-forest bg-forest text-on-forest" : "border-line bg-surface text-ink hover:border-forest"} ${className}`}
      {...rest}
    >
      {icon}
      {children}
      {pressed && <Icon name="check" size={16} className={`shrink-0 ${wide ? "ml-auto" : ""}`} />}
    </button>
  );
}
