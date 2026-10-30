/**
 * Avondmodus (besluit eigenaar B9, 29 oktober 2026): standaard "automatisch", dan donker als het systeem donker vraagt
 * of als de zon in Nederland onder is. De bezoeker kan licht of donker vastzetten (`ThemeChoice` in de footer).
 *
 * `resolveTheme` staat op zichzelf (geen imports, geen andere functies): de layout zet hem als tekst in een klein
 * script in <head>, zodat het thema vóór de eerste weergave klopt en de pagina niet eerst licht flitst.
 */
export type ThemeChoice = "automatisch" | "licht" | "donker";

export const THEME_KEY = "vrijstaan:thema";

export function resolveTheme(choice: string | null, systemDark: boolean, now: Date): "light" | "dark" {
  if (choice === "licht") return "light";
  if (choice === "donker") return "dark";
  if (systemDark) return "dark";
  // Zonsopkomst en -ondergang voor het midden van Nederland (52,2 N, 5,3 O), op een paar minuten nauwkeurig
  const lat = 52.2;
  const lng = 5.3;
  const rad = Math.PI / 180;
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86400000);
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + day));
  const b = ((2 * Math.PI) / 364) * (day - 81);
  const eqTime = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  // -0,83 graden: de zon is net onder de horizon (breking en schijfje meegerekend)
  const cosH = (Math.sin(-0.83 * rad) - Math.sin(lat * rad) * Math.sin(decl * rad)) / (Math.cos(lat * rad) * Math.cos(decl * rad));
  const hours = (Math.acos(Math.max(-1, Math.min(1, cosH))) / rad) / 15;
  const noon = 12 - lng / 15 - eqTime / 60;
  const utc = now.getUTCHours() + now.getUTCMinutes() / 60;
  return utc < noon - hours || utc > noon + hours ? "dark" : "light";
}

/** Het script voor <head>: leest de keuze, zet `data-theme` op <html>. Fouten (geen opslag) laten het thema op automatisch. */
export const THEME_BOOT = `(function(){var c=null;try{c=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}var d=false;try{d=matchMedia("(prefers-color-scheme: dark)").matches}catch(e){}document.documentElement.dataset.theme=(${resolveTheme.toString()})(c,d,new Date())})()`;

/** Thema toepassen na een keuze of een wisseling van het systeem */
export function applyTheme(choice: string | null) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(choice, systemDark, new Date());
  window.dispatchEvent(new Event("vrijstaan:thema"));
}
