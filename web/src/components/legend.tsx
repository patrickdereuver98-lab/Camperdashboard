"use client";

import { useState } from "react";
import { FACILITIES } from "@/lib/search";
import { Icon } from "./icons";
import { DepartureChip } from "./place-ui";
import { Sheet } from "./sheet";
import { Sign } from "./sign";

/** Knop met uitleg van de icoontjes op kaarten en plekpagina's */
export function Legend({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-forest hover:underline ${className}`}
      >
        <Icon name="info" size={17} /> Wat betekenen de icoontjes?
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Wat betekenen de icoontjes?">
        <div className="space-y-7 pb-2">
          <section>
            <h3 className="font-semibold">Voorzieningen</h3>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {FACILITIES.map((f) => (
                <li key={f.key} className="flex items-center gap-3">
                  <Sign name={f.icon} size={32} />
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Kleur van het icoon</h3>
            <ul className="mt-3 space-y-3">
              <li className="flex items-center gap-3">
                <Sign name="power" size={32} state="on" />
                <span>Groen: is er</span>
              </li>
              <li className="flex items-center gap-3">
                <Sign name="power" size={32} state="unknown" />
                <span>Zandkleur: weten we nog niet</span>
              </li>
              <li className="flex items-center gap-3">
                <Sign name="power" size={32} state="off" />
                <span>Doorgestreept: is er niet</span>
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Vertrektijd</h3>
            <ul className="mt-3 space-y-3">
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DepartureChip place={{ departure: "vrij", departureCheck: "bevestigd" }} />
                <span className="text-ink-2">vertrekken wanneer je wilt</span>
              </li>
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DepartureChip place={{ departure: "per24", departureCheck: "bevestigd" }} />
                <span className="text-ink-2">je betaalt per 24 uur vanaf aankomst</span>
              </li>
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DepartureChip place={{ departure: "vast", checkoutUntil: "12:00" }} />
                <span className="text-ink-2">blauw: 12:00 of later</span>
              </li>
              <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <DepartureChip place={{ departure: "vast", checkoutUntil: "11:00" }} />
                <span className="text-ink-2">grijs: vóór 12:00 weg</span>
              </li>
            </ul>
            <p className="mt-3 text-sm text-muted">
              Groen staat er alleen als we het hebben gecontroleerd bij de plek zelf. Staat er niets, dan weten we de
              vertrektijd nog niet.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Open of dicht</h3>
            <ul className="mt-3 space-y-2 text-ink-2">
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-forest" /> Open, met het seizoen erbij
              </li>
              <li className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-alert" /> Nu gesloten
              </li>
            </ul>
          </section>
        </div>
      </Sheet>
    </>
  );
}
