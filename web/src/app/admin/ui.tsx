"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { errorMessage, supabase } from "@/lib/supabase-browser";

/**
 * Kleine hook om een Supabase-query te laden; herlaadt als `deps` veranderen of via reload().
 * Bij herladen blijft de vorige data staan; bij andere `deps` (ander tabblad, andere zoekterm) niet, zodat er nooit
 * rijen van de vorige query met het verkeerde type verschijnen.
 */
export function useQuery<T>(fn: () => PromiseLike<{ data: T | null; error: unknown }>, deps: unknown[]) {
  const [state, setState] = useState<{ key: string; deps: string; data: T | null; error: string | null }>({
    key: "",
    deps: "",
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const depsKey = JSON.stringify(deps);
  const key = `${depsKey}#${tick}`;
  useEffect(() => {
    let live = true;
    Promise.resolve(fnRef.current()).then(
      (res) =>
        live &&
        setState((s) => ({
          key,
          deps: depsKey,
          data: res.error ? (s.deps === depsKey ? s.data : null) : res.data,
          error: res.error ? errorMessage(res.error) : null,
        })),
      (e) => live && setState((s) => ({ key, deps: depsKey, data: s.deps === depsKey ? s.data : null, error: errorMessage(e) })),
    );
    return () => {
      live = false;
    };
  }, [key, depsKey]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const same = state.deps === depsKey;
  return { data: same ? state.data : null, error: same ? state.error : null, loading: state.key !== key, reload };
}

export const db = supabase;

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface p-4 outline-1 outline-line outline ${className}`}>{children}</div>;
}

const TONES = {
  neutral: "bg-sunken text-ink-2",
  road: "bg-lake-tint text-lake",
  green: "bg-forest-tint text-forest",
  red: "bg-alert-tint text-alert",
  yellow: "bg-ember-tint text-ember",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-alert-tint px-4 py-3 font-semibold text-alert">
      {message}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center text-muted">{children}</p>;
}

export const input =
  "h-12 w-full rounded-xl border-2 border-line bg-surface px-3 focus:border-forest focus:outline-none disabled:opacity-60";
export const textarea = "w-full rounded-xl border-2 border-line bg-surface px-3 py-2 focus:border-forest focus:outline-none";
export const button = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-colors disabled:opacity-50";
export const primary = `${button} bg-forest text-on-forest hover:bg-forest-deep`;
export const secondary = `${button} border-2 border-line bg-surface hover:border-forest`;
export const danger = `${button} border-2 border-alert/40 bg-surface text-alert hover:bg-alert-tint`;

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-surface px-4 text-sm font-semibold aria-checked:border-forest aria-checked:bg-forest aria-checked:text-on-forest"
        >
          {o.label}
          {o.count !== undefined && <span className="opacity-75">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function when(ts: string) {
  return new Date(ts).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
