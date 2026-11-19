"use client";

import Link from "next/link";
import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { eur, formatDuration, pluralize } from "@/lib/format";
import { distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { closedText, shortDay, type DatedStop } from "@/lib/trip-dates";
import { clock, minutesText, type Leg, type LegPlan } from "@/lib/trip-plan";
import { MAX_NOTE } from "@/lib/trip-merge";
import type { PlaceSummary } from "@/lib/types";
import { Icon } from "@/components/icons";
import { OpenChip, PlacePhoto } from "@/components/place-ui";

export type StopView = { slug: string; nights: number; note?: string; place: PlaceSummary };

const warnBox = "mt-1.5 flex items-start gap-2 rounded-lg px-3 py-2 text-sm";

/** De regel tussen twee stops: rijtijd, vertrek en aankomst, en wat er niet past */
export function LegRow({
  leg,
  plan,
  date,
  from,
  to,
  loading,
  maxDriveMin,
  onFindStop,
}: {
  leg?: Leg;
  plan?: LegPlan;
  date?: Date;
  from: LatLng;
  to: { lat: number; lng: number; checkinFrom?: string; checkinUntil?: string };
  loading: boolean;
  maxDriveMin: number;
  onFindStop?: () => void;
}) {
  return (
    <div className="flex gap-3 py-2 pl-5 text-sm text-ink-2" data-testid="leg">
      <span className="w-0 shrink-0 border-l-[3px] border-dotted border-forest" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {leg ? (
          <p>
            {date && <span className="font-semibold">{shortDay(date)}: </span>}
            {plan ? minutesText(plan.driveMin) : formatDuration(leg.durationS)} rijden, {formatKm(leg.distanceM / 1000)}
            {plan && plan.pauseMin > 0 ? `, plus ${plan.pauseMin} min pauze` : ""}
          </p>
        ) : (
          <p>{loading ? "Route berekenen…" : `${formatKm(distanceKm(from, to))} hemelsbreed`}</p>
        )}
        {plan && (
          <p data-testid="leg-times">
            Vertrek {clock(plan.departMin)}
            {plan.departSource === "plek" ? " (uiterlijke vertrektijd van de plek)" : plan.departSource === "tussenstop" ? " na de tussenstop" : ""}, aankomst rond{" "}
            {clock(plan.arriveMin)}
          </p>
        )}
        {plan?.per24Until !== undefined && (
          <p className={`${warnBox} bg-sunken text-ink`} data-testid="leg-per24">
            <Icon name="clock" size={17} className="mt-0.5 shrink-0" />
            <span>
              Hier betaal je per 24 uur. Je kwam rond {clock(plan.per24Until)} aan; vertrek je later, dan betaal je mogelijk een dag extra.
            </span>
          </p>
        )}
        {plan?.status === "laat" && (
          <p className={`${warnBox} bg-alert-tint text-alert`} data-testid="leg-late">
            <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
            <span>
              Je bent er na de laatste aankomsttijd ({to.checkinUntil}). Vertrek eerder of kies een plek die dichterbij ligt.
            </span>
          </p>
        )}
        {plan?.status === "vroeg" && plan.waitMin !== undefined && (
          <p className={`${warnBox} bg-sunken text-ink`} data-testid="leg-early">
            <Icon name="clock" size={17} className="mt-0.5 shrink-0" />
            <span>
              Aankomen kan vanaf {to.checkinFrom}. Je bent er {minutesText(plan.waitMin)} eerder.
            </span>
          </p>
        )}
        {plan?.overLimit && (
          <div className={`${warnBox} bg-sunken text-ink`} data-testid="leg-long">
            <Icon name="alert" size={17} className="mt-0.5 shrink-0" />
            <div>
              <p>
                Deze dag rijd je {minutesText(plan.dayDriveMin)}, langer dan de {minutesText(maxDriveMin)} die je wilt.
              </p>
              {onFindStop && (
                <button type="button" onClick={onFindStop} className="-my-1 min-h-11 font-semibold text-forest underline">
                  Zoek een tussenstop
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StopNote({ note, onSave }: { note?: string; onSave: (n: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  if (!open)
    return (
      <div className="mt-1">
        {note && <p className="text-sm whitespace-pre-line text-ink-2" data-testid="stop-note">{note}</p>}
        <button type="button" onClick={() => setOpen(true)} className="-my-1 min-h-11 text-sm font-semibold text-forest underline">
          {note ? "Notitie aanpassen" : "Notitie toevoegen"}
        </button>
      </div>
    );
  return (
    <div className="mt-2">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Notitie</span>
        <span className="mb-1 block text-sm text-muted">Plan je samen, dan zien je reisgenoten hem ook.</span>
        <textarea
          autoFocus
          value={draft}
          maxLength={MAX_NOTE}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-field bg-surface px-3 py-2 text-base focus:ring-2 focus:ring-forest focus:outline-none"
        />
      </label>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => {
            onSave(draft.trim());
            setOpen(false);
          }}
          className="h-11 rounded-md bg-forest px-4 font-semibold text-on-forest"
        >
          Bewaren
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(note ?? "");
            setOpen(false);
          }}
          className="h-11 px-3 font-semibold text-forest underline"
        >
          Annuleren
        </button>
      </div>
    </div>
  );
}

export interface StopActions {
  setNights: (slug: string, n: number) => void;
  setNote: (slug: string, note: string) => void;
  move: (from: number, to: number) => void;
  remove: (slug: string) => void;
}

/** Eén stop: sleepgreep, foto, naam, datums, nachten, volgorde, verwijderen en notitie */
export function StopItem({
  stop,
  index,
  count,
  dated,
  legRow,
  actions,
  onDragEnd,
}: {
  stop: StopView;
  index: number;
  count: number;
  dated?: DatedStop;
  legRow?: React.ReactNode;
  actions: StopActions;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const s = stop;
  return (
    <Reorder.Item value={s.slug} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="relative list-none" data-testid="trip-stop">
      {legRow}
      <div className="rounded-lg border border-line bg-surface p-3">
        <div className="flex gap-3">
          <button
            type="button"
            aria-label={`${s.place.name} verslepen`}
            title="Sleep om te verplaatsen"
            onPointerDown={(e) => controls.start(e)}
            className="-my-1 -ml-2 grid min-h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted hover:bg-sunken active:cursor-grabbing"
          >
            <Icon name="grip" size={22} strokeWidth={3} />
          </button>
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
            <PlacePhoto src={s.place.imageUrl} alt="" kind={s.place.kind} className="h-full w-full" />
            <span className="absolute top-1 left-1 grid h-6 w-6 place-items-center rounded-full bg-forest font-display text-sm font-semibold text-on-forest">
              {index + 1}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/plek/${s.slug}`} className="-my-2 block truncate py-2.5 font-display text-[1.0625rem] font-semibold hover:text-forest sm:text-lg">
              {s.place.name}
            </Link>
            {dated ? (
              <p className="text-sm font-semibold text-ink-2" data-testid="stop-dates">
                {s.nights === 0 ? `Tussenstop op ${shortDay(dated.arrive)}` : `${shortDay(dated.arrive)} tot ${shortDay(dated.leave)}`}
              </p>
            ) : (
              <OpenChip place={s.place} />
            )}
            <p className="truncate text-sm text-muted">
              {s.place.town},{" "}
              {s.place.priceEur === undefined
                ? "prijs onbekend"
                : s.place.priceEur === 0
                  ? "gratis"
                  : `${s.place.priceFrom ? "vanaf " : ""}${eur(s.place.priceEur)} per nacht`}
            </p>
          </div>
        </div>
        {dated && dated.closedNights.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert" data-testid="stop-closed">
            <Icon name="calendar" size={17} className="mt-0.5 shrink-0" />
            <span>
              Volgens het seizoen{s.place.season ? ` (${s.place.season.replace(" – ", " t/m ")})` : ""} is deze plek dicht op {closedText(dated.closedNights)}. Kies een
              andere datum of bel even voor je gaat.
            </span>
          </p>
        )}
        <div className="mt-2 flex items-center gap-1">
          <div className="flex items-center rounded-lg border border-line" role="group" aria-label={`Nachten bij ${s.place.name}`}>
            <button
              type="button"
              aria-label="Een nacht minder"
              disabled={s.nights <= 0}
              onClick={() => actions.setNights(s.slug, s.nights - 1)}
              className="grid h-11 w-11 place-items-center disabled:opacity-30"
            >
              <Icon name="minus" size={18} />
            </button>
            <span className="min-w-[5.5rem] text-center font-semibold" aria-live="polite">
              {s.nights === 0 ? "Tussenstop" : pluralize(s.nights, "nacht", "nachten")}
            </span>
            <button type="button" aria-label="Een nacht meer" onClick={() => actions.setNights(s.slug, s.nights + 1)} className="grid h-11 w-11 place-items-center">
              <Icon name="plus" size={18} />
            </button>
          </div>
          <div className="ml-auto flex items-center">
            <button
              type="button"
              aria-label="Eerder in de reis"
              disabled={index === 0}
              onClick={() => actions.move(index, index - 1)}
              className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sunken disabled:opacity-25"
            >
              <Icon name="chevronUp" />
            </button>
            <button
              type="button"
              aria-label="Later in de reis"
              disabled={index === count - 1}
              onClick={() => actions.move(index, index + 1)}
              className="grid h-11 w-11 place-items-center rounded-lg hover:bg-sunken disabled:opacity-25"
            >
              <Icon name="chevronDown" />
            </button>
            <button
              type="button"
              aria-label={`${s.place.name} verwijderen`}
              onClick={() => actions.remove(s.slug)}
              className="grid h-11 w-11 place-items-center rounded-lg text-alert hover:bg-alert-tint"
            >
              <Icon name="trash" size={19} />
            </button>
          </div>
        </div>
        <StopNote key={s.note ?? ""} note={s.note} onSave={(n) => actions.setNote(s.slug, n)} />
      </div>
    </Reorder.Item>
  );
}

export { Reorder };
