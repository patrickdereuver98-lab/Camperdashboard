import { FORMATS, TEMPLATES, type ImageFormat, type ImageTemplate } from "@/lib/marketing/images";

/** Alleen eigen sleutels: `t=constructor` of `t=toString` is geen sjabloon (`in` kijkt ook naar het prototype) */
const isKey = <T extends object>(o: T, k: string | null): k is Extract<keyof T, string> => k !== null && Object.hasOwn(o, k);

export type BeeldParams = { t: ImageTemplate; f: ImageFormat; province?: string; slide: number };

/**
 * Parameters van /api/marketing/beeld controleren. Onbekend sjabloon of formaat, een provincie langer dan 40 tekens of
 * met andere tekens dan letters, spatie, punt, apostrof en streepje, of een dia buiten 1 t/m 20: null (400).
 */
export function beeldParams(sp: URLSearchParams): BeeldParams | null {
  const t = sp.get("t");
  const f = sp.get("f") ?? "portrait";
  if (!isKey(TEMPLATES, t) || !isKey(FORMATS, f)) return null;
  const p = sp.get("p")?.trim();
  if (p !== undefined && (p.length > 40 || !/^[\p{L} .'-]*$/u.test(p))) return null;
  const i = Number(sp.get("i") ?? "1");
  if (!Number.isInteger(i) || i < 1 || i > 20) return null;
  return { t, f, province: p || undefined, slide: i };
}
