/**
 * Gemini via de REST-API, zonder SDK (één fetch, geen extra pakket). Gebruikt door de Triage Inbox
 * (update-triage.ts), de inbox voor antwoorden van eigenaren (owner-inbox.ts) en Marketing in Mission Control
 * (api/admin/marketing/write). GEMINI_API_KEY staat alleen op de
 * server; het model is instelbaar met GEMINI_MODEL, omdat Google oudere Flash-modellen uitfaseert.
 */

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

type Options = {
  schema: Record<string, unknown>;
  system?: string;
  maxOutputTokens?: number;
  /** Standaard 0 (vast antwoord); hoger voor teksten die bij opnieuw vragen mogen verschillen */
  temperature?: number;
};

/**
 * Fout van Gemini. `temporary` = opnieuw proberen kan helpen (geen verbinding, time-out, 408, 429 of 5xx). Andere
 * fouten (verkeerde sleutel, onbekend model, geweigerde vraag) worden bij opnieuw proberen niet beter.
 */
export class GeminiError extends Error {
  readonly temporary: boolean;
  readonly status?: number;
  constructor(message: string, temporary: boolean, status?: number) {
    super(message);
    this.name = "GeminiError";
    this.temporary = temporary;
    this.status = status;
  }
}

/** Is dit een HTTP-status waarbij later opnieuw proberen zin heeft? */
export const isTemporaryStatus = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500;

/** Tijdelijke storing (netwerk, time-out, 408/429/5xx)? Alles wat geen GeminiError is, telt als tijdelijk. */
export function isTemporaryAiError(e: unknown): boolean {
  return e instanceof GeminiError ? e.temporary : true;
}

/** Eén aanroep met een JSON-schema; geeft de ruwe JSON-tekst terug of gooit een GeminiError */
export async function geminiJson(key: string, model: string, text: string, o: Options): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          temperature: o.temperature ?? 0,
          maxOutputTokens: o.maxOutputTokens ?? 300,
          responseMimeType: "application/json",
          responseSchema: o.schema,
        },
      }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new GeminiError(`Gemini niet bereikbaar (${e instanceof Error ? e.name : "fout"})`, true);
  }
  if (!res.ok) throw new GeminiError(`Gemini antwoordde ${res.status}`, isTemporaryStatus(res.status), res.status);
  // Een geblokkeerde vraag (promptFeedback.blockReason) of een leeg antwoord geeft "": de aanroeper ziet dan geen JSON
  const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
