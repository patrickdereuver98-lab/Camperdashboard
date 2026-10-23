"use client";

import { useEffect, useRef, useState, ViewTransition } from "react";
import { formatDuration, formatMonth, pluralize, scoreLabel } from "@/lib/format";
import { coarse, formatKm, type LatLng } from "@/lib/geo";
import { NavigateButton } from "@/components/navigate";
import { errorMessage, formValue, supabase } from "@/lib/supabase-browser";
import { track } from "@/lib/track";
import { isPossiblyOutdated } from "@/lib/place-status";
import { useHydrated } from "@/lib/use-media";
import type { Photo, Review } from "@/lib/types";
import { Icon } from "@/components/icons";
import { PlacePhoto } from "@/components/place-ui";
import { KIND_SIGN, Sign } from "@/components/sign";
import { Sheet } from "@/components/sheet";
import { DepartureRadios, type DepartureAnswer } from "@/components/departure-radios";

// ── Fotogalerij met vegen ───────────────────────────────────────────────────

export function Gallery({ slug, name, photos, kind, town }: { slug: string; name: string; photos: Photo[]; kind?: string; town: string }) {
  const track_ = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Foto's die niet laden verdwijnen uit de carrousel (geen lege dia's met "1 / 4")
  const [failed, setFailed] = useState<string[]>([]);
  const visible = photos.filter((p) => !failed.includes(p.url));
  const go = (i: number) => {
    const el = track_.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  if (!visible.length)
    return (
      <ViewTransition name={`foto-${slug}`} share="photo-morph" default="none">
        <div
          // Waren er foto's maar laadde geen enkele, dan blijft het vak even groot: anders springt de pagina omhoog
          className={`flex items-center justify-center gap-2 bg-sunken text-sm text-muted sm:rounded-xl ${photos.length ? "aspect-[16/9] sm:aspect-[21/9]" : "h-20 sm:h-28"}`}
          role="img"
          aria-label={`Nog geen foto van ${name}`}
        >
          <Sign name={KIND_SIGN[kind ?? "camperplaats"] ?? "camper"} size={24} state="unknown" />
          {photos.length ? "De foto kon niet worden geladen" : "Nog geen foto van deze plek"}
        </div>
      </ViewTransition>
    );
  return (
    <div className="relative">
      <div
        ref={track_}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex aspect-[16/9] snap-x snap-mandatory overflow-x-auto bg-sunken sm:aspect-[21/9] sm:rounded-xl"
        aria-roledescription="carrousel"
        aria-label={`Foto's van ${name}`}
      >
        {visible.map((p, i) => {
          const photo = (
            <PlacePhoto
              src={p.url}
              alt={i === 0 ? `Foto van ${name}` : `Foto ${i + 1} van ${name}`}
              kind={kind}
              town={town}
              sizes="large"
              className="h-full w-full"
              onFail={() => setFailed((f) => [...f, p.url])}
            />
          );
          return (
            <figure key={p.url} className="relative h-full w-full shrink-0 snap-center" aria-label={`Foto ${i + 1} van ${visible.length}`}>
              {i === 0 ? (
                <ViewTransition name={`foto-${slug}`} share="photo-morph" default="none">
                  {photo}
                </ViewTransition>
              ) : (
                photo
              )}
              {p.credit && (
                <figcaption className="animate-fade-in-late absolute bottom-2 left-2 max-w-[60%] truncate rounded-md bg-black/50 px-1.5 py-0.5 text-xs text-white">
                  Foto: {p.credit}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
      {visible.length > 1 && (
        <>
          <span className="animate-fade-in-late absolute right-2 bottom-2 rounded-full bg-black/50 px-2.5 py-0.5 text-sm font-semibold text-white tabular-nums">
            {Math.min(index, visible.length - 1) + 1} / {visible.length}
          </span>
          <div className="absolute inset-y-0 left-2 hidden items-center sm:flex">
            <button type="button" onClick={() => go(Math.max(0, index - 1))} aria-label="Vorige foto" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-lift">
              <Icon name="chevronLeft" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-2 hidden items-center sm:flex">
            <button type="button" onClick={() => go(Math.min(visible.length - 1, index + 1))} aria-label="Volgende foto" className="grid h-11 w-11 place-items-center rounded-full bg-surface shadow-lift">
              <Icon name="chevronRight" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Route vanaf je locatie, met echte rijtijd ───────────────────────────────

type RouteState =
  | { s: "idle" }
  | { s: "locating" }
  | { s: "ok"; km: number; seconds: number; from: LatLng }
  | { s: "error"; msg: string };

export function RouteCard({ to, name }: { to: LatLng; name: string }) {
  const [state, setState] = useState<RouteState>({ s: "idle" });

  function calculate() {
    if (!("geolocation" in navigator)) {
      setState({ s: "error", msg: "Je browser kan je locatie niet bepalen." });
      return;
    }
    setState({ s: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const res = await fetch(`/api/route?p=${coarse(from)};${to.lat},${to.lng}`);
          if (!res.ok) throw new Error();
          const r = await res.json();
          setState({ s: "ok", km: r.distanceM / 1000, seconds: r.durationS, from });
          track("route", { naar: name });
        } catch {
          setState({ s: "error", msg: "De rijtijd kon niet worden berekend. Open de route in je navigatie-app." });
        }
      },
      (err) =>
        setState({
          s: "error",
          msg: err.code === err.PERMISSION_DENIED ? "Geen toegang tot je locatie. Sta het toe in je browser." : "Je locatie kon niet worden bepaald.",
        }),
      { timeout: 12000, maximumAge: 300000 },
    );
  }

  return (
    <div className="rounded-xl bg-surface p-4 shadow-low">
      {state.s === "ok" ? (
        <p>
          <span className="font-display text-2xl font-semibold">{formatDuration(state.seconds)}</span>
          <span className="ml-2 text-ink-2">rijden, {formatKm(state.km)} over de weg</span>
        </p>
      ) : (
        <p className="text-ink-2">Bereken de rijtijd vanaf waar je nu bent.</p>
      )}
      {state.s === "error" && <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-alert">{state.msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {state.s !== "ok" && (
          <button
            type="button"
            onClick={calculate}
            disabled={state.s === "locating"}
            className="flex h-11 items-center gap-2 rounded-lg bg-forest px-4 font-semibold text-on-forest disabled:opacity-60"
          >
            <Icon name="locate" size={18} />
            {state.s === "locating" ? "Bezig…" : "Rijtijd berekenen"}
          </button>
        )}
        <NavigateButton to={to} name={name} className="flex h-11 items-center gap-2 rounded-lg border border-line px-4 font-semibold hover:border-forest">
          <Icon name="route" size={18} /> Open in navigatie
        </NavigateButton>
      </div>
    </div>
  );
}

// ── Reviews ─────────────────────────────────────────────────────────────────

const SUBSCORES: { key: keyof Review; label: string }[] = [
  { key: "scoreLocation", label: "Ligging" },
  { key: "scoreQuiet", label: "Rust" },
  { key: "scoreFacilities", label: "Voorzieningen" },
  { key: "scoreValue", label: "Prijs/kwaliteit" },
];

export function ReviewSummary({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {SUBSCORES.map((s) => {
        const vals = reviews.map((r) => r[s.key] as number | undefined).filter((v): v is number => typeof v === "number");
        if (!vals.length) return null;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return (
          <div key={s.key}>
            <div className="flex justify-between">
              <dt>{s.label}</dt>
              <dd className="font-display font-semibold">{scoreLabel(avg)}</dd>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full bg-forest" style={{ width: `${avg * 10}%` }} />
            </div>
          </div>
        );
      })}
    </dl>
  );
}

export function ReviewList({ reviews }: { reviews: Review[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? reviews : reviews.slice(0, 3);
  return (
    <>
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-xl bg-surface p-5 shadow-low">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.authorName}</p>
                <p className="text-sm text-muted">
                  {r.visitedMonth ? `Geweest in ${formatMonth(r.visitedMonth)}` : formatMonth(r.createdAt)}
                  {r.vehicle ? `, met een ${r.vehicle}` : ""}
                </p>
              </div>
              <span className="grid h-9 min-w-9 place-items-center rounded-lg rounded-bl-none bg-forest px-1.5 font-display font-semibold text-on-forest">
                {r.rating}
              </span>
            </div>
            {r.title && <p className="mt-3 font-display text-lg font-semibold">{r.title}</p>}
            <p className="mt-1 whitespace-pre-line text-ink-2">{r.body}</p>
          </li>
        ))}
      </ul>
      {reviews.length > 3 && !all && (
        <button type="button" onClick={() => setAll(true)} className="mt-3 h-12 rounded-lg border border-line px-5 font-semibold hover:border-forest">
          Toon alle {pluralize(reviews.length, "review", "reviews")}
        </button>
      )}
    </>
  );
}

function ScorePicker({ label, value, onChange, required }: { label: string; value?: number; onChange: (n: number) => void; required?: boolean }) {
  return (
    <fieldset>
      <legend className="mb-2 font-semibold">
        {label}
        {required && <span className="text-alert"> *</span>}
      </legend>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className="h-11 rounded-lg border border-line font-display font-semibold aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-on-forest"
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const input = "h-12 w-full rounded-lg border border-line bg-surface px-3 focus:border-forest focus:outline-none";

export function WriteReview({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [departure, setDeparture] = useState<DepartureAnswer>("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (formValue(form, "website")) return; // honeypot
    if (!scores.rating) {
      setErr("Geef een totaalcijfer.");
      return;
    }
    setBusy(true);
    setErr(null);
    const month = String(formValue(form, "month") || "");
    const { error } = await supabase().rpc("submit_review", {
      p_place_id: placeId,
      p_author_name: String(formValue(form, "name")),
      p_author_email: String(formValue(form, "email") || ""),
      p_rating: scores.rating,
      p_score_location: scores.location ?? null,
      p_score_quiet: scores.quiet ?? null,
      p_score_facilities: scores.facilities ?? null,
      p_score_value: scores.value ?? null,
      p_title: String(formValue(form, "title") || ""),
      p_body: String(formValue(form, "body")),
      p_vehicle: String(formValue(form, "vehicle") || "") || null,
      p_visited_month: month ? `${month}-01` : null,
    });
    if (!error && departure) {
      // De vertrektijd gaat als inzending naar beheer, net als bij Doe mee. Een fout hier houdt de review niet tegen.
      await supabase().rpc("submit_place", {
        p_kind: "correctie",
        p_place_id: placeId,
        p_payload: {
          onderwerp: "vertrektijd",
          plek: placeName,
          vertrek: departure,
          vertrek_uiterlijk: departure === "vast" ? formValue(form, "checkout") : null,
          hoe_weet_je_het: "zelf gestaan (review)",
        },
        p_contact_name: String(formValue(form, "name") || ""),
        p_contact_email: String(formValue(form, "email") || ""),
      });
    }
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-12 items-center gap-2 rounded-lg bg-forest px-5 font-semibold text-on-forest">
        <Icon name="edit" size={19} /> Schrijf een review
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={done ? "Bedankt!" : `Review voor ${placeName}`}>
        {done ? (
          <div className="pb-4">
            <p className="text-lg">Je review is ontvangen. We controleren hem en plaatsen hem meestal binnen twee werkdagen.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-lg bg-forest font-semibold text-on-forest">
              Sluiten
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 pb-4">
            <ScorePicker label="Totaalcijfer" required value={scores.rating} onChange={(n) => setScores((s) => ({ ...s, rating: n }))} />
            <details className="rounded-lg bg-sunken p-4">
              <summary className="cursor-pointer font-semibold">Cijfers per onderdeel (optioneel)</summary>
              <div className="mt-4 space-y-4">
                <ScorePicker label="Ligging" value={scores.location} onChange={(n) => setScores((s) => ({ ...s, location: n }))} />
                <ScorePicker label="Rust" value={scores.quiet} onChange={(n) => setScores((s) => ({ ...s, quiet: n }))} />
                <ScorePicker label="Voorzieningen" value={scores.facilities} onChange={(n) => setScores((s) => ({ ...s, facilities: n }))} />
                <ScorePicker label="Prijs/kwaliteit" value={scores.value} onChange={(n) => setScores((s) => ({ ...s, value: n }))} />
              </div>
            </details>
            <label className="block">
              <span className="mb-1.5 block font-semibold">Titel (optioneel)</span>
              <input name="title" maxLength={120} className={input} />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-semibold">
                Je ervaring <span className="text-alert">*</span>
              </span>
              <textarea name="body" required minLength={20} maxLength={3000} rows={5} className={`${input} h-auto py-2`} placeholder="Wat moeten andere camperaars weten?" />
            </label>
            <DepartureRadios
              id="review-vertrek"
              label="Hoe laat moest je weg? (optioneel)"
              value={departure}
              onChange={setDeparture}
              fieldClass={input}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-semibold">Wanneer was je er?</span>
                <input name="month" type="month" className={input} />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">Voertuig</span>
                <select name="vehicle" className={input} defaultValue="">
                  <option value="">Zeg ik liever niet</option>
                  <option value="camper">Camper</option>
                  <option value="buscamper">Buscamper</option>
                  <option value="caravan">Caravan</option>
                  <option value="overig">Anders</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block font-semibold">
                Je naam <span className="text-alert">*</span>
              </span>
              <input name="name" required minLength={2} maxLength={60} autoComplete="given-name" className={input} />
              <span className="mt-1 block text-sm text-muted">Wordt bij je review getoond.</span>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-semibold">E-mail (optioneel)</span>
              <input name="email" type="email" autoComplete="email" className={input} />
              <span className="mt-1 block text-sm text-muted">Alleen voor vragen over je review. Niet zichtbaar.</span>
            </label>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
              {busy ? "Versturen…" : "Review versturen"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}

// ── Fout melden ─────────────────────────────────────────────────────────────

export function ReportProblem({
  placeId,
  placeName,
  topic = "prijs",
  label = "Klopt er iets niet? Meld het",
}: {
  placeId: string;
  placeName: string;
  topic?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (formValue(f, "website")) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase().rpc("submit_place", {
      p_kind: formValue(f, "owner") ? "eigenaar" : "correctie",
      p_place_id: placeId,
      p_payload: { onderwerp: formValue(f, "topic"), toelichting: formValue(f, "details"), plek: placeName },
      p_contact_name: String(formValue(f, "name") || ""),
      p_contact_email: String(formValue(f, "email") || ""),
    });
    setBusy(false);
    if (error) setErr(errorMessage(error));
    else setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-11 items-center gap-2 font-semibold text-forest underline">
        <Icon name="alert" size={18} /> {label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={done ? "Bedankt voor je melding" : "Gegevens aanpassen"}>
        {done ? (
          <div className="pb-4">
            <p className="text-lg">We controleren je melding en passen de gegevens zo nodig aan.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-6 h-12 w-full rounded-lg bg-forest font-semibold text-on-forest">
              Sluiten
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 pb-4">
            <label className="block">
              <span className="mb-1.5 block font-semibold">Wat klopt er niet?</span>
              <select name="topic" className={input} defaultValue={topic}>
                <option value="vertrektijd">Aankomst- en vertrektijden</option>
                <option value="prijs">Prijs of extra kosten</option>
                <option value="voorzieningen">Voorzieningen</option>
                <option value="seizoen">Openingsperiode</option>
                <option value="contact">Contactgegevens</option>
                <option value="locatie">Locatie op de kaart</option>
                <option value="gesloten">De plek bestaat niet meer</option>
                <option value="anders">Iets anders</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-semibold">Toelichting</span>
              <textarea name="details" required minLength={5} rows={4} className={`${input} h-auto py-2`} />
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" name="owner" className="h-5 w-5 accent-[var(--forest)]" /> Ik ben de eigenaar of beheerder
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block font-semibold">Naam (optioneel)</span>
                <input name="name" className={input} autoComplete="name" />
              </label>
              <label className="block">
                <span className="mb-1.5 block font-semibold">E-mail (optioneel)</span>
                <input name="email" type="email" className={input} autoComplete="email" />
              </label>
            </div>
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
            <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-forest hover:bg-forest-deep font-display text-lg font-semibold text-on-forest disabled:opacity-60">
              {busy ? "Versturen…" : "Melding versturen"}
            </button>
          </form>
        )}
      </Sheet>
    </>
  );
}

export function TrackView({ slug }: { slug: string }) {
  useEffect(() => track("place_view", { slug }), [slug]);
  return null;
}

export function ShareButton({ title, className = "" }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = location.href;
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
          } catch {
            /* geannuleerd */
          }
        } else {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
      className={`flex h-12 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 font-semibold hover:border-forest ${className}`}
    >
      <Icon name={copied ? "check" : "share"} size={19} />
      {copied ? "Link gekopieerd" : "Delen"}
    </button>
  );
}

/**
 * ", mogelijk verouderd" achter "Laatste update" als de laatste controle meer dan 12 maanden geleden is (PRD,
 * "Databronnen"). Pas na hydratatie: de pagina staat in de cache en "nu" is de datum van de bezoeker.
 */
export function OutdatedNote({ verifiedAt, departureCheckedAt }: { verifiedAt?: string; departureCheckedAt?: string }) {
  const hydrated = useHydrated();
  if (!hydrated || !isPossiblyOutdated({ verifiedAt, departureCheckedAt })) return null;
  return <span className="font-semibold text-ink-2">, mogelijk verouderd</span>;
}
