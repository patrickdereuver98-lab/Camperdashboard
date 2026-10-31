"use client";

import { useState } from "react";
import { Sign, type SignName } from "@/components/sign";
import { FACILITY_COLUMN, type FacilityChanges } from "@/lib/facility-update";
import { FACILITIES, type FacilityKey } from "@/lib/search";
import { errorMessage, supabase } from "@/lib/supabase-browser";

type Value = boolean | undefined;
type State = "vraag" | "versturen" | "bedankt" | "fout";

const NO: Record<FacilityKey, string> = {
  power: "Geen stroom",
  water: "Geen water",
  dumpStation: "Niet lozen",
  toilet: "Geen toilet",
  shower: "Geen douche",
  wifi: "Geen wifi",
  dogs: "Geen honden",
};

/** De vraag per voorziening, zoals een camperaar hem stelt */
const QUESTION: Record<FacilityKey, string> = {
  power: "Is hier stroom?",
  water: "Kun je hier water innemen?",
  dumpStation: "Kun je hier lozen?",
  toilet: "Is hier een toilet?",
  shower: "Is hier een douche?",
  wifi: "Is hier wifi?",
  dogs: "Zijn honden hier welkom?",
};

/**
 * Voorzieningen als raster (redesign 30 oktober 2026). Bekend: aanwezig of niet. Onbekend: een "?" die in de cel zelf
 * vraagt "Ja / Nee / Weet ik niet", zonder formulier. Een antwoord gaat als inzending naar beheer (submit_place, zelfde
 * vorm als "Klopt er iets niet?" → Voorzieningen); beheer neemt het met één klik over. Op de site verandert niets
 * voordat beheer het heeft gecontroleerd: we zeggen dat ook.
 */
export function FacilityGrid({ placeId, placeName, values }: { placeId: string; placeName: string; values: Partial<Record<FacilityKey, Value>> }) {
  const [open, setOpen] = useState<FacilityKey | null>(null);
  const [state, setState] = useState<Partial<Record<FacilityKey, State>>>({});
  const [answer, setAnswer] = useState<Partial<Record<FacilityKey, boolean>>>({});
  const [err, setErr] = useState<string | null>(null);

  async function send(key: FacilityKey, value: boolean) {
    setState((s) => ({ ...s, [key]: "versturen" }));
    setErr(null);
    const changes: FacilityChanges = { [FACILITY_COLUMN[key]]: { was: values[key] ?? null, nieuw: value } };
    const { error } = await supabase().rpc("submit_place", {
      p_kind: "correctie",
      p_place_id: placeId,
      p_payload: { onderwerp: "voorzieningen", plek: placeName, voorzieningen: changes, toelichting: "" },
      p_contact_name: "",
      p_contact_email: "",
    });
    if (error) {
      setState((s) => ({ ...s, [key]: "fout" }));
      setErr(errorMessage(error));
      return;
    }
    setAnswer((a) => ({ ...a, [key]: value }));
    setState((s) => ({ ...s, [key]: "bedankt" }));
    setOpen(null);
  }

  return (
    <>
      {/* Eén raster met haarlijnen (gap-px op de lijnkleur). De laatste cel vult de rij, zodat er nooit een leeg grijs vak
          staat; een geopende vraag maakt alleen de eigen cel hoger, de volgorde blijft gelijk. */}
      <ul className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {FACILITIES.map((f) => {
          const v = values[f.key];
          const sign = f.icon as SignName;
          const isOpen = open === f.key;
          const st = state[f.key];
          // Bovenaan uitgelijnd: wordt een buurcel hoger door een open vraag, dan blijft de tekst op dezelfde regel staan
          const cell = "flex min-h-12 items-start gap-2 px-3 py-3.5 text-sm leading-5 last:col-span-full";
          if (v !== undefined)
            return (
              <li key={f.key} className={`${cell} bg-surface ${v ? "font-semibold text-ink" : "text-muted"}`}>
                <Sign name={sign} size={18} state={v ? "on" : "off"} />
                {v ? f.label : NO[f.key]}
              </li>
            );
          if (st === "bedankt")
            return (
              <li key={f.key} className={`${cell} bg-forest-tint`} role="status">
                <Sign name={sign} size={18} state="on" />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{f.label}: {answer[f.key] ? "ja" : "nee"}</span>
                  <span className="block text-muted">Bedankt, we controleren het</span>
                </span>
              </li>
            );
          return (
            <li key={f.key} className={`text-sm last:col-span-full ${isOpen ? "bg-forest-tint" : "bg-surface"}`}>
              <div className="flex min-h-12 items-center gap-2 py-0.5 pr-0.5 pl-3">
                <Sign name={sign} size={18} state="unknown" />
                <span className="min-w-0 flex-1 leading-tight text-ink-2">
                  {f.label}
                  <span className="block text-muted">Onbekend</span>
                </span>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${QUESTION[f.key]} Geef het door`}
                  onClick={() => setOpen(isOpen ? null : f.key)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface font-display text-base font-semibold text-forest hover:border-forest aria-expanded:border-forest aria-expanded:bg-forest aria-expanded:text-on-forest"
                >
                  ?
                </button>
              </div>
              {isOpen && (
                <div className="animate-fade-in px-3 pb-3">
                  <p className="text-ink-2">{QUESTION[f.key]}</p>
                  <div role="group" aria-label={QUESTION[f.key]} className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ["Ja", true],
                        ["Nee", false],
                        ["Weet ik niet", null],
                      ] as const
                    ).map(([label, value]) => (
                      <button
                        key={label}
                        type="button"
                        disabled={st === "versturen"}
                        onClick={() => (value === null ? setOpen(null) : send(f.key, value))}
                        className={`min-h-11 rounded-md border px-2 font-semibold disabled:opacity-60 ${
                          value === null ? "col-span-2 border-transparent text-muted underline hover:text-ink" : "border-line bg-surface text-ink hover:border-forest"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {err && (
        <p role="alert" className="mt-2 rounded-md border border-alert/40 bg-alert-tint px-3 py-2 text-sm text-alert">
          {err}
        </p>
      )}
    </>
  );
}
