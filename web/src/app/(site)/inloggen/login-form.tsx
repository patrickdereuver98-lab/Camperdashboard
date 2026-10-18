"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  authErrorMessage,
  cleanCode,
  codeErrorMessage,
  PROVIDERS,
  signInWithEmail,
  signInWithProvider,
  safeNext,
  useSession,
  verifyEmailCode,
  type OAuthProvider,
} from "@/lib/auth";
import { Icon } from "@/components/icons";
import { field } from "../contact/contact-form";

const PROVIDER_ICON: Record<OAuthProvider, React.ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
      <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.1-4.2ZM14 5.1c.7-.8 1.1-2 1-3.1a4.3 4.3 0 0 0-2.8 1.5c-.6.7-1.2 1.9-1 3 1.1.1 2.1-.6 2.8-1.4Z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />
    </svg>
  ),
};

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const { session } = useSession();
  const [busy, setBusy] = useState<OAuthProvider | "email" | "code" | null>(null);
  const [err, setErr] = useState<string | null>(params.get("fout") ? authErrorMessage(params.get("fout")!) : null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // Al ingelogd: meteen door
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  async function provider(p: OAuthProvider) {
    setBusy(p);
    setErr(null);
    try {
      await signInWithProvider(p, next);
    } catch (e) {
      setErr(authErrorMessage((e as Error).message));
      setBusy(null);
    }
  }

  async function email(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = String(new FormData(e.currentTarget).get("email")).trim();
    setBusy("email");
    setErr(null);
    try {
      await signInWithEmail(address, next);
      setSentTo(address);
    } catch (e) {
      setErr(authErrorMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sentTo || code.length < 6) return;
    setBusy("code");
    setErr(null);
    try {
      await verifyEmailCode(sentTo, code);
      router.replace(next);
    } catch (e) {
      setErr(codeErrorMessage((e as Error).message));
      setBusy(null);
    }
  }

  async function resend() {
    if (!sentTo) return;
    setBusy("email");
    setErr(null);
    try {
      await signInWithEmail(sentTo, next);
      setCode("");
    } catch (e) {
      setErr(authErrorMessage((e as Error).message));
    } finally {
      setBusy(null);
    }
  }

  if (sentTo)
    return (
      <div className="mt-8">
        <div role="status" className="rounded-2xl bg-forest-tint p-6">
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-forest">
            <Icon name="mail" size={24} /> Check je mail
          </p>
          <p className="mt-2 text-ink-2">
            We hebben een inlogcode gestuurd naar <strong>{sentTo}</strong>. Vul de code hieronder in. Je kunt ook op de
            link in de mail tikken. Geen mail? Kijk ook in je spammap.
          </p>
        </div>

        <form onSubmit={verify} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1.5 block font-semibold">Code uit de mail</span>
            <input
              name="code"
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6,10}"
              maxLength={10}
              className={`${field} text-center font-mono text-2xl tracking-[0.3em]`}
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null || code.length < 6}
            className="h-14 w-full rounded-xl bg-forest font-display text-lg font-semibold text-on-forest disabled:opacity-60"
          >
            {busy === "code" ? "Controleren…" : "Inloggen"}
          </button>
        </form>

        {err && <p role="alert" className="mt-4 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <button onClick={resend} disabled={busy !== null} className="min-h-11 font-semibold text-forest underline disabled:opacity-60">
            {busy === "email" ? "Versturen…" : "Nieuwe code sturen"}
          </button>
          <button
            onClick={() => {
              setSentTo(null);
              setCode("");
              setErr(null);
            }}
            className="min-h-11 font-semibold text-forest underline"
          >
            Ander e-mailadres gebruiken
          </button>
        </div>
      </div>
    );

  return (
    <div className="mt-8">
      <div className="grid gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => provider(p.id)}
            disabled={busy !== null}
            className="flex h-14 items-center justify-center gap-3 rounded-xl border-2 border-line bg-surface font-semibold transition-colors hover:border-forest disabled:opacity-60"
          >
            {PROVIDER_ICON[p.id]}
            {busy === p.id ? "Doorsturen…" : `Doorgaan met ${p.label}`}
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" /> of met je e-mailadres <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={email} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block font-semibold">E-mailadres</span>
          <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} />
        </label>
        <button type="submit" disabled={busy !== null} className="h-14 w-full rounded-xl bg-forest font-display text-lg font-semibold text-on-forest disabled:opacity-60">
          {busy === "email" ? "Versturen…" : "Stuur mij een inlogcode"}
        </button>
      </form>

      {err && <p role="alert" className="mt-4 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}

      <p className="mt-6 text-sm text-muted">
        Door in te loggen ga je akkoord met de <Link href="/voorwaarden" className="underline">voorwaarden</Link> en de{" "}
        <Link href="/privacy" className="underline">privacyverklaring</Link>. We krijgen alleen je naam, e-mailadres en
        profielfoto; we plaatsen nooit iets namens je.
      </p>
    </div>
  );
}
