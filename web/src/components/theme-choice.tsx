"use client";

import { useEffect, useState } from "react";
import { applyTheme, THEME_KEY, type ThemeChoice as Choice } from "@/lib/theme";
import { Icon, type IconName } from "./icons";

const OPTIONS: { value: Choice; label: string; icon: IconName }[] = [
  { value: "automatisch", label: "Automatisch", icon: "moon" },
  { value: "licht", label: "Licht", icon: "sun" },
  { value: "donker", label: "Donker", icon: "moon" },
];

function readChoice(): Choice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "licht" || v === "donker" ? v : "automatisch";
  } catch {
    return "automatisch";
  }
}

/**
 * Weergave kiezen (besluit eigenaar B9, 29 oktober 2026). Automatisch = donker na zonsondergang of als het systeem donker
 * vraagt; de keuze blijft in deze browser. Bij automatisch kijkt de site elke 5 minuten opnieuw naar de zon.
 */
export function ThemeChoice() {
  const [choice, setChoice] = useState<Choice | null>(null);

  useEffect(() => {
    // Na hydratatie: de opslag bestaat pas in de browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readChoice());
    const refresh = () => readChoice() === "automatisch" && applyTheme("automatisch");
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", refresh);
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => {
      mq.removeEventListener("change", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const pick = (value: Choice) => {
    try {
      if (value === "automatisch") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      /* geen opslag: de keuze geldt dan alleen voor deze pagina */
    }
    setChoice(value);
    applyTheme(value);
  };

  return (
    <div role="radiogroup" aria-labelledby="weergave-kop" className="flex flex-wrap items-center gap-2">
      <h2 id="weergave-kop" className="mr-1 text-sm font-semibold text-ink-2">
        Weergave
      </h2>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={choice === o.value}
          onClick={() => pick(o.value)}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-2 shadow-low aria-checked:bg-forest-tint aria-checked:text-forest"
        >
          <Icon name={o.icon} size={16} />
          {o.label}
        </button>
      ))}
      <p className="w-full text-sm text-muted">Automatisch wordt donker na zonsondergang.</p>
    </div>
  );
}
