/** Alleen interne paden als bestemming na het inloggen (geen open redirect) */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/account";
  return next;
}

/** Vriendelijke foutmelding voor fouten uit de inlogflow (ook ?error_description= in de callback-URL) */
export function authErrorMessage(raw: string): string {
  if (/provider is not enabled|unsupported provider/i.test(raw)) return "Inloggen via deze dienst is nog niet beschikbaar. Kies een andere manier of log in met je e-mailadres.";
  if (/rate limit|too many|security purposes/i.test(raw)) return "Je hebt net al een link aangevraagd. Wacht een minuutje en probeer het dan opnieuw.";
  if (/expired|invalid.*(link|token|code)|otp/i.test(raw)) return "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.";
  if (/access_denied|cancel/i.test(raw)) return "Inloggen is geannuleerd.";
  if (/fetch|network/i.test(raw)) return "Geen verbinding. Controleer je internet en probeer het opnieuw.";
  return "Inloggen lukte niet. Probeer het opnieuw of kies een andere manier.";
}
