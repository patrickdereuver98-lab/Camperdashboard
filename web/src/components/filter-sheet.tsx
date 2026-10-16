"use client";

import { useMemo, useState } from "react";
import { applyFilters, DEFAULT_FILTERS, FACILITIES, pageOf, relaxations, type DepartureGroup, type Filters } from "@/lib/search";
import { KIND_LABEL, type PlaceKind, type PlaceSummary } from "@/lib/types";
import { Sheet } from "./sheet";
import { KIND_SIGN, Sign, type SignName } from "./sign";

const PRICES = [10, 15, 20, 25];
const LENGTHS = [7, 8, 9, 10];
const SCORES = [7, 8, 9];
const RADII = [10, 25, 50, 100];

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="flex min-h-12 items-center gap-2.5 rounded-xl border-2 border-line bg-surface px-3 text-left font-semibold transition-colors aria-pressed:border-forest aria-pressed:bg-forest-tint aria-pressed:text-forest"
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    // Een zwevende legend gedraagt zich als gewone kop binnen de padding van de fieldset
    <fieldset className="border-b border-line py-5 first:pt-1 last:border-0">
      <legend className="float-left mb-3 w-full font-display text-lg font-semibold">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

const DEPARTURE_CHOICES: { value: DepartureGroup | undefined; label: string }[] = [
  { value: undefined, label: "Alle plekken" },
  { value: "vrij", label: "Zonder vertrektijd" },
  { value: "uitslapers", label: "Uitslapers" },
  { value: "overig", label: "Overige" },
];

