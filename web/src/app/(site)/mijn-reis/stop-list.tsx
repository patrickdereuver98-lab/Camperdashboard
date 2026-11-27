"use client";

import Link from "next/link";
import { useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { departureShort, eur, formatDuration, pluralize } from "@/lib/format";
import { distanceKm, formatKm, type LatLng } from "@/lib/geo";
import { closedText, shortDay, type DatedStop } from "@/lib/trip-dates";
import { clock, minutesText, type Leg, type LegPlan } from "@/lib/trip-plan";
import { MAX_NOTE, MAX_NOTES, newNoteId, type TripNote, type TripPoint } from "@/lib/trip-merge";
import type { CorridorHit } from "@/lib/route-corridor";
import type { PlaceSummary } from "@/lib/types";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icons";
import { DepartureChip, OpenChip, PlacePhoto } from "@/components/place-ui";
import { isIncomplete } from "@/lib/place-status";

/**
 * Een stop zoals de lijst hem toont. Bij een eigen punt (`point`) is `place` alleen naam en ligging (zie `pointPlace`
 * in trip-app.tsx): geen plekgegevens, en die tonen we ook niet.
 */
export type StopView = { slug: string; nights: number; notes?: TripNote[]; point?: TripPoint; place: PlaceSummary };

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
  suggestions,
  fromPlace,
}: {
  leg?: Leg;
  plan?: LegPlan;
  date?: Date;
  from: LatLng;
  to: { lat: number; lng: number; checkinFrom?: string; checkinUntil?: string };
  loading: boolean;
  maxDriveMin: number;
  onFindStop?: () => void;
  /** Voorstellen om te overnachten rond het punt waar de dag vol is (OvernightList) */
  suggestions?: React.ReactNode;
  /** De plek waar je vertrekt (niet bij een beginpunt of eigen punt): zonder bekende vertrektijd is de aankomst onzeker */
  fromPlace?: PlaceSummary;
}) {
  // Rekent de planning met jouw eigen vertrektijd omdat de plek er geen noemt? Dan is de aankomst niet betrouwbaar
  const unreliable = !!plan && plan.departSource === "jij" && !!fromPlace && isIncomplete(fromPlace);
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
        {unreliable && (
          <p className="mt-1" data-testid="leg-unknown-departure">
            We kunnen de aankomsttijd niet betrouwbaar berekenen omdat de vertrektijd van deze plek onbekend is.
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
            <div className="min-w-0 flex-1">
              <p>
                Deze dag rijd je {minutesText(plan.dayDriveMin)}, langer dan de {minutesText(maxDriveMin)} die je wilt.
              </p>
              {suggestions}
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

/** Bewerken van één notitie: tekst en de schakelaar "Delen met reisgenoten" (standaard uit) */
function NoteEditor({ note, onSave, onCancel, onRemove }: { note: TripNote; onSave: (n: TripNote) => void; onCancel: () => void; onRemove?: () => void }) {
  const [draft, setDraft] = useState(note.text);
  const [shared, setShared] = useState(!!note.shared);
  return (
    <div className="mt-2" data-testid="note-editor">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Notitie</span>
        <textarea
          autoFocus
          value={draft}
          maxLength={MAX_NOTE}
          rows={3}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-field bg-surface px-3 py-2 text-base focus:ring-2 focus:ring-forest focus:outline-none"
        />
      </label>
      <Chip pressed={shared} onClick={() => setShared(!shared)} className="mt-1">
        Delen met reisgenoten
      </Chip>
      <p className="mt-1 text-sm text-muted">
        {shared ? "Je reisgenoten zien deze notitie als je samen plant, en hij gaat mee als je de reis als tekst deelt." : "Alleen jij ziet deze notitie."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSave({ id: note.id, text: draft.trim(), ...(shared ? { shared: true as const } : {}) })}
          className="h-11 rounded-md bg-forest px-4 font-semibold text-on-forest"
        >
          Bewaren
        </button>
        <button type="button" onClick={onCancel} className="h-11 px-3 font-semibold text-forest underline">
          Annuleren
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} className="ml-auto h-11 px-3 font-semibold text-alert underline">
            Notitie weghalen
          </button>
        )}
      </div>
    </div>
  );
}

