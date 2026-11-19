"use client";

import Link from "next/link";
import { useId } from "react";
import { Chip } from "@/components/chip";
import type { Avoid } from "@/lib/route-options";
import type { RoutePrefs } from "@/lib/route-prefs";
import type { Vehicle } from "@/lib/vehicle";

const AVOID_LABEL: Record<Avoid, string> = { tolls: "Tolwegen", ferries: "Veerponten", highways: "Snelwegen" };
const MAX_DRIVE = [0, 120, 180, 240, 300, 360, 480];

/** "3,1 m hoog, 3.500 kg, 7,4 m lang" */
export function vehicleText(v: Vehicle): string {
  const nf = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
  return [
    v.heightM && `${nf.format(v.heightM)} m hoog`,
    v.weightKg && `${nf.format(v.weightKg)} kg`,
    v.lengthM && `${nf.format(v.lengthM)} m lang`,
    v.widthM && `${nf.format(v.widthM)} m breed`,
  ]
    .filter(Boolean)
    .join(", ");
}

function NumberField({ label, value, onChange, step = 1, min = 0, max, hint }: { label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-11 w-full rounded-lg border border-field bg-surface px-3"
      />
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function RoutePrefsPanel({ prefs, onChange, vehicle }: { prefs: RoutePrefs; onChange: (p: RoutePrefs) => void; vehicle: Vehicle }) {
  const timeId = useId();
  const maxId = useId();
  const dims = vehicleText(vehicle);
  const set = <K extends keyof RoutePrefs>(k: K, v: RoutePrefs[K]) => onChange({ ...prefs, [k]: v });
  return (
    <details className="mt-3 rounded-lg bg-sunken p-4" data-testid="route-prefs">
      <summary className="-my-2.5 cursor-pointer py-2.5 font-semibold">Rijden en route</summary>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={timeId} className="mb-1 block text-sm font-semibold">
            Je vertrekt meestal om
          </label>
          <input
            id={timeId}
            type="time"
            value={prefs.departTime}
            onChange={(e) => e.target.value && set("departTime", e.target.value)}
            className="h-11 w-full rounded-lg border border-field bg-surface px-3"
          />
        </div>
        <div>
          <label htmlFor={maxId} className="mb-1 block text-sm font-semibold">
            Hooguit rijden per dag
          </label>
          <select
            id={maxId}
            value={MAX_DRIVE.includes(prefs.maxDriveMin) ? prefs.maxDriveMin : 240}
            onChange={(e) => set("maxDriveMin", Number(e.target.value))}
            className="h-11 w-full rounded-lg border border-field bg-surface px-3"
          >
            {MAX_DRIVE.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "Geen grens" : `${m / 60} uur`}
              </option>
            ))}
          </select>
        </div>
        <NumberField label="Pauze per 2 uur (min)" value={prefs.pauseMin} max={120} onChange={(n) => set("pauseMin", n)} />
        <NumberField label="Tussenstop duurt (min)" value={prefs.stopoverMin} min={5} max={480} step={5} onChange={(n) => set("stopoverMin", n)} />
        <div className="col-span-2">
          <NumberField
            label="Langer onderweg dan de routeplanner (%)"
            value={prefs.slowerPct}
            max={50}
            onChange={(n) => set("slowerPct", n)}
            hint="De routeplanner rekent met de snelheid van een personenauto. Rij je rustiger, of mag je camper op de snelweg maar 80 km/u, tel dan bijvoorbeeld 10 tot 20% op."
          />
        </div>
      </div>

      <p className="mt-4 text-sm font-semibold">Vermijden</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {(Object.keys(AVOID_LABEL) as Avoid[]).map((a) => (
          <Chip key={a} pressed={prefs.avoid.includes(a)} onClick={() => set("avoid", prefs.avoid.includes(a) ? prefs.avoid.filter((x) => x !== a) : [...prefs.avoid, a])}>
            {AVOID_LABEL[a]}
          </Chip>
        ))}
      </div>

      <p className="mt-4 text-sm font-semibold">Je camper</p>
      {dims ? (
        <div className="mt-1">
          <Chip pressed={prefs.useVehicle} onClick={() => set("useVehicle", !prefs.useVehicle)}>
            Rekening houden met {dims}
          </Chip>
          <p className="mt-1 text-sm text-muted">
            Dan mijden we te lage bruggen en te zware wegen. De route kan daardoor soms omrijden, net als voor vrachtverkeer.
          </p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-2">
          Vul de hoogte en het gewicht in bij{" "}
          <Link href="/mijn-camper" className="font-semibold text-forest underline">
            Mijn camper
          </Link>
          , dan houdt de route daar rekening mee.
        </p>
      )}
    </details>
  );
}