export function FilterSheet({
  open,
  onClose,
  filters,
  places,
  onApply,
  showScore,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  places: PlaceSummary[] | null;
  onApply: (f: Filters) => void;
  showScore?: boolean;
}) {
  const [draft, setDraft] = useState(filters);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(filters);
  }
  const count = useMemo(() => (places ? applyFilters(places, draft).length : null), [places, draft]);
  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));
  // "Overige" omvat ook de deelkeuzes "vóór 12:00" en "onbekend" van die pagina
  const chosen = (v: DepartureGroup | undefined) => (v === "overig" ? pageOf(draft.departure) === "overig" : draft.departure === v);
  const knownLength = useMemo(() => places?.filter((p) => p.maxLengthM !== undefined).length ?? 0, [places]);
  // Bij nul resultaten: welke ene verruiming levert het meeste op?
  const suggestion = useMemo(() => (places && count === 0 ? (relaxations(places, draft)[0] ?? null) : null), [places, draft, count]);
  const unknownPriceCount = useMemo(
    () => (places && (draft.free || draft.maxPrice) ? applyFilters(places, { ...draft, priceUnknown: true }).length - applyFilters(places, { ...draft, priceUnknown: false }).length : 0),
    [places, draft],
  );
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <>
        {count === 0 && (
          <p role="status" className="mb-3 text-sm text-ink-2">
            Geen plekken met deze combinatie.
            {suggestion && (
              <>
                {" "}
                <button type="button" onClick={() => setDraft(suggestion.next)} className="font-semibold text-forest underline">
                  {suggestion.label}: {suggestion.count} {suggestion.count === 1 ? "plek" : "plekken"}
                </button>
              </>
            )}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              setDraft({ ...DEFAULT_FILTERS, where: draft.where, center: draft.center, province: draft.province, radiusKm: draft.radiusKm, departure: draft.departure })
            }
            className="h-12 rounded-xl px-4 font-semibold text-forest underline"
          >
            Wis filters
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            disabled={count === 0}
            className="h-12 flex-1 rounded-xl bg-forest font-semibold text-on-forest hover:bg-forest-deep disabled:opacity-60"
          >
            {count === null ? "Toon plekken" : count === 0 ? "Geen plekken" : `Toon ${count} ${count === 1 ? "plek" : "plekken"}`}
          </button>
        </div>
        </>
      }
    >
      {draft.center && (
        <Section title={`Afstand vanaf ${draft.where ?? "je locatie"}`}>
          <div className="grid grid-cols-4 gap-2">
            {RADII.map((r) => (
              <Toggle key={r} pressed={draft.radiusKm === r} onClick={() => set({ radiusKm: r })}>
                <span className="w-full text-center">{r} km</span>
              </Toggle>
            ))}
          </div>
        </Section>
      )}

      <Section title="Aankomen en vertrekken">
        <div className="grid grid-cols-2 gap-2">
          {DEPARTURE_CHOICES.map((c) => (
            <Toggle key={c.label} pressed={chosen(c.value)} onClick={() => set({ departure: c.value })}>
              <Sign name="clock" size={30} state={chosen(c.value) && c.value ? "on" : "unknown"} />
              {c.label}
            </Toggle>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          Zonder vertrektijd: de website zegt letterlijk dat je kunt vertrekken wanneer je wilt. Uitslapers: vertrek om 12:00 of later.
        </p>
      </Section>

      <Section title="Voorzieningen">
        <div className="grid grid-cols-2 gap-2">
          {FACILITIES.map((f) => (
            <Toggle key={f.key} pressed={draft.facilities.includes(f.key)} onClick={() => set({ facilities: toggleIn(draft.facilities, f.key) })}>
              <Sign name={f.icon as SignName} size={30} state={draft.facilities.includes(f.key) ? "on" : "unknown"} />
              {f.label}
            </Toggle>
          ))}
        </div>
      </Section>

      <Section title="Prijs per nacht">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Toggle pressed={draft.free} onClick={() => set({ free: !draft.free, maxPrice: undefined })}>
            Gratis
          </Toggle>
          {PRICES.map((p) => (
            <Toggle key={p} pressed={draft.maxPrice === p} onClick={() => set({ maxPrice: draft.maxPrice === p ? undefined : p, free: false })}>
              Tot € {p}
            </Toggle>
          ))}
        </div>
        {(draft.free || draft.maxPrice) && (
          <label className="mt-3 flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={draft.priceUnknown}
              onChange={(e) => set({ priceUnknown: e.target.checked })}
              className="h-5 w-5 accent-[var(--forest)]"
            />
            <span>
              Ook plekken waarvan de prijs onbekend is
              {unknownPriceCount > 0 && <span className="text-muted"> ({unknownPriceCount})</span>}
            </span>
          </label>
        )}
      </Section>

      <Section title="Soort plek">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(KIND_LABEL) as PlaceKind[]).map((k) => (
            <Toggle key={k} pressed={draft.kinds.includes(k)} onClick={() => set({ kinds: toggleIn(draft.kinds, k) })}>
              <Sign name={KIND_SIGN[k]} size={30} state={draft.kinds.includes(k) ? "on" : "unknown"} />
              {KIND_LABEL[k]}
            </Toggle>
          ))}
        </div>
      </Section>

      <Section title="Lengte van je camper">
        <p className="-mt-1 mb-3 text-sm text-muted">
          Van {knownLength} plekken is de maximale lengte bekend. Plekken met een lagere maximale lengte vallen weg; plekken waarvan we het niet weten blijven staan.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {LENGTHS.map((l) => (
            <Toggle key={l} pressed={draft.minLength === l} onClick={() => set({ minLength: draft.minLength === l ? undefined : l })}>
              <span className="w-full text-center">{l} m</span>
            </Toggle>
          ))}
        </div>
      </Section>

      <Section title="Overig">
        <div className="grid gap-2">
          <Toggle pressed={draft.openNow} onClick={() => set({ openNow: !draft.openNow })}>
            <Sign name="calendar" size={30} state={draft.openNow ? "on" : "unknown"} />
            Verberg plekken die nu dicht zijn
          </Toggle>
          {showScore && (
            <div className="grid grid-cols-3 gap-2">
              {SCORES.map((s) => (
                <Toggle key={s} pressed={draft.minScore === s} onClick={() => set({ minScore: draft.minScore === s ? undefined : s })}>
                  <span className="w-full text-center">Score {s}+</span>
                </Toggle>
              ))}
            </div>
          )}
        </div>
      </Section>
    </Sheet>
  );
}
