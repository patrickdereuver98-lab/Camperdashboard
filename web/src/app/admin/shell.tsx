"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, Logo, type IconName } from "@/components/icons";
import { adminMfaStep, qrDataUrl, totpCode } from "@/lib/admin-mfa";
import { errorMessage } from "@/lib/supabase-browser";
import { supabaseClient as supabase } from "@/lib/supabase-client";
import { ErrorNote, input, primary } from "./ui";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overzicht", icon: "chart" },
  { href: "/admin/mission-control", label: "Mission Control", icon: "shield" },
  { href: "/admin/marketing", label: "Marketing", icon: "share" },
  { href: "/admin/statistieken", label: "Statistieken", icon: "eye" },
  { href: "/admin/plekken", label: "Plekken", icon: "pin" },
  { href: "/admin/vertrektijden", label: "Vertrektijden", icon: "clock" },
  { href: "/admin/dubbelen", label: "Dubbelen", icon: "map" },
  { href: "/admin/support", label: "Support", icon: "inbox" },
  { href: "/admin/inzendingen", label: "Inzendingen", icon: "plus" },
  { href: "/admin/reviews", label: "Reviews", icon: "star" },
  { href: "/admin/fotos", label: "Foto's", icon: "eye" },
  { href: "/admin/faq", label: "FAQ", icon: "help" },
  { href: "/admin/logs", label: "Logs", icon: "log" },
  { href: "/admin/instellingen", label: "Instellingen", icon: "settings" },
];

type State = "laden" | "uit" | "mfa-code" | "mfa-instellen" | "geen-admin" | "admin" | "herstel" | "fout";