/** Notities bij een stop: standaard privé; per notitie "Delen met reisgenoten" */
function StopNotes({ notes, onSave, onRemove }: { notes: TripNote[]; onSave: (n: TripNote) => void; onRemove: (id: string) => void }) {
  // Welke notitie open staat; "nieuw" voor een nieuwe
  const [editing, setEditing] = useState<string | null>(null);
  const [fresh, setFresh] = useState<TripNote | null>(null);
  return (
    <div className="mt-1">
      {notes.length > 0 && (
        <ul className="mt-1 space-y-1">
          {notes.map((n) =>
            editing === n.id ? (
              <li key={n.id}>
                <NoteEditor
                  note={n}
                  onSave={(x) => {
                    onSave(x);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  onRemove={() => {
                    onRemove(n.id);
                    setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={n.id} className="flex items-start gap-2" data-testid="stop-note">
                <div className="min-w-0 flex-1 pt-2.5">
                  <p className="text-sm whitespace-pre-line text-ink-2" data-testid="stop-note-text">{n.text}</p>
                  <p className="flex items-center gap-1 text-sm text-muted" data-testid="stop-note-scope">
                    <Icon name={n.shared ? "user" : "eye"} size={14} />
                    {n.shared ? "Gedeeld met reisgenoten" : "Privé"}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(n.id)} className="h-11 shrink-0 px-2 text-sm font-semibold text-forest underline">
                  Aanpassen
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {fresh ? (
        <NoteEditor
          note={fresh}
          onSave={(x) => {
            if (x.text) onSave(x);
            setFresh(null);
          }}
          onCancel={() => setFresh(null)}
        />
      ) : (
        notes.filter((n) => !n.shared).length < MAX_NOTES && (
          <button type="button" onClick={() => setFresh({ id: newNoteId(), text: "" })} className="-my-1 min-h-11 text-sm font-semibold text-forest underline">
            Notitie toevoegen
          </button>
        )
      )}
    </div>
  );
}

/** Voorstellen om te overnachten waar de dag vol is: hoogstens 3, alleen uit onze data, toevoegen doe je zelf */
export function OvernightList({ hits, onAdd }: { hits: CorridorHit<PlaceSummary>[]; onAdd: (slug: string) => void }) {
  if (!hits.length)
    return (
      <p className="mt-1 text-sm text-ink-2" data-testid="overnight-none">
        Rond het punt waar je dag vol is, kennen we geen plek dicht bij de route.
      </p>
    );
  return (
    <div className="mt-2" data-testid="overnight">
      <p className="font-semibold">Overnachten rond waar je dag vol is</p>
      <ul className="mt-1 divide-y divide-line">
        {hits.map((h) => {
          const p = h.item;
          return (
            <li key={p.slug} className="flex items-center gap-2 py-2" data-testid="overnight-place">
              <div className="min-w-0 flex-1">
                <Link href={`/plek/${p.slug}`} className="-my-3 block truncate py-3 font-semibold hover:text-forest">
                  {p.name}
                </Link>
                {/* Vertrektijd is het kernfeit: op een eigen regel, nooit afgekapt */}
                <p className="text-sm text-ink-2">{departureShort(p) ?? "Vertrektijd onbekend"}</p>
                <p className="text-sm text-muted">
                  {p.town}, {formatKm(h.offKm)} van de route
                </p>
              </div>
              <button
                type="button"
                onClick={() => onAdd(p.slug)}
                aria-label={`${p.name} toevoegen als overnachting`}
                className="flex h-11 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-3 font-semibold hover:border-forest"
              >
                <Icon name="plus" size={18} /> Toevoegen
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface StopActions {
  setNights: (slug: string, n: number) => void;
  saveNote: (slug: string, note: TripNote) => void;
  removeNote: (slug: string, id: string) => void;
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
  const own = s.point;
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
          {own ? (
            // Eigen punt: geen foto, maar een gestippeld vak met een speld; zo is het meteen anders dan een plek
            <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-ink-2 text-ink-2">
              <Icon name="pin" size={24} />
              <span className="absolute top-1 left-1 grid h-6 w-6 place-items-center rounded-full border border-ink-2 bg-surface font-display text-sm font-semibold text-ink">
                {index + 1}
              </span>
            </div>
          ) : (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
              <PlacePhoto src={s.place.imageUrl} alt="" kind={s.place.kind} className="h-full w-full" />
              <span className="absolute top-1 left-1 grid h-6 w-6 place-items-center rounded-full bg-forest font-display text-sm font-semibold text-on-forest">
                {index + 1}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            {own ? (
              <p className="truncate py-0.5 font-display text-[1.0625rem] font-semibold sm:text-lg">{s.place.name}</p>
            ) : (
              <Link href={`/plek/${s.slug}`} className="-my-2 block truncate py-2.5 font-display text-[1.0625rem] font-semibold hover:text-forest sm:text-lg">
                {s.place.name}
              </Link>
            )}
            {/* Vertrektijd is het kernfeit, ook in Mijn reis (ontwerpronde 2, 26 november 2026) */}
            {!own && (
              <div className="mt-0.5 mb-1">
                <DepartureChip place={s.place} compact />
              </div>
            )}
            {dated ? (
              <p className="text-sm font-semibold text-ink-2" data-testid="stop-dates">
                {s.nights === 0 ? `Tussenstop op ${shortDay(dated.arrive)}` : `${shortDay(dated.arrive)} tot ${shortDay(dated.leave)}`}
              </p>
            ) : own ? null : (
              <OpenChip place={s.place} />
            )}
            {own ? (
              <p className="text-sm text-muted" data-testid="own-point">
                Eigen punt, geen plekgegevens
              </p>
            ) : (
              <p className="truncate text-sm text-muted">
                {s.place.town},{" "}
                {s.place.priceEur === undefined
                  ? "prijs onbekend"
                  : s.place.priceEur === 0
                    ? "gratis"
                    : `${s.place.priceFrom ? "vanaf " : ""}${eur(s.place.priceEur)} per nacht`}
              </p>
            )}
          </div>
        </div>
        {!own && dated && dated.closedNights.length > 0 && (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-alert-tint px-3 py-2 text-sm text-alert" data-testid="stop-closed">
            <Icon name="calendar" size={17} className="mt-0.5 shrink-0" />
            <span>
              Volgens het seizoen{s.place.season ? ` (${s.place.season.replace(" – ", " t/m ")})` : ""} is deze plek dicht op {closedText(dated.closedNights)}. Kies een
              andere datum of bel even voor je gaat.
            </span>
          </p>
        )}
        {/* flex-wrap: op 320 px passen nachten en de drie knoppen niet naast elkaar (QA 27 november 2026) */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
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
        <StopNotes notes={s.notes ?? []} onSave={(n) => actions.saveNote(s.slug, n)} onRemove={(id) => actions.removeNote(s.slug, id)} />
      </div>
    </Reorder.Item>
  );
}

export { Reorder };
