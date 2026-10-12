"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import { photoDimensions, preparePhoto } from "@/lib/image-resize";
import { photoProblem } from "@/lib/image-size";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { Icon } from "@/components/icons";
import { field } from "../../contact/contact-form";

type Step = { kind: "idle" } | { kind: "form"; file: File; preview: string } | { kind: "busy" } | { kind: "done"; approved: boolean };

/** Bezoekers voegen zelf foto's toe; ze verschijnen na controle */
export function PhotoUpload({ placeId, slug, placeName }: { placeId: string; slug: string; placeName: string }) {
  const { session, loading } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [err, setErr] = useState<string | null>(null);

  const button =
    "inline-flex h-11 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold transition-colors hover:border-forest";

  if (loading) return null;
  if (!session)
    return (
      <Link href={`/inloggen?next=${encodeURIComponent(`/plek/${slug}#foto-toevoegen`)}`} className={button} data-testid="photo-login">
        <Icon name="plus" size={18} /> Foto toevoegen
      </Link>
    );

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    let problem = photoProblem(file);
    if (!problem) {
      try {
        const { width, height } = await photoDimensions(file);
        problem = photoProblem(file, width, height);
      } catch {
        problem = "Deze foto kunnen we niet openen. Probeer een JPG of PNG.";
      }
    }
    if (problem) return setErr(problem);
    setStep({ kind: "form", file, preview: URL.createObjectURL(file) });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step.kind !== "form" || !session) return;
    const form = new FormData(e.currentTarget);
    const file = step.file;
    URL.revokeObjectURL(step.preview);
    setStep({ kind: "busy" });
    setErr(null);
    try {
      const photo = await preparePhoto(file);
      const path = `${session.user.id}/${crypto.randomUUID()}.${photo.ext}`;
      const sb = supabase();
      const up = await sb.storage.from("place-photos").upload(path, photo.blob, {
        contentType: photo.ext === "webp" ? "image/webp" : "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (up.error) throw up.error;
      const { data, error } = await sb
        .from("place_photos")
        .insert({
          place_id: placeId,
          user_id: session.user.id,
          storage_path: path,
          width: photo.width,
          height: photo.height,
          caption: String(form.get("caption") || "").trim() || null,
          credit: String(form.get("credit") || "").trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Vertrouwde inzenders worden direct ná het opslaan goedgekeurd: status opnieuw lezen
      const { data: row } = await sb.from("place_photos").select("status").eq("id", data.id).maybeSingle();
      setStep({ kind: "done", approved: row?.status === "approved" });
    } catch (e) {
      setErr(errorMessage(e));
      setStep({ kind: "idle" });
    }
  }

  const name = (session.user.user_metadata as { full_name?: string; name?: string }).full_name ?? (session.user.user_metadata as { name?: string }).name ?? "";

  return (
    <div id="foto-toevoegen">
      {step.kind === "idle" && (
        <>
          <button type="button" className={button} onClick={() => input.current?.click()}>
            <Icon name="plus" size={18} /> Foto toevoegen
          </button>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            aria-label={`Foto kiezen van ${placeName}`}
            data-testid="photo-input"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </>
      )}

      {step.kind === "form" && (
        <form onSubmit={submit} className="mt-2 space-y-3 rounded-2xl bg-surface p-4 outline-1 outline-line outline">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.preview} alt="Gekozen foto" className="max-h-60 w-full rounded-xl object-cover" />
          <label className="block">
            <span className="mb-1.5 block font-semibold">Wat zie je op de foto? (optioneel)</span>
            <input name="caption" maxLength={140} className={field} placeholder="Bijvoorbeeld: uitzicht vanaf plek 4" />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-semibold">Naam bij de foto</span>
            <input name="credit" maxLength={80} defaultValue={name} className={field} />
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" required className="mt-1 h-5 w-5 accent-forest" name="license" />
            <span className="text-sm text-ink-2">
              Ik heb deze foto zelf gemaakt, er staan geen herkenbare mensen of kentekens op, en ik geef VrijStaan toestemming
              hem te tonen (zie de <Link href="/voorwaarden" className="underline">voorwaarden</Link>).
            </span>
          </label>
          <div className="flex gap-3">
            <button type="submit" className="h-12 flex-1 rounded-xl bg-forest font-semibold text-on-forest">Foto versturen</button>
            <button type="button" className="h-12 rounded-xl px-4 font-semibold" onClick={() => setStep({ kind: "idle" })}>
              Annuleren
            </button>
          </div>
        </form>
      )}

      {step.kind === "busy" && (
        <p role="status" className="mt-2 text-ink-2">Foto verkleinen en versturen…</p>
      )}

      {step.kind === "done" && (
        <p role="status" className="mt-2 flex items-center gap-2 rounded-xl bg-forest-tint px-3 py-2 font-semibold text-forest">
          <Icon name="check" size={20} />
          {step.approved ? "Bedankt! Je foto staat binnen een paar minuten online." : "Bedankt! We bekijken je foto en zetten hem daarna online."}
        </p>
      )}

      {err && <p role="alert" className="mt-2 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
    </div>
  );
}
