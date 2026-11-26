/** Alleen interne paden als bestemming na het inloggen (geen open redirect) */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/account";
  // De browser haalt tabs en regeleinden uit een URL en leest "\\" als "/": "/\t/evil.nl" wordt zo "//evil.nl". Daarom
  // laten we de URL-parser beslissen en houden we alleen pad, zoekvraag en anker over als de herkomst gelijk blijft.
  const base = "https://vrijstaan.invalid";
  let url: URL;
  try {
    url = new URL(next, base);
  } catch {
    return "/account";
  }
  if (url.origin !== base) return "/account";
  // Ook na het opschonen van "." en ".." mag het geen protocol-relatief adres worden ("/..//evil.nl" → "//evil.nl")
  const out = url.pathname + url.search + url.hash;
  return out.startsWith("//") || out.startsWith("/\\") ? "/account" : out;
}

/** Vriendelijke foutmelding voor fouten uit de inlogflow (ook ?error_description= in de callback-URL) */
export function authErrorMessage(raw: string): string {
  if (/provider is not enabled|unsupported provider/i.test(raw)) return "Inloggen via deze dienst is nog niet beschikbaar. Kies een andere manier of log in met je e-mailadres.";
  if (/rate limit|too many|security purposes/i.test(raw)) return "Je hebt net al een mail aangevraagd. Wacht een minuutje en probeer het dan opnieuw.";
  if (/expired|invalid.*(link|token|code)|otp/i.test(raw)) return "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.";
  if (/access_denied|cancel/i.test(raw)) return "Inloggen is geannuleerd.";
  if (/fetch|network/i.test(raw)) return "Geen verbinding. Controleer je internet en probeer het opnieuw.";
  return "Inloggen lukte niet. Probeer het opnieuw of kies een andere manier.";
}

/** Alleen cijfers uit een geplakte of getypte code; Supabase stuurt 6 tot 10 cijfers */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

/** Foutmelding bij het invullen van de code uit de mail */
export function codeErrorMessage(raw: string): string {
  if (/rate limit|too many|security purposes/i.test(raw)) return authErrorMessage(raw);
  if (/expired|invalid|otp|token/i.test(raw)) return "Deze code klopt niet of is verlopen. Controleer de cijfers of vraag een nieuwe code aan.";
  return authErrorMessage(raw);
}
