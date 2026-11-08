"use client";

import { useEffect, useRef, useState } from "react";
import { errorId, type FormError } from "@/lib/form-errors";

/**
 * Foutstaat van een formulier. Gaat de fout over één veld, dan krijgt dat veld de focus: een schermlezer leest dan
 * het label en de foutmelding (aria-describedby) voor (review november R31).
 */
export function useFormError() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<FormError | null>(null);
  useEffect(() => {
    if (!error?.field) return;
    const el = formRef.current?.elements.namedItem(error.field);
    if (el instanceof HTMLElement) el.focus();
  }, [error]);
  return { formRef, error, setError };
}

/** Foutmelding onder een veld; de id hoort bij `fieldAria` op het veld zelf */
export function FieldError({ error, form, field }: { error: FormError | null; form: string; field: string }) {
  if (error?.field !== field) return null;
  return (
    <span id={errorId(form, field)} className="mt-1 block text-sm font-semibold text-alert">
      {error.message}
    </span>
  );
}

/** Algemene fout boven de verzendknop; alleen als de fout niet bij één veld hoort */
export function FormAlert({ error, id }: { error: FormError | null; id?: string }) {
  if (!error || error.field) return null;
  return (
    <p id={id} role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">
      {error.message}
    </p>
  );
}
