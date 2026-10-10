"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EMPTY_FILTERS,
  parseQuery,
  searchHref,
  type Filters,
} from "@/lib/filters";
import { Icon } from "./icons";

const EXAMPLES = [
  "gratis aan het water in Zeeland",
  "Veluwe met stroom",
  "Friesland honden welkom",
  "Texel",
];

/**
 * Eén vrij tekstveld. "Gratis plek aan het water in Zeeland" wordt herkend
 * als filters; de rest zoekt op naam en woonplaats.
 */
export function SearchBox({
  size = "lg",
  initial = "",
  base,
  onSearch,
}: {
  size?: "lg" | "md";
  initial?: string;
  /** Filters die blijven staan; standaard begint een zoekopdracht opnieuw. */
  base?: Filters;
  onSearch?: (f: Filters) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const lg = size === "lg";

  function submit(value: string) {
    const parsed = parseQuery(value);
    const next: Filters = { ...(base ?? EMPTY_FILTERS), ...parsed };
    if (onSearch) onSearch(next);
    else router.push(searchHref(next));
  }

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className={`flex items-center gap-2 rounded-full border border-line bg-surface shadow-lift transition focus-within:border-forest ${
          lg ? "p-2 pl-5" : "p-1.5 pl-4"
        }`}
      >
        <Icon
          name="search"
          size={lg ? 22 : 18}
          className="shrink-0 text-muted"
        />
        <label htmlFor={`q-${size}`} className="sr-only">
          Waar wil je staan?
        </label>
        <input
          id={`q-${size}`}
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            lg
              ? "Waar wil je staan? Plaats, regio of wens…"
              : "Zoek op plaats, regio of wens…"
          }
          autoComplete="off"
          enterKeyHint="search"
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted focus:outline-none ${
            lg ? "py-2 text-lg" : "py-1.5 text-[15px]"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-forest font-semibold text-on-forest transition hover:bg-forest-deep ${
            lg ? "px-6 py-3 text-base" : "px-4 py-2 text-sm"
          }`}
        >
          Zoeken
        </button>
      </form>
      {lg && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className="flex items-center gap-1 text-muted">
            <Icon name="sparkle" size={14} /> Probeer:
          </span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                submit(ex);
              }}
              className="rounded-full border border-line bg-surface/70 px-3 py-1 transition hover:border-forest hover:text-forest"
            >
              {ex}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
