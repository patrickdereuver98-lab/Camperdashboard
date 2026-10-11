"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { DEFAULT_FILTERS, filtersToQuery, normalize, type Filters } from "@/lib/search";
import { usePlaces, useTowns } from "@/lib/store";
import { track } from "@/lib/track";
import { PROVINCES } from "@/lib/types";
import { Icon } from "./icons";

type Option =
  | { type: "near"; label: string }
  | { type: "province"; label: string }
  | { type: "town"; label: string; sub: string; lat: number; lng: number }
  | { type: "place"; label: string; sub: string; slug: string };

export function DestinationSearch({
  variant = "hero",
  base,
  initial = "",
  onPick,
}: {
  variant?: "hero" | "bar";
  /** Verfijningen die behouden blijven bij een nieuwe bestemming */
  base?: Filters;
  initial?: string;
  onPick?: (f: Filters) => void;
}) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const { data: towns } = useTowns();
  const { data: places } = usePlaces();

  const options = useMemo<Option[]>(() => {
    const q = normalize(text);
    const out: Option[] = [{ type: "near", label: "Dichtbij mijn locatie" }];
    if (!q) {
      for (const p of ["Zeeland", "Gelderland", "Friesland", "Limburg"]) out.push({ type: "province", label: p });
      return out;
    }
    for (const p of PROVINCES) if (normalize(p).includes(q)) out.push({ type: "province", label: p });
    const seen = new Set<string>();
    for (const t of towns ?? []) {
      const n = normalize(t.name);
      if ((n.startsWith(q) || (q.length > 2 && n.includes(q))) && !seen.has(t.name)) {
        seen.add(t.name);
        out.push({ type: "town", label: t.name, sub: t.province, lat: t.lat, lng: t.lng });
      }
      if (out.length > 8) break;
    }
    if (q.length > 2)
      for (const p of places ?? []) {
        if (normalize(p.name).includes(q)) out.push({ type: "place", label: p.name, sub: `${p.town}, ${p.province}`, slug: p.slug });
        if (out.length > 12) break;
      }
    return out;
  }, [text, towns, places]);

  function go(f: Filters) {
    track("search", { waar: f.where ?? null, provincie: f.province ?? null });
    if (onPick) onPick(f);
    else router.push(`/zoeken?${filtersToQuery(f)}`);
  }

  function pick(o: Option) {
    setOpen(false);
    const keep: Filters = { ...(base ?? DEFAULT_FILTERS), where: undefined, center: undefined, province: undefined };
    if (o.type === "place") {
      router.push(`/plek/${o.slug}`);
      return;
    }
    if (o.type === "province") {
      setText(o.label);
      go({ ...keep, where: o.label, province: o.label, sort: keep.sort === "afstand" ? "aanbevolen" : keep.sort });
      return;
    }
    if (o.type === "town") {
      setText(o.label);
      go({ ...keep, where: o.label, center: { lat: o.lat, lng: o.lng } });
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoError("Je browser kan je locatie niet bepalen. Typ een plaatsnaam.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setText("Mijn locatie");
        go({ ...keep, where: "Mijn locatie", center: { lat: pos.coords.latitude, lng: pos.coords.longitude }, sort: "afstand" });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Geen toegang tot je locatie. Sta het toe in je browser of typ een plaatsnaam."
            : "Je locatie kon niet worden bepaald. Probeer het opnieuw of typ een plaatsnaam.",
        );
      },
      { timeout: 12000, maximumAge: 300000 },
    );
  }

  function submit() {
    const first = options.find((o) => o.type !== "near");
    if (text.trim() && first) pick(first);
    else if (!text.trim()) go({ ...(base ?? DEFAULT_FILTERS), where: undefined, center: undefined, province: undefined });
    else inputRef.current?.focus();
  }

  const hero = variant === "hero";
  const listId = `${id}-lijst`;

  return (
    <div className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (open && options[active]) pick(options[active]);
          else submit();
        }}
        className={hero ? "space-y-3" : "flex items-center gap-2"}
      >
        <label htmlFor={`${id}-q`} className={hero ? "block font-semibold text-on-road" : "sr-only"}>
          Waar wil je staan?
        </label>
        <div
          className={`flex flex-1 items-center gap-2 rounded-xl bg-surface text-ink ring-2 transition-shadow focus-within:ring-signal ${
            hero ? "h-14 px-4 ring-transparent" : "h-12 px-3 ring-line"
          }`}
        >
          <Icon name="search" size={hero ? 22 : 20} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            id={`${id}-q`}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${id}-o${active}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            value={text}
            placeholder="Plaats, provincie of naam van de plek"
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(e.target.value ? 1 : 0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Escape") setOpen(false);
            }}
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] placeholder:text-muted focus:outline-none"
          />
          {text && (
            <button
              type="button"
              aria-label="Zoekveld leegmaken"
              onClick={() => {
                setText("");
                inputRef.current?.focus();
              }}
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sunken"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className={`font-sign font-bold transition-colors ${
            hero
              ? "flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-signal text-lg text-on-signal hover:brightness-95"
              : "h-12 rounded-xl bg-road px-5 text-on-road hover:bg-road-deep"
          }`}
        >
          {hero ? "Zoek een camperplaats" : "Zoek"}
        </button>
      </form>

      {locating && <p className={`mt-2 text-sm ${hero ? "text-on-road" : "text-muted"}`}>Locatie bepalen…</p>}
      {geoError && (
        <p role="alert" className={`mt-2 rounded-lg px-3 py-2 text-sm ${hero ? "bg-surface text-alert" : "bg-alert-tint text-alert"}`}>
          {geoError}
        </p>
      )}

      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute inset-x-0 z-30 mt-2 max-h-[min(60vh,420px)] overflow-auto rounded-xl border border-line bg-surface py-1 text-ink shadow-lift ${
            hero ? "top-[5.25rem]" : "top-12"
          }`}
        >
          {options.map((o, i) => (
            <li
              key={`${o.type}-${o.label}-${i}`}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2 aria-selected:bg-road-tint"
            >
              <Icon
                name={o.type === "near" ? "locate" : o.type === "place" ? "home" : "pin"}
                size={20}
                className={o.type === "near" ? "text-road" : "text-muted"}
              />
              <span className="min-w-0">
                <span className={`block truncate ${o.type === "near" ? "font-semibold text-road" : "font-semibold"}`}>{o.label}</span>
                {"sub" in o && <span className="block truncate text-sm text-muted">{o.sub}</span>}
                {o.type === "province" && <span className="block text-sm text-muted">Provincie</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
