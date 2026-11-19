"use client";

import { useEffect, useId, useState } from "react";
import type { Location, SuggestAnswer } from "@/lib/pdok";
import type { Endpoint } from "@/lib/route-prefs";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icons";

/** Adres zoeken via onze eigen /api/locatie (PDOK); de browser praat zelf niet met PDOK */
function AddressSearch({ onPick, onCancel }: { onPick: (e: Endpoint) => void; onCancel: () => void }) {
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/locatie?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SuggestAnswer>) : Promise.reject()))
        .then(
          (a) => {
            setResults(a.resultaten.slice(0, 6));
            setError(null);
          },
          () => !ctrl.signal.aborted && setError("Zoeken lukt nu niet. Probeer het zo nog eens."),
        );
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  async function pick(l: Location) {
    let lat = l.lat;
    let lng = l.lng;
    if ((lat === undefined || lng === undefined) && l.id) {
      const r = await fetch(`/api/locatie?id=${encodeURIComponent(l.id)}`).catch(() => null);
      const full = r?.ok ? ((await r.json()) as Location) : null;
      lat = full?.lat;
      lng = full?.lng;
    }
    if (lat === undefined || lng === undefined) return setError("Van dit adres weten we de plek niet. Kies een ander.");
    onPick({ label: l.label, lat, lng, kind: "adres" });
  }

  return (
    <div className="mt-3">
      <label htmlFor={id} className="block text-sm font-semibold">
        Adres, postcode of plaats
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="street-address"
          className="h-11 min-w-0 flex-1 rounded-lg border border-field bg-surface px-3 text-base focus:ring-2 focus:ring-forest focus:outline-none"
        />
        <button type="button" onClick={onCancel} className="h-11 px-2 font-semibold text-forest underline">
          Annuleren
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
      {q.trim().length >= 2 && results.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {results.map((l) => (
            <li key={l.id ?? l.label}>
              <button type="button" onClick={() => pick(l)} className="flex min-h-11 w-full items-center px-3 py-2 text-left hover:bg-sunken">
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useMyLocation(onPick: (e: Endpoint) => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locate = () => {
    setError(null);
    if (!navigator.geolocation) return setError("Je browser kan je locatie niet bepalen.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        onPick({ label: "Je locatie", lat: p.coords.latitude, lng: p.coords.longitude, kind: "locatie" });
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? "Geen toegang tot je locatie. Sta het toe in je browser." : "Je locatie kon niet worden bepaald. Probeer het opnieuw.");
      },
      { timeout: 12000 },
    );
  };
  return { locate, error, busy };
}

/** Beginpunt van de reis: je locatie of een adres (bijvoorbeeld thuis). Staat alleen op dit toestel. */
export function StartCard({ start, onChange }: { start: Endpoint | null; onChange: (e: Endpoint | null) => void }) {
  const [searching, setSearching] = useState(false);
  const { locate, error, busy } = useMyLocation((e) => onChange(e));
  return (
    <div className="mb-3 rounded-lg border border-line bg-surface p-3" data-testid="start-card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
          <Icon name={start?.kind === "adres" ? "home" : "locate"} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Beginpunt</p>
          <p className="truncate text-sm text-muted">{start ? start.label : "Eerste stop"}</p>
        </div>
        {start && (
          <button type="button" onClick={() => onChange(null)} className="h-11 px-3 font-semibold text-forest underline">
            Wissen
          </button>
        )}
      </div>
      {!searching && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={locate} disabled={busy} className="h-11 rounded-md border border-line px-3 font-semibold hover:border-forest disabled:opacity-60">
            {busy ? "Locatie bepalen…" : "Mijn locatie"}
          </button>
          <button type="button" onClick={() => setSearching(true)} className="h-11 rounded-md border border-line px-3 font-semibold hover:border-forest">
            Adres kiezen
          </button>
        </div>
      )}
      {searching && (
        <AddressSearch
          onPick={(e) => {
            onChange(e);
            setSearching(false);
          }}
          onCancel={() => setSearching(false)}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type EndChoice = "laatste" | "start" | Endpoint;

/** Waar de reis eindigt: bij de laatste stop, terug naar het beginpunt, of een ander adres */
export function EndCard({ end, hasStart, onChange }: { end: EndChoice; hasStart: boolean; onChange: (e: EndChoice) => void }) {
  const [searching, setSearching] = useState(false);
  const mode = typeof end === "string" ? end : "adres";
  const options: { value: "laatste" | "start" | "adres"; label: string }[] = [
    { value: "laatste", label: "Bij de laatste stop" },
    ...(hasStart ? [{ value: "start" as const, label: "Terug naar het beginpunt" }] : []),
    { value: "adres", label: "Ander adres" },
  ];
  return (
    <fieldset className="mt-3 rounded-lg border border-line bg-surface p-3" data-testid="end-card">
      <legend className="sr-only">Eindpunt</legend>
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunken text-ink-2">
          <Icon name="flag" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold" aria-hidden="true">
            Eindpunt
          </p>
          <p className="truncate text-sm text-muted">{typeof end === "string" ? (end === "start" ? "Terug naar het beginpunt" : "De laatste stop") : end.label}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip
            key={o.value}
            pressed={mode === o.value}
            onClick={() => {
              if (o.value === "adres") return setSearching(true);
              setSearching(false);
              onChange(o.value);
            }}
          >
            {o.label}
          </Chip>
        ))}
      </div>
      {searching && (
        <AddressSearch
          onPick={(e) => {
            onChange(e);
            setSearching(false);
          }}
          onCancel={() => setSearching(false)}
        />
      )}
    </fieldset>
  );
}
