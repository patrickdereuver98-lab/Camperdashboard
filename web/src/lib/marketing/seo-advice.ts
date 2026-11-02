/** Voorstel voor titel en omschrijving bij een SEO-kans (plan §3.2.4). Patrick neemt het over of niet. */
import { factDate, factLines, type Facts } from "./facts";

export const SEO_SCHEMA = {
  type: "OBJECT",
  properties: { title: { type: "STRING" }, description: { type: "STRING" }, why: { type: "STRING" } },
  required: ["title", "description", "why"],
};

export function seoPrompt(query: string, page: string, position: number, facts: Facts): string {
  return [
    `Google toont de pagina ${page} op positie ${position.toFixed(1)} voor de zoekvraag "${query}", maar er wordt weinig op geklikt.`,
    "Stel een betere paginatitel (hoogstens 60 tekens, zonder merknaam: die zet de site er zelf achter) en meta-omschrijving (hoogstens 155 tekens) voor.",
    "Gebruik de woorden van de zoekvraag. Noem concrete feiten (prijs, vertrektijd, aantal plekken) alleen als ze hieronder staan.",
    "Geef in why in één zin waarom dit beter werkt.",
    "",
    `Feitenbank (stand ${factDate(facts.measured_at)}):`,
    ...factLines(facts).filter((l) => l.public).map((l) => `- ${l.text}`),
    "",
    "Retourneer strict JSON: { title, description, why }.",
  ].join("\n");
}

export function parseSeoAdvice(raw: string): { title: string; description: string; why: string } | null {
  try {
    const d = JSON.parse(raw) as { title?: unknown; description?: unknown; why?: unknown };
    if (typeof d.title !== "string" || typeof d.description !== "string" || !d.title.trim()) return null;
    return { title: d.title.trim().slice(0, 70), description: d.description.trim().slice(0, 170), why: typeof d.why === "string" ? d.why.trim().slice(0, 300) : "" };
  } catch {
    return null;
  }
}
