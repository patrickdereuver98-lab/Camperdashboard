import { readFileSync } from "node:fs";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** De bewaarde tekst terug als eenvoudige HTML: één alinea per regel, een tabelrij bij " | " */
export function pagina(naam: string): string {
  const lines = readFileSync(new URL(`./paginas/${naam}.txt`, import.meta.url), "utf8").split("\n").filter(Boolean);
  const body = lines
    .map((l) => (l.includes(" | ") ? `<table><tr>${l.split(" | ").map((c) => `<td>${esc(c)}</td>`).join("")}</tr></table>` : `<p>${esc(l)}</p>`))
    .join("\n");
  return `<html><body>${body}</body></html>`;
}

