/**
 * Licht of donker. Standaard volgt de site de systeeminstelling; met de zon/maan-knop in de kop zet je het andere
 * thema vast (localStorage `vrijstaan:thema`). Kies je weer wat het systeem ook doet, dan vervalt de keuze en volgt
 * de site het systeem weer. Het actieve thema staat altijd als `data-theme="light|dark"` op <html>; de CSS-tokens
 * (globals.css) en de kaart (place-map.tsx) lezen alleen dat attribuut.
 */

export type Theme = "light" | "dark";

export const THEME_KEY = "vrijstaan:thema";
const DARK_QUERY = "(prefers-color-scheme: dark)";
/** Kleur van de browserbalk, gelijk aan --surface */
const BAR: Record<Theme, string> = { light: "#fffaef", dark: "#18201b" };

/**
 * Draait als inline script in <head> vóór de eerste weergave, zodat er geen lichte flits is bij een donkere keuze.
 * Houdt het attribuut ook bij als het systeem wisselt (zonsondergang) en er geen eigen keuze is.
 */
export const THEME_SCRIPT = `(function(){var k=${JSON.stringify(THEME_KEY)},b=${JSON.stringify(BAR)},d=document.documentElement,m=matchMedia(${JSON.stringify(DARK_QUERY)});function p(){try{var v=localStorage.getItem(k);return v==="light"||v==="dark"?v:null}catch(e){return null}}function a(){var t=p()||(m.matches?"dark":"light");d.dataset.theme=t;document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",b[t])})}a();m.addEventListener("change",a);addEventListener("storage",function(e){if(e.key===k)a()})})()`;

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Het thema dat nu op de pagina staat */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Zet het thema; gelijk aan het systeem = geen eigen keuze bewaren */
export function setTheme(theme: Theme) {
  try {
    if (theme === systemTheme()) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* privévenster of geblokkeerde opslag: dan alleen voor deze pagina */
  }
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BAR[theme]));
}

/** Abonnement op wijzigingen van het thema-attribuut (knop, systeem, ander tabblad) */
export function subscribeTheme(cb: () => void): () => void {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
