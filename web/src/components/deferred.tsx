"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { markWelcomeSeen, readConsent, readWelcome } from "@/lib/store";

/**
 * Onderdelen die niets aan de eerste weergave bijdragen, in een eigen bundel die pas na de hydratatie binnenkomt
 * (R34, review november 2026). Wat ze doen is gelijk gebleven; alleen het moment van laden is anders.
 */

/** Reis, camper en uitgaven gelijkhouden met het account (components/trip-sync.tsx) */
export const TripSync = dynamic(() => import("./trip-sync").then((m) => m.TripSync), { ssr: false });

const OnboardingSheet = dynamic(() => import("./onboarding").then((m) => m.Onboarding), { ssr: false });

/**
 * Welkomstuitleg op de startpagina (components/onboarding.tsx). Alleen wie hem nog moet zien, laadt hem (met motion);
 * dezelfde voorwaarden als in Onboarding zelf.
 */
export function Onboarding() {
  const [needed, setNeeded] = useState(false);
  useEffect(() => {
    if (readWelcome()) return;
    // Terugkerende bezoeker van vóór deze uitleg: meteen als gezien markeren
    if (readConsent()) {
      markWelcomeSeen();
      return;
    }
    void Promise.resolve().then(() => setNeeded(true));
  }, []);
  return needed ? <OnboardingSheet /> : null;
}
