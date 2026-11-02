/**
 * AI-advies bij een update uit de Triage Inbox (Mission Control). Alleen veld, oude en nieuwe waarde en eerdere
 * beslissingen over dezelfde plek gaan naar het model: geen namen, e-mailadressen of andere persoonsgegevens.
 * Het advies is een hulpmiddel; de beheerder beslist altijd zelf (spelregel: nooit data verzinnen).
 */

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export const TRIAGE_PROMPT =
  "Je bent een data-auditor voor een camper-app. Vergelijk de oude waarde met de voorgestelde nieuwe waarde. " +
  "Geef een betrouwbaarheidsscore (0-100) en een kort advies van 1 zin of de update logisch is, spam is, of in " +
  "conflict is met eerdere patronen. Retourneer strict JSON: { score, advice }.";

export type TriageInput = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  placeName?: string | null;
  history: { field: string; newValue: unknown; status: string }[];
};

export function triageText(i: TriageInput): string {
  const lines = [
    TRIAGE_PROMPT,
    "",
    `Plek: ${i.placeName ?? "onbekend"}`,
    `Veld: ${i.field}`,
    `Oude waarde: ${JSON.stringify(i.oldValue ?? null)}`,
    `Nieuwe waarde: ${JSON.stringify(i.newValue ?? null)}`,
    "Eerdere updates voor deze plek (veld, voorstel, beslissing):",
    ...(i.history.length ? i.history.map((h) => `- ${h.field}: ${JSON.stringify(h.newValue)} (${h.status})`) : ["- geen"]),
  ];
  return lines.join("\n");
}

/** Antwoord van het model controleren: score 0-100 (afgerond), advies 1 zin, hoogstens 300 tekens */
export function parseTriage(raw: string): { score: number; advice: string } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { score, advice } = data as { score?: unknown; advice?: unknown };
  const n = typeof score === "number" ? score : typeof score === "string" ? Number(score) : NaN;
  if (!Number.isFinite(n) || typeof advice !== "string" || !advice.trim()) return null;
  return { score: Math.max(0, Math.min(100, Math.round(n))), advice: advice.trim().replace(/\s+/g, " ").slice(0, 300) };
}

/** Eén aanroep naar Gemini (REST) met een JSON-schema; gooit een fout bij een onbruikbaar antwoord */
export async function askGemini(key: string, model: string, text: string): Promise<{ score: number; advice: string }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 300,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { score: { type: "INTEGER" }, advice: { type: "STRING" } },
          required: ["score", "advice"],
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini antwoordde ${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = parseTriage(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "");
  if (!out) throw new Error("Gemini gaf geen bruikbaar antwoord");
  return out;
}
