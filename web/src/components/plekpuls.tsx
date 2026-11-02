"use client";

import { useHydrated } from "@/lib/use-media";
import { usePulse, type PulseAnswer } from "@/lib/store";
import type { PulseQuestion } from "@/lib/plekpuls";
import { Icon } from "./icons";

const ANSWERS: { key: PulseAnswer; label: string }[] = [
  { key: "ja", label: "Ja" },
  { key: "nee", label: "Nee" },
  { key: "weet-niet", label: "Weet ik niet" },
];

/**
 * Plekpuls: één ja/nee-vraag in de regel, zonder formulier (README "VrijStaan 2.0", concept A). Het antwoord blijft
 * voorlopig op het toestel (`vrijstaan:plekpuls`); `onAnswer` is de haak voor de koppeling met de bronnenlaag later.
 * Al beantwoord: dan staat er alleen een korte bevestiging, en vragen we het niet nog eens.
 */
export function PlekpulsVraag({
  question,
  onAnswer,
  className = "",
}: {
  question: PulseQuestion;
  onAnswer?: (answer: PulseAnswer) => void;
  className?: string;
}) {
  const { answers, answer } = usePulse();
  const hydrated = useHydrated();
  const given = answers[question.key];
  // Vaste hoogte vóór en na hydratatie: geen sprong als de opslag binnenkomt
  if (!hydrated) return <div className={`min-h-20 ${className}`} aria-hidden="true" />;

  if (given) {
    return (
      <p role="status" className={`flex min-h-20 items-center gap-2 text-ink-2 ${className}`}>
        <Icon name="check" size={18} className="shrink-0 text-forest" />
        Bedankt, je antwoord staat genoteerd.
      </p>
    );
  }

  return (
    <fieldset className={`min-h-20 min-w-0 ${className}`}>
      <legend className="font-semibold text-ink">{question.question}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {ANSWERS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => {
              answer(question.key, a.key);
              onAnswer?.(a.key);
            }}
            className={`h-11 rounded-md border border-line bg-surface px-4 font-semibold hover:border-forest hover:text-forest ${a.key === "weet-niet" ? "text-ink-2" : "min-w-16 text-ink"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
