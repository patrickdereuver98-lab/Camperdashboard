"use client";

import { useId, useState } from "react";
import { pluralize } from "@/lib/format";
import type { Trip } from "@/lib/store";
import { MAX_TRIPS, MAX_TRIP_NAME } from "@/lib/trip-storage";
import { Icon } from "@/components/icons";

type Removed = { trip: Trip; index: number; wasActive: boolean };

export interface TripsApi {
  list: Trip[];
  active: Trip;
  create: (name: string) => string | undefined;
  rename: (id: string, name: string) => void;
  select: (id: string) => void;
  remove: (id: string) => Removed | undefined;
}

/** Eén regel met een tekstveld en een knop: voor een nieuwe reis en voor een andere naam */
function NameForm({ label, initial, submit, onSubmit, onCancel }: { label: string; initial: string; submit: string; onSubmit: (name: string) => void; onCancel: () => void }) {
  const id = useId();
  const [name, setName] = useState(initial);
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim());
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        autoFocus
        value={name}
        maxLength={MAX_TRIP_NAME}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 h-11 w-full rounded-lg border border-field bg-surface px-3 text-base focus:ring-2 focus:ring-forest focus:outline-none"
      />
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={!name.trim()} className="h-11 rounded-md bg-forest px-4 font-semibold text-on-forest disabled:opacity-60">
          {submit}
        </button>
        <button type="button" onClick={onCancel} className="h-11 px-3 font-semibold text-forest underline">
          Annuleren
        </button>
      </div>
    </form>
  );
}

/**
 * Meerdere reizen naast elkaar, alleen op dit toestel: lijst met naam, aanmaken, hernoemen, wisselen en verwijderen
 * (met "Ongedaan maken" via `onRemoved`). De reis die je samen plant kun je pas verwijderen als je stopt met samen plannen.
 */
export function TripSwitcher({
  trips,
  linkedId,
  signedIn = false,
  onRemoved,
}: {
  trips: TripsApi;
  linkedId?: string;
  /** Ingelogd: de bovenste reis gaat met je account mee; die verwijderen zou je account stil vervangen */
  signedIn?: boolean;
  onRemoved: (r: Removed) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<"nieuw" | "naam" | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const panelId = useId();
  const active = trips.active;
  const full = trips.list.length >= MAX_TRIPS;

  return (
    <div className="mt-1" data-testid="trip-switcher">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setForm(null);
          setBlocked(null);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="-ml-1 flex h-11 items-center gap-1.5 rounded-md px-1 font-semibold text-forest"
      >
        <Icon name="list" size={18} /> {trips.list.length > 1 ? `Reizen (${trips.list.length})` : "Reizen"}
        <Icon name={open ? "chevronUp" : "chevronDown"} size={18} />
      </button>
      {open && (
        <div id={panelId} className="animate-fade-in mt-1 rounded-lg border border-line bg-surface p-3" data-testid="trip-list">
          <p className="text-sm text-muted">Je reizen staan alleen op dit toestel. Met je account gaat alleen de bovenste mee.</p>
          <ul className="mt-2 divide-y divide-line">
            {trips.list.map((t) => {
              const current = t.id === active.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      trips.select(t.id);
                      setForm(null);
                      setBlocked(null);
                    }}
                    aria-current={current ? "true" : undefined}
                    className="flex min-h-12 w-full items-center gap-3 py-1.5 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${current ? "font-semibold" : ""}`}>{t.name}</span>
                      <span className="block text-sm text-muted">
                        {pluralize(t.stops.length, "stop", "stops")}
                        {t.id === linkedId ? ", samen plannen" : ""}
                      </span>
                    </span>
                    {current && <Icon name="check" size={18} className="shrink-0 text-forest" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {form === "nieuw" ? (
            <NameForm
              label="Naam van de nieuwe reis"
              initial=""
              submit="Reis maken"
              onSubmit={(name) => {
                trips.create(name);
                setForm(null);
              }}
              onCancel={() => setForm(null)}
            />
          ) : form === "naam" ? (
            <NameForm
              key={active.id}
              label="Naam van deze reis"
              initial={active.name}
              submit="Bewaren"
              onSubmit={(name) => {
                trips.rename(active.id, name);
                setForm(null);
              }}
              onCancel={() => setForm(null)}
            />
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setForm("nieuw")}
                disabled={full}
                className="flex h-11 items-center gap-1.5 rounded-md border border-line px-3 font-semibold hover:border-forest disabled:opacity-60"
              >
                <Icon name="plus" size={18} /> Nieuwe reis
              </button>
              <button type="button" onClick={() => setForm("naam")} className="flex h-11 items-center gap-1.5 rounded-md border border-line px-3 font-semibold hover:border-forest">
                <Icon name="edit" size={18} /> Naam wijzigen
              </button>
              <button
                type="button"
                onClick={() => {
                  if (active.id === linkedId) return setBlocked("Deze reis plan je samen. Stop eerst met samen plannen, dan kun je hem verwijderen.");
                  if (signedIn && trips.list.length > 1 && trips.list[0].id === active.id)
                    return setBlocked("Deze reis gaat mee met je account. Haal er stops uit of wis hem, maar verwijderen kan pas als het je enige reis is.");
                  const r = trips.remove(active.id);
                  if (r) onRemoved(r);
                }}
                className="flex h-11 items-center gap-1.5 rounded-md px-3 font-semibold text-alert underline"
              >
                <Icon name="trash" size={18} /> Reis verwijderen
              </button>
            </div>
          )}
          {full && !form && <p className="mt-2 text-sm text-muted">Je hebt {MAX_TRIPS} reizen. Verwijder er een om een nieuwe te maken.</p>}
          {blocked && (
            <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert">
              {blocked}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
