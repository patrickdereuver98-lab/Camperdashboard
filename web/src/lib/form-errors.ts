// Serverfouten na verzenden: hoort de fout bij één veld, dan komt hij bij dat veld (aria-invalid en aria-describedby),
// anders boven de knop als algemene melding met role="alert" (review november R31, WCAG 3.3.1).

/** Leesbare foutmelding uit een Supabase/Postgres-fout */
export function errorMessage(err: unknown): string {
  const msg = (err as { message?: string } | null)?.message ?? String(err);
  if (/fetch|network|Failed to fetch/i.test(msg)) return "Geen verbinding. Controleer je internet en probeer het opnieuw.";
  if (/check constraint|violates/i.test(msg)) return "Niet alle velden zijn goed ingevuld.";
  return msg.replace(/^.*?ERROR:\s*/i, "");
}

function rawMessage(err: unknown): string {
  if (typeof err === "string") return err;
  const e = err as { message?: string; details?: string } | null;
  return [e?.message, e?.details].filter(Boolean).join(" ") || String(err);
}

/** Een fout na verzenden; `field` is de naam (`name`) van het veld waar hij over gaat, of null voor het hele formulier */
export type FormError = { field: string | null; message: string };

/** Herkent een serverfout als fout in één veld; zonder `message` blijft de tekst van de server staan */
export type FieldRule = { field: string; match: RegExp; message?: string };

export function formError(err: unknown, rules: FieldRule[] = []): FormError {
  const raw = rawMessage(err);
  const rule = rules.find((r) => r.match.test(raw));
  if (!rule) return { field: null, message: errorMessage(err) };
  return { field: rule.field, message: rule.message ?? errorMessage(err) };
}

/** Een fout die we zelf al weten, zonder server */
export function fieldError(field: string | null, message: string): FormError {
  return { field, message };
}

/** id van de foutmelding bij een veld, voor aria-describedby */
export function errorId(form: string, field: string): string {
  return `${form}-${field}-fout`;
}

/** Kenmerken voor het veld: alleen als de fout erover gaat */
export function fieldAria(error: FormError | null, form: string, field: string) {
  return error?.field === field ? { "aria-invalid": true as const, "aria-describedby": errorId(form, field) } : {};
}

// Velden van create_ticket (contact en melden). De velden heten per formulier anders, daarom is de koppeling een argument.
export function ticketRules(names: { name?: string; email?: string; subject?: string; body?: string } = {}): FieldRule[] {
  const n = { name: "name", email: "email", subject: "subject", body: "body", ...names };
  return [
    { field: n.email, match: /tickets_email_check/i, message: "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl." },
    { field: n.name, match: /tickets_name_check/i, message: "Vul een naam in van 2 tot 80 tekens." },
    { field: n.subject, match: /tickets_subject_check/i, message: "Vul een onderwerp in van 3 tot 140 tekens." },
    { field: n.body, match: /Je bericht is te (kort|lang)/i },
  ];
}

// Velden van submit_review en van de e-mailstap ervoor
export const REVIEW_RULES: FieldRule[] = [
  { field: "body", match: /reviews_body_check/i, message: "Schrijf minstens 20 en hoogstens 3.000 tekens over je ervaring." },
  { field: "name", match: /reviews_author_name_check/i, message: "Vul een naam in van 2 tot 60 tekens." },
  { field: "title", match: /reviews_title_check/i, message: "De titel mag hoogstens 120 tekens hebben." },
  { field: "email", match: /invalid.*e-?mail|e-?mail.*(invalid|format)/i, message: "Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.nl." },
];
