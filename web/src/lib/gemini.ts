/**
 * Gemini via de REST-API, zonder SDK (één fetch, geen extra pakket). Gebruikt door de Triage Inbox
 * (update-triage.ts) en de inbox voor antwoorden van eigenaren (owner-inbox.ts). GEMINI_API_KEY staat alleen op de
 * server; het model is instelbaar met GEMINI_MODEL, omdat Google oudere Flash-modellen uitfaseert.
 */

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

type Options = {
  schema: Record<string, unknown>;
  system?: string;
  maxOutputTokens?: number;
};

/** Eén aanroep met een JSON-schema; geeft de ruwe JSON-tekst terug of gooit een fout */
export async function geminiJson(key: string, model: string, text: string, o: Options): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      ...(o.system ? { systemInstruction: { parts: [{ text: o.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: o.maxOutputTokens ?? 300,
        responseMimeType: "application/json",
        responseSchema: o.schema,
      },
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini antwoordde ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