export function AdminShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("laden");
  const [session, setSession] = useState<Session | null>(null);
  const [menu, setMenu] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pathname = usePathname();
  // Herstellink geopend: eerst (zo nodig) de code, dan het nieuwe wachtwoord. Een herstelsessie is aal1, en Supabase
  // weigert een wachtwoordwijziging zonder aal2 als het account een factor heeft. Een ref, zodat een check() die al
  // liep (SIGNED_IN komt vóór PASSWORD_RECOVERY) het herstel niet overschrijft.
  const recovering = useRef(false);

  useEffect(() => {
    const sb = supabase();
    async function check(s: Session | null) {
      setSession(s);
      if (!s) return setState("uit");
      // Een netwerk- of serverfout is iets anders dan "geen beheerder": dan tonen we een foutmelding met opnieuw proberen
      // (R32). Ook een verzoek dat helemaal mislukt (geen antwoord) is een fout, geen "geen beheertoegang".
      try {
        // Eerst de tweede stap: de database geeft beheerrechten alleen aan een aal2-sessie (audit 24 november, H2)
        const levels = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
        if (levels.error) return setState("fout");
        const step = adminMfaStep(levels.data);
        if (recovering.current) return setState(step === "code" ? "mfa-code" : "herstel");
        if (step === "code") return setState("mfa-code");
        if (step === "instellen") return setState("mfa-instellen");
        const { data, error } = await sb.rpc("is_admin");
        setState(error ? "fout" : data === true ? "admin" : "geen-admin");
      } catch {
        setState("fout");
      }
    }
    void sb.auth.getSession().then(
      ({ data }) => check(data.session),
      () => setState("fout"),
    );
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        recovering.current = true;
        return void check(s);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "MFA_CHALLENGE_VERIFIED") void check(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [attempt]);

  if (state === "laden") return <p className="px-4 pt-16 text-center text-muted">Beheeromgeving laden…</p>;
  if (state === "fout")
    return (
      <Gate>
        <h1 className="font-display text-2xl font-semibold">Beheer is nu niet bereikbaar</h1>
        <p className="mt-2 text-ink-2">
          We konden niet controleren of je beheerrechten hebt. Controleer je internetverbinding en probeer het opnieuw.
        </p>
        <button
          type="button"
          className={`${primary} mt-6 w-full`}
          onClick={() => {
            setState("laden");
            setAttempt((a) => a + 1);
          }}
        >
          Opnieuw proberen
        </button>
      </Gate>
    );
  if (state === "uit") return <Login />;
  // Na een nieuw wachtwoord opnieuw controleren: een herstellink geeft een aal1-sessie, dus eerst de tweede stap
  const recheck = () => {
    setState("laden");
    setAttempt((a) => a + 1);
  };
  if (state === "herstel")
    return (
      <NewPassword
        onDone={() => {
          recovering.current = false;
          recheck();
        }}
      />
    );
  if (state === "mfa-code")
    return <MfaCode email={session?.user.email} onDone={() => (recovering.current ? setState("herstel") : recheck())} />;
  if (state === "mfa-instellen") return <MfaEnroll email={session?.user.email} onDone={recheck} />;
  if (state === "geen-admin")
    return (
      <Gate>
        <h1 className="font-display text-2xl font-semibold">Geen beheertoegang</h1>
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
            className="flex h-11 items-center gap-3 rounded-lg px-3 font-semibold text-ink-2 hover:bg-sunken aria-[current=page]:bg-forest-tint aria-[current=page]:text-forest"
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
        <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu" className="-ml-2 grid h-11 w-11 place-items-center rounded-lg hover:bg-sunken">
          <Icon name={menu ? "x" : "menu"} size={22} />
        </button>
        <Logo size={28} />
        <span className="font-display font-semibold text-forest">Beheer</span>
        <Link href="/" className="ml-auto text-sm font-semibold text-forest">Naar de site</Link>
      </header>
      {menu && <nav className="border-b border-line bg-surface p-3 lg:hidden" aria-label="Beheermenu">{nav}</nav>}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo size={30} />
          <span className="font-display text-lg font-semibold text-forest">Beheer</span>
        </Link>
        <nav aria-label="Beheermenu">{nav}</nav>
        <div className="mt-auto space-y-2 border-t border-line pt-4 text-sm">
          <p className="truncate px-2 text-muted">{session?.user.email}</p>
          <Link href="/" className="flex h-10 items-center gap-2 rounded-lg px-2 font-semibold hover:bg-sunken">
            <Icon name="external" size={18} /> Naar de site
          </Link>
          <button onClick={() => supabase().auth.signOut()} className="flex h-10 w-full items-center gap-2 rounded-lg px-2 font-semibold hover:bg-sunken">
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
        <span className="font-display text-xl font-semibold text-forest">VrijStaan beheer</span>
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
      <h1 className="font-display text-2xl font-semibold">
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
              minLength={mode === "registreren" ? 12 : 1}
              autoComplete={mode === "registreren" ? "new-password" : "current-password"}
              className={input}
            />
            {mode === "registreren" && <span className="mt-1 block text-sm text-muted">Minimaal 12 tekens.</span>}
          </label>
        )}
        <ErrorNote message={err} />
        {note && <p role="status" className="rounded-lg bg-forest-tint px-4 py-3 font-semibold text-forest">{note}</p>}
        <button disabled={busy} className={`${primary} h-12 w-full`}>
          {busy ? "Bezig…" : mode === "inloggen" ? "Inloggen" : mode === "registreren" ? "Account aanmaken" : "Stuur herstellink"}
        </button>
      </form>
      <div className="mt-6 flex flex-col items-start font-semibold text-forest [&>button]:min-h-11 [&>button]:text-left">
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
    const auth = supabase().auth;
    const { error } = await auth.updateUser({ password: String(new FormData(e.currentTarget).get("password")) });
    if (error) {
      setBusy(false);
      return setErr(errorMessage(error));
    }
    // Na een nieuw wachtwoord zijn sessies op andere apparaten niet meer te vertrouwen: die loggen we uit
    await auth.signOut({ scope: "others" });
    setBusy(false);
    onDone();
  }
  return (
    <Gate>
      <h1 className="font-display text-2xl font-semibold">Nieuw wachtwoord</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1.5 block font-semibold">Nieuw wachtwoord</span>
          <input name="password" type="password" required minLength={12} autoComplete="new-password" className={input} />
        </label>
        <ErrorNote message={err} />
        <button disabled={busy} className={`${primary} h-12 w-full`}>Opslaan</button>
      </form>
    </Gate>
  );
}

function SignOut() {
  return (
    <button type="button" className="mt-6 min-h-11 font-semibold text-forest" onClick={() => supabase().auth.signOut()}>
      Uitloggen
    </button>
  );
}

function CodeField() {
  return (
    <label className="block">
      <span className="mb-1.5 block font-semibold">Code uit je app</span>
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required className={input} />
    </label>
  );
}

