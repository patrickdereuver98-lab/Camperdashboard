"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHydrated } from "@/lib/use-media";
import { CONSENT_VERSION, readConsent, useConsent, writeConsent } from "@/lib/store";
import { supabase } from "@/lib/supabase-browser";

const OPEN_EVENT = "vrijstaan:cookie-instellingen";

function save(analytics: boolean) {
  const prev = readConsent();
  const consent = {
    id: prev?.id ?? crypto.randomUUID(),
    analytics,
    version: CONSENT_VERSION,
    at: new Date().toISOString(),
  };
  writeConsent(consent);
  // Bewijs van toestemming (AVG art. 7): alleen een willekeurig id en de keuze
  void supabase()
    .rpc("log_consent", { p_consent_id: consent.id, p_analytics: analytics, p_marketing: false, p_version: CONSENT_VERSION })
    .then(() => undefined, () => undefined);
}

export function CookieBanner() {
  const consent = useConsent();
  const mounted = useHydrated();
  const [forced, setForced] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const open = () => {
      setAnalytics(readConsent()?.analytics ?? false);
      setDetails(true);
      setForced(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const needed = !consent || consent.version !== CONSENT_VERSION;
  if (!mounted || (!needed && !forced)) return null;

  const close = (a: boolean) => {
    save(a);
    setForced(false);
    setDetails(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-titel"
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-lift md:bottom-6"
    >
      <h2 id="cookie-titel" className="font-sign text-lg font-bold">
        Cookies en statistieken
      </h2>
      <p className="mt-1.5 text-ink-2">
        We gebruiken alleen wat nodig is om de site te laten werken. Met jouw toestemming tellen we ook anoniem hoe de site
        wordt gebruikt, zonder cookies van derden. <Link href="/cookies" className="font-semibold text-road underline">Meer weten</Link>
      </p>
      {details && (
        <div className="mt-4 space-y-3 rounded-xl bg-sunken p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked disabled className="mt-1 h-5 w-5 accent-[var(--road)]" />
            <span>
              <span className="font-semibold">Noodzakelijk</span>
              <span className="block text-sm text-muted">Je bewaarde reis, je cookiekeuze en inloggen voor beheerders. Altijd aan.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="mt-1 h-5 w-5 accent-[var(--road)]"
            />
            <span>
              <span className="font-semibold">Anonieme statistieken</span>
              <span className="block text-sm text-muted">
                Welke pagina&apos;s en zoekopdrachten populair zijn. Opgeslagen in onze eigen database in de EU, zonder IP-adres.
              </span>
            </span>
          </label>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {details ? (
          <button type="button" onClick={() => close(analytics)} className="h-12 flex-1 rounded-xl bg-road px-5 font-semibold text-on-road">
            Keuze opslaan
          </button>
        ) : (
          <>
            <button type="button" onClick={() => close(true)} className="h-12 flex-1 rounded-xl bg-road px-5 font-semibold text-on-road">
              Accepteren
            </button>
            <button type="button" onClick={() => close(false)} className="h-12 flex-1 rounded-xl border border-line px-5 font-semibold">
              Alleen noodzakelijk
            </button>
            <button type="button" onClick={() => setDetails(true)} className="h-12 w-full rounded-xl px-5 font-semibold text-road underline sm:w-auto">
              Instellen
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CookieSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={`inline-block py-1.5 text-left text-ink-2 hover:text-road hover:underline ${className}`}
    >
      Cookie-instellingen
    </button>
  );
}
