// Geist (lettertype van de site, SIL OFL, src/assets/fonts) voor ImageResponse: zonder eigen lettertype heeft Satori
// geen vette letter. Eén keer per serverproces ingelezen.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

type Font = { name: string; data: Buffer; weight: 400 | 600; style: "normal" };
let cache: Promise<Font[]> | null = null;

export function ogFonts(): Promise<Font[]> {
  cache ??= Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Geist-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/Geist-SemiBold.ttf")),
  ]).then(([regular, semibold]) => [
    { name: "Geist", data: regular, weight: 400, style: "normal" },
    { name: "Geist", data: semibold, weight: 600, style: "normal" },
  ]);
  return cache;
}
