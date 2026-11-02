"use client";

import { MotionConfig, motion } from "motion/react";
import { useEffect, useState } from "react";
import { markWelcomeSeen, readConsent, readWelcome } from "@/lib/store";
import { Icon, type IconName } from "./icons";
import { Sheet } from "./sheet";

/**
 * Frictieloze onboarding (masterplan fase 1): drie korte schermen voor wie de startpagina voor het eerst opent.
 * Eén keer per toestel (`vrijstaan:welkom` in localStorage, dezelfde soort opslag als de cookiekeuze). Wie al eerder
 * een cookiekeuze maakte, is geen nieuwe bezoeker en krijgt hem niet. Alleen in de browser: zoekmachines en de
 * prerender zien hem niet, en hij ligt boven de pagina, dus niets verspringt.
 */
const SLIDES: { icon: IconName; title: string; lead: string; points: string[] }[] = [
  {
    icon: "clock",
    title: "Welkom bij VrijStaan",
    lead: "Geen lappen tekst, alleen feiten. Per plek zie je meteen:",
    points: ["of je er met de camper mag staan", "hoe laat je weg moet", "wat een nacht kost, met alle toeslagen"],
  },
  {
    icon: "refresh",
    title: "Actueel, met jouw hulp",
    lead: "Jij helpt mee met één tik op de knop.",
    points: [
      "Bij elke plek staat wanneer we hem voor het laatst nakeken",
      "Klopt iets niet meer? Met één tik laat je het weten",
      "Wat we niet weten, staat er als onbekend",
    ],
  },
  {
    icon: "sliders",
    title: "Sneller op je plek",
    lead: "Filter op wat echt telt.",
    points: ["Geen vaste vertrektijd of pas om 12:00 weg", "Stroom, lozen en gratis met één tik", "De lengte van je eigen camper"],
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (readWelcome()) return;
    // Terugkerende bezoeker van vóór deze uitleg: meteen als gezien markeren
    if (readConsent()) {
      markWelcomeSeen();
      return;
    }
    // Even wachten: eerst staat de pagina, dan schuift de uitleg rustig in beeld
    const t = setTimeout(() => setOpen(true), 400);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    markWelcomeSeen();
    setOpen(false);
  };
  const go = (next: number) => {
    setStep(next);
  };
  const last = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <Sheet
      open={open}
      onClose={close}
      title={slide.title}
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {SLIDES.map((s, i) => (
              <span key={s.title} className={`h-1.5 rounded-full transition-colors duration-200 ${i === step ? "w-5 bg-forest" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <span className="sr-only" aria-live="polite">
            Stap {step + 1} van {SLIDES.length}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {step > 0 ? (
              <button type="button" onClick={() => go(step - 1)} className="h-11 rounded-md px-3 font-semibold text-ink-2 hover:text-forest">
                Terug
              </button>
            ) : (
              <button type="button" onClick={close} className="h-11 rounded-md px-3 font-semibold text-ink-2 hover:text-forest">
                Overslaan
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? close() : go(step + 1))}
              className="h-11 min-w-28 rounded-md bg-forest px-5 font-semibold text-on-forest hover:bg-forest-deep"
            >
              {last ? "Aan de slag" : "Volgende"}
            </button>
          </div>
        </div>
      }
    >
      <MotionConfig reducedMotion="user">
        {/* Alle schermen in één rastercel: het paneel is zo hoog als het langste scherm en springt nooit */}
        <div className="grid overflow-hidden">
          {SLIDES.map((s, i) => {
            const active = i === step;
            return (
              <motion.div
                key={s.title}
                className="[grid-area:1/1]"
                aria-hidden={!active}
                inert={!active}
                initial={false}
                animate={{ opacity: active ? 1 : 0, x: active ? 0 : (i < step ? -24 : 24) }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <Icon name={s.icon} size={28} className="text-forest" />
                <p className="mt-3 text-lg leading-snug font-semibold text-ink">{s.lead}</p>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 py-2.5 text-ink-2">
                      <Icon name="check" size={18} className="mt-1 shrink-0 text-forest" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </MotionConfig>
    </Sheet>
  );
}
