"use client";

import { useEffect, useRef } from "react";

/**
 * Bevestiging na verzenden. Het formulier verdwijnt, dus de focus zou nergens meer staan: die gaat naar deze melding,
 * en role="status" laat een schermlezer hem voorlezen (WCAG 4.1.3, review november R30).
 */
export function SuccessNote({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
  }, []);
  return (
    <div ref={ref} role="status" tabIndex={-1} data-testid="success-note" className={`focus:outline-none ${className}`}>
      {children}
    </div>
  );
}
