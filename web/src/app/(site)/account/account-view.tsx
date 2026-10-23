"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@/lib/auth";
import { useTrip } from "@/lib/store";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { Icon } from "@/components/icons";

const PROVIDER_LABEL: Record<string, string> = { google: "Google", apple: "Apple", facebook: "Facebook", email: "e-mail" };

export function AccountView() {
  const { session, loading } = useSession();
  const { stops } = useTrip();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (loading) return <p role="status" className="text-muted">Laden…</p>;
  if (!session)
    return (
      <>
        <h1 className="font-display text-3xl font-semibold">Mijn account</h1>
        <p className="mt-3 text-lg text-ink-2">Log in om je reis op al je apparaten te bewaren.</p>
        <Link href="/inloggen?next=/account" className="mt-6 inline-flex h-12 items-center rounded-xl bg-forest px-5 font-semibold text-on-forest">
          Inloggen
        </Link>
      </>
    );

  const user = session.user;
  const meta = user.user_metadata as { avatar_url?: string; picture?: string; full_name?: string; name?: string };
  const name = meta.full_name ?? meta.name ?? user.email?.split("@")[0];
  const avatar = meta.avatar_url ?? meta.picture;
  const via = PROVIDER_LABEL[String(user.app_metadata.provider)] ?? String(user.app_metadata.provider ?? "e-mail");

  const typedOk = typed.trim().toUpperCase() === "VERWIJDEREN";

  async function remove() {
    if (!typedOk) return;
    setErr(null);
    setDeleting(true);
    const sb = supabase();
    // Eerst je papieren uit de privé-map: die verdwijnen niet vanzelf met het account
    const { data: docs } = await sb.storage.from("vehicle-docs").list(user.id);
    const files = (docs ?? []).filter((d) => d.id).map((d) => `${user.id}/${d.name}`);
    if (files.length) await sb.storage.from("vehicle-docs").remove(files);
    const { error } = await sb.rpc("delete_my_account", { p_confirm: typed });
    setDeleting(false);
    if (error) {
      // Functie (nog) niet beschikbaar: verzoek via support, dan verwijderen we het handmatig
      if (/delete_my_account|function|schema cache/i.test(error.message)) {
        router.push("/contact?onderwerp=privacy");
        return;
      }
      return setErr(errorMessage(error));
    }
    for (const key of ["vrijstaan:reis", "vrijstaan:samen", "vrijstaan:uitgaven", "vrijstaan:camper"]) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* opslag geblokkeerd */
      }
    }
    await signOut();
    router.replace("/");
  }

  return (
    <>
      <div className="flex items-center gap-4">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-forest-tint text-forest">
            <Icon name="user" size={30} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-semibold">{name}</h1>
          <p className="truncate text-ink-2">{user.email}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">Ingelogd via {via}.</p>

      <Link href="/mijn-reis" className="mt-6 flex items-center justify-between rounded-2xl bg-surface p-4 outline-1 outline-line outline">
        <span className="flex items-center gap-3 font-semibold">
          <Icon name="heart" size={22} /> Mijn reis
        </span>
        <span className="text-ink-2">
          {stops.length} {stops.length === 1 ? "plek" : "plekken"}, bewaard in je account
        </span>
      </Link>

      <Link href="/mijn-camper" className="mt-3 flex items-center justify-between rounded-2xl bg-surface p-4 outline-1 outline-line outline">
        <span className="flex items-center gap-3 font-semibold">
          <Icon name="settings" size={22} /> Mijn camper
        </span>
        <span className="text-ink-2">Maten en papieren</span>
      </Link>

      <button
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-line font-semibold hover:border-forest"
      >
        <Icon name="logout" size={20} /> Uitloggen
      </button>

      <div className="mt-10 border-t border-line pt-6">
        {!confirm ? (
          <button onClick={() => setConfirm(true)} className="font-semibold text-alert underline">
            Account verwijderen
          </button>
        ) : (
          <div className="rounded-2xl bg-alert-tint p-4">
            <p className="font-semibold text-alert">Weet je het zeker?</p>
            <p className="mt-1 text-ink-2">
              Je account wordt direct en definitief verwijderd, met je reis, je camper, je uitgaven en je papieren. Dit kun je
              niet ongedaan maken. Je reviews blijven staan, zonder koppeling aan je account.
            </p>
            <label className="mt-3 block">
              <span className="mb-1 block font-semibold">Typ VERWIJDEREN om te bevestigen</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="h-12 w-full rounded-xl border-2 border-line bg-surface px-3 font-semibold tracking-wide focus:border-alert focus:outline-none"
              />
            </label>
            <div className="mt-3 flex gap-3">
              <button onClick={remove} disabled={!typedOk || deleting} className="h-11 rounded-xl bg-alert px-4 font-semibold text-surface disabled:opacity-40">
                {deleting ? "Verwijderen…" : "Account definitief verwijderen"}
              </button>
              <button
                onClick={() => {
                  setConfirm(false);
                  setTyped("");
                }}
                className="h-11 rounded-xl px-4 font-semibold"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
        {err && <p role="alert" className="mt-3 text-alert">{err}</p>}
      </div>
    </>
  );
}
