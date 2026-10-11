"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

/**
 * Bottom sheet op mobiel, gecentreerd paneel op grotere schermen.
 * Omlaag vegen of Escape sluit. Focus blijft binnen het paneel.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        );
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-lift sm:max-w-lg sm:rounded-3xl"
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-line sm:hidden" aria-hidden="true" />
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-3">
              <h2 id={id} className="font-display text-xl font-semibold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sluiten"
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-sunken"
              >
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4" onPointerDownCapture={(e) => e.stopPropagation()}>
              {children}
            </div>
            {footer && <div className="shrink-0 border-t border-line px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
