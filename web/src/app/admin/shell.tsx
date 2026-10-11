"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "@/components/icons";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { ErrorNote, input, primary } from "./ui";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overzicht", icon: "chart" },
  { href: "/admin/plekken", label: "Plekken", icon: "pin" },
  { href: "/admin/support", label: "Support", icon: "inbox" },
  { href: "/admin/inzendingen", label: "Inzendingen", icon: "plus" },
  { href: "/admin/reviews", label: "Reviews", icon: "star" },
  { href: "/admin/faq", label: "FAQ", icon: "help" },
  { href: "/admin/logs", label: "Logs", icon: "log" },
  { href: "/admin/instellingen", label: "Instellingen", icon: "settings" },
];

type State = "laden" | "uit" | "geen-admin" | "admin" | "herstel";

export function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("laden");
  const [session, setSession] = useState<Session | null>(null);
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sb = supabase();
    async function check(s: Session | null) {
      setSession(s);
      if (!s) return setState("uit");
      const { data } = await sb.rpc("is_admin");
      setState(data ? "admin" : "geen-admin");
    }
    void sb.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") return setState("herstel");
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") void check(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (state === "laden") return <p className="px-4 pt-16 text-center text-muted">Beheeromgeving laden…</p>;
  if (state === "uit") return <Login />;
  if (state === "herstel") return <NewPassword onDone={() => setState("admin")} />;
  if (state === "geen-admin")
    return (
      <Gate>
        <h1 className="font-sign text-2xl font-bold">Geen beheertoegang</h1>
        <p className="mt-2 text-ink-2">
          Je bent ingelogd als {session?.user.email}, maar dit account heeft geen beheerrechten.
        </p>
        <button className={`${primary} mt-6 w-full`} onClick={() => supabase().auth.signOut()}>
          Uitloggen
        </button>
      </Gate>
    );

  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));
  const nav = (
    <ul className="space-y-1">
      {NAV.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            onClick={() => setMenu(false)}
            aria-current={isActive(n.href) ? "page" : undefined}
            className="flex h-11 items-center gap-3 rounded-xl px-3 font-semibold text-ink-2 hover:bg-sunken aria-[current=page]:bg-road-tint aria-[current=page]:text-road"
          >
            <Icon name={n.icon} size={20} /> {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
        <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu" className="-ml-2 grid h-11 w-11 place-items-center rounded-xl hover:bg-sunken">
          <Icon name={menu ? "x" : "menu"} size={22} />
        </button>
        <Logo size={28} />
        <span className="font-sign font-extrabold text-road">Beheer</span>
        <Link href="/" className="ml-auto text-sm font-semibold text-road">Naar de site</Link>
      </header>
      {menu && <nav className="border-b border-line bg-surface p-3 lg:hidden" aria-label="Beheermenu">{nav}</nav>}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo size={30} />
          <span className="font-sign text-lg font-extrabold text-road">Beheer</span>
        </Link>
        <nav aria-label="Beheermenu">{nav}</nav>
        <div className="mt-auto space-y-2 border-t border-line pt-4 text-sm">
          <p className="truncate px-2 text-muted">{session?.user.email}</p>
          <Link href="/" className="flex h-10 items-center gap-2 rounded-xl px-2 font-semibold hover:bg-sunken">
            <Icon name="external" size={18} /> Naar de site
          </Link>
          <button onClick={() => supabase().auth.signOut()} className="flex h-10 w-full items-center gap-2 rounded-xl px-2 font-semibold hover:bg-sunken">
            <Icon name="logout" size={18} /> Uitloggen
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-sm px-4 pt-14 pb-16">
      <div className="mb-6 flex items-center gap-2.5">
        <Logo />
        <span className="font-sign text-xl font-extrabold text-road">VrijStaan beheer</span>
      </div>
      {children}
    </main>
  );
}

function Login() {
  const [mode, setMode] = useState<"inloggen" | "registreren" | "vergeten">("inloggen");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password") ?? "");
    const redirect = `${location.origin}/admin`;
    setBusy(true);
    setErr(null);
    setNote(null);
    const sb = supabase().auth;
    const res =
      mode === "inloggen"
        ? await sb.signInWithPassword({ email, password })
        : mode === "registreren"
          ? await sb.signUp({ email, password, options: { emailRedirectTo: redirect } })
          : await sb.resetPasswordForEmail(email, { redirectTo: redirect });
    setBusy(false);
    if (res.error) return setErr(res.error.message === "Invalid login credentials" ? "E-mailadres of wachtwoord klopt niet." : errorMessage(res.error));
    if (mode === "registreren") setNote("Account aangemaakt. Bevestig je e-mailadres via de link in je mail en log daarna in.");
    if (mode === "vergeten") setNote("Als dit adres bij ons bekend is, ontvang je een link om een nieuw wachtwoord in te stellen.");
  }

  return (
    <Gate>
      <h1 className="font-sign text-2xl font-bold">
        {mode === "inloggen" ? "Inloggen" : mode === "registreren" ? "Beheeraccount aanmaken" : "Wachtwoord vergeten"}
      </h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block font-semibold">E-mailadres</span>
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
        {mode !== "vergeten" && (
          <label className="block">
            <span className="mb-1.5 block font-semibold">Wachtwoord</span>
            <input
              name="password"
              type="password"
              required
              minLength={mode === "registreren" ? 10 : 1}
              autoComplete={mode === "registreren" ? "new-password" : "current-password"}
              className={input}
            />
            {mode === "registreren" && <span className="mt-1 block text-sm text-muted">Minimaal 10 tekens.</span>}
          </label>
        )}
        <ErrorNote message={err} />
        {note && <p role="status" className="rounded-xl bg-polder-tint px-4 py-3 font-semibold text-polder">{note}</p>}
        <button disabled={busy} className={`${primary} h-12 w-full`}>
          {busy ? "Bezig…" : mode === "inloggen" ? "Inloggen" : mode === "registreren" ? "Account aanmaken" : "Stuur herstellink"}
        </button>
      </form>
      <div className="mt-6 flex flex-col items-start gap-2 text-sm font-semibold text-road">
        {mode !== "inloggen" && <button onClick={() => setMode("inloggen")}>Terug naar inloggen</button>}
        {mode === "inloggen" && <button onClick={() => setMode("vergeten")}>Wachtwoord vergeten?</button>}
        {mode === "inloggen" && <button onClick={() => setMode("registreren")}>Nog geen account? Aanmaken met je uitgenodigde e-mailadres</button>}
      </div>
    </Gate>
  );
}

function NewPassword({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.updateUser({ password: String(new FormData(e.currentTarget).get("password")) });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    onDone();
  }
  return (
    <Gate>
      <h1 className="font-sign text-2xl font-bold">Nieuw wachtwoord</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block font-semibold">Nieuw wachtwoord</span>
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className={input} />
        </label>
        <ErrorNote message={err} />
        <button disabled={busy} className={`${primary} h-12 w-full`}>Opslaan</button>
      </form>
    </Gate>
  );
}