/** Tweede stap bij het inloggen: de zescijferige code van een al ingestelde authenticator-app */
function MfaCode({ email, onDone }: { email?: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = totpCode(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!code) return setErr("Typ de zes cijfers uit je authenticator-app.");
    setBusy(true);
    setErr(null);
    const mfa = supabase().auth.mfa;
    const factors = await mfa.listFactors();
    const factor = factors.data?.totp[0];
    if (factors.error || !factor) {
      setBusy(false);
      return setErr(factors.error ? errorMessage(factors.error) : "Geen authenticator-app gevonden voor dit account.");
    }
    const { error } = await mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) return setErr(/invalid|expired/i.test(error.message) ? "Deze code klopt niet of is verlopen. Probeer de nieuwe code." : errorMessage(error));
    onDone();
  }
  return (
    <Gate>
      <h1 className="font-display text-2xl font-semibold">Tweede stap</h1>
      <p className="mt-2 text-ink-2">Open je authenticator-app en typ de code voor VrijStaan{email ? ` (${email})` : ""}.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <CodeField />
        <ErrorNote message={err} />
        <button disabled={busy} className={`${primary} h-12 w-full`}>{busy ? "Bezig…" : "Bevestigen"}</button>
      </form>
      <SignOut />
    </Gate>
  );
}

/**
 * Eerste keer: een authenticator-app koppelen (QR-code of sleutel), daarna één code invullen. Na de bevestiging is de
 * sessie aal2 en logt Supabase andere sessies uit. Halve pogingen (ongeverifieerde factoren) ruimen we eerst op.
 */
function MfaEnroll({ email, onDone }: { email?: string; onDone: () => void }) {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Eén registratie per scherm, ook als React de effect in de ontwikkelmodus twee keer draait
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Geen opruimfunctie: na de dubbele effect in de ontwikkelmodus moet dit ene resultaat het scherm nog vullen
    void (async () => {
      const mfa = supabase().auth.mfa;
      const list = await mfa.listFactors();
      for (const f of list.data?.all ?? []) if (f.status === "unverified") await mfa.unenroll({ factorId: f.id });
      const { data, error } = await mfa.enroll({ factorType: "totp", friendlyName: `Beheer ${new Date().toISOString().slice(0, 10)} ${crypto.randomUUID().slice(0, 8)}` });
      if (error) return setErr(errorMessage(error));
      setFactor({ id: data.id, qr: qrDataUrl(data.totp.qr_code), secret: data.totp.secret });
    })();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factor) return;
    const code = totpCode(String(new FormData(e.currentTarget).get("code") ?? ""));
    if (!code) return setErr("Typ de zes cijfers uit je authenticator-app.");
    setBusy(true);
    setErr(null);
    const { error } = await supabase().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (error) return setErr(/invalid|expired/i.test(error.message) ? "Deze code klopt niet of is verlopen. Probeer de nieuwe code." : errorMessage(error));
    onDone();
  }

  return (
    <Gate>
      <h1 className="font-display text-2xl font-semibold">Tweestapsverificatie instellen</h1>
      <p className="mt-2 text-ink-2">
        Beheer vraagt naast je wachtwoord een code uit een authenticator-app, zoals Google Authenticator, 1Password of
        Microsoft Authenticator{email ? ` (voor ${email})` : ""}. Scan de QR-code en typ daarna de code die de app toont.
      </p>
      {factor ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR-code als data-URL van Supabase, geen extern beeld */}
          <img src={factor.qr} alt="QR-code om VrijStaan toe te voegen aan je authenticator-app" width={200} height={200} className="mx-auto mt-6 rounded-lg bg-white p-2" />
          <p className="mt-3 text-sm text-muted">Scannen lukt niet? Typ deze sleutel in de app:</p>
          <p className="font-mono text-sm break-all">{factor.secret}</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <CodeField />
            <ErrorNote message={err} />
            <button disabled={busy} className={`${primary} h-12 w-full`}>{busy ? "Bezig…" : "Koppelen"}</button>
          </form>
        </>
      ) : err ? (
        <div className="mt-6"><ErrorNote message={err} /></div>
      ) : (
        <p className="mt-6 text-muted" role="status">QR-code maken…</p>
      )}
      <SignOut />
    </Gate>
  );
}
