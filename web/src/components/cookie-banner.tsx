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

  // Klein en onderaan, zodat het zoekveld en de resultaten zichtbaar blijven. Met "Zelf instellen" klapt de uitleg open.
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-titel"
      className={`fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-xl bg-surface shadow-float md:bottom-6 ${details ? "p-4" : "px-3 py-2.5"}`}
    >
      {details ? (
        <>
          <h2 id="cookie-titel" className="font-display text-lg font-semibold">
            Cookies en statistieken
          </h2>
          <p className="mt-1.5 text-ink-2">
            We slaan alleen op wat nodig is om de site te laten werken. Geef je toestemming, dan tellen we ook hoe de site
            wordt gebruikt. <Link href="/cookies" className="font-semibold text-forest underline">Meer weten</Link>
          </p>
          <div className="mt-4 space-y-3 rounded-xl bg-sunken p-4">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1 h-5 w-5 accent-[var(--forest)]" />
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
                className="mt-1 h-5 w-5 accent-[var(--forest)]"
              />
              <span>
                <span className="font-semibold">Statistieken</span>
                <span className="block text-sm text-muted">
                  We tellen welke pagina&apos;s en zoekopdrachten veel worden gebruikt. Dat staat in onze eigen database in de EU,
                  zonder IP-adres.
                </span>
              </span>
            </label>
          </div>
          <button type="button" onClick={() => close(analytics)} className="mt-4 min-h-12 w-full rounded-lg bg-forest px-5 font-semibold text-on-forest">
            Keuze opslaan
          </button>
        </>
      ) : (
        <>
          {/* Een smalle balk: bij het eerste bezoek blijft de pagina zelf zichtbaar (review 23 oktober 2026) */}
          <p id="cookie-titel" className="text-[0.9375rem] leading-snug text-ink-2">
            Mogen we tellen hoe de site wordt gebruikt, zonder cookies van derden?{" "}
            <button type="button" onClick={() => setDetails(true)} className="-my-3 inline-block py-3 font-semibold text-forest underline">
              Zelf instellen
            </button>
          </p>
          {/* Accepteren en weigeren zijn even zwaar (richtlijn Autoriteit Persoonsgegevens) */}
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => close(true)} className="min-h-11 rounded-lg border border-forest bg-forest-tint px-3 font-semibold text-forest">
              Toestaan
            </button>
            <button type="button" onClick={() => close(false)} className="min-h-11 rounded-lg border border-forest bg-forest-tint px-3 font-semibold text-forest">
              Alleen nodig
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function CookieSettingsLink({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={`inline-block py-2.5 text-left text-ink-2 hover:text-forest hover:underline ${className}`}
    >
      Cookie-instellingen
    </button>
  );
}
