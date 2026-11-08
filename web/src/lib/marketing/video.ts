/**
 * Videosjablonen (plan §3.4): één zelfstandig HTML-document per filmpje met een kleine tijdlijnmotor. In het dashboard
 * speelt het live af (iframe); in de GitHub Action zet scripts/marketing/jobs.ts de tijd per frame en maakt
 * Chromium er beelden van die ffmpeg tot MP4 maakt. Zelfde aanpak als Hyperframes, de motor van /brag, maar zonder
 * extra pakket.
 *
 * Creatieve regels (van /brag, latent-spaces/brag, MIT): haak in de eerste 2 seconden, 12 tot 18 seconden, elke regel
 * staat lang genoeg stil om te lezen (±0,3 s per woord), laat de echte app zien, elk stilstaand beeld is deelbaar.
 * Huisregels (vrijstaan-stijl): je-vorm, geen emoji, geen uitroeptekens, alleen cijfers uit de feitenbank.
 */
import { nl, PUBLIC_MIN, type Facts } from "./facts";

export const VIDEO_FORMATS = {
  vertical: { w: 1080, h: 1920, label: "Staand 9:16 (Reels, TikTok, Stories)" },
  portrait: { w: 1080, h: 1350, label: "Staand 4:5 (Instagram-tijdlijn)" },
  square: { w: 1080, h: 1080, label: "Vierkant 1:1 (Facebook)" },
} as const;
export type VideoFormatKey = keyof typeof VIDEO_FORMATS;

/** Schermopnames van de app (390 × 844, telefoon). `path` "plek" wordt de best beoordeelde plek. */
export const SHOTS = [
  { key: "start", path: "/", label: "Startpagina" },
  { key: "zoeken", path: "/zoeken", label: "Zoeken" },
  { key: "plek", path: "plek", label: "Plekpagina" },
  { key: "dichtbij", path: "/dichtbij", label: "Dichtbij" },
  { key: "mijn-reis", path: "/mijn-reis", label: "Mijn reis" },
  { key: "doe-mee", path: "/doe-mee", label: "Doe mee" },
] as const;
export type ShotKey = (typeof SHOTS)[number]["key"];

export const FEATURES = {
  uitslapers: { title: "Filter op uitslapers", lines: ["Plekken waar je tot 12:00 of later mag blijven", "Met één tik in Zoeken"], shot: "zoeken" },
  dichtbij: { title: "Dichtbij", lines: ["Camperplaatsen bij jou in de buurt", "Met afstand en rijtijd"], shot: "dichtbij" },
  "mijn-reis": { title: "Mijn reis", lines: ["Plan je route langs camperplaatsen", "Houd je kosten per nacht bij"], shot: "mijn-reis" },
} as const satisfies Record<string, { title: string; lines: string[]; shot: ShotKey }>;
export type FeatureKey = keyof typeof FEATURES;

export const VIDEO_TEMPLATES = {
  cijfers: { label: "Cijfers", shots: [] as ShotKey[], about: "Teller met het aantal plekken, daarna vertrektijd en prijs, eind met logo." },
  "zo-werkt-het": { label: "Zo werkt het", shots: ["zoeken", "plek", "dichtbij"] as ShotKey[], about: "Drie schermen van de app met korte uitleg." },
  provincie: { label: "Provincie", shots: [] as ShotKey[], about: "Eén provincie: aantal plekken, vertrektijd en prijs." },
  nieuw: { label: "Nieuw in de app", shots: ["zoeken", "dichtbij", "mijn-reis"] as ShotKey[], about: "Eén functie uitgelicht met een schermopname." },
  "doe-mee": { label: "Doe mee", shots: ["doe-mee"] as ShotKey[], about: "Vraag om vertrektijden te melden, met het meldscherm." },
} as const;
export type VideoTemplate = keyof typeof VIDEO_TEMPLATES;

export type VideoOptions = {
  province?: string;
  feature?: FeatureKey;
  /** Afbeelding per schermopname (URL of data-URL); zonder afbeelding een neutraal vlak met de naam */
  shots?: Partial<Record<ShotKey, string>>;
  /** URL van Geist-Variable.woff2 (of data-URL); zonder valt het terug op een systeemletter */
  fontUrl?: string;
  /** In de Action: geen eigen afspeellus, de renderer zet de tijd */
  render?: boolean;
};

export const FPS = 30;

type Scene = { from: number; to: number; html: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pub = (n: number) => n >= PUBLIC_MIN;

/** Element dat op `at` binnenkomt en (optioneel) op `out` weggaat */
const el = (tag: string, cls: string, text: string, at: number, out?: number, anim = "up", extra = "") =>
  `<${tag} class="${cls}" data-in="${at}"${out !== undefined ? ` data-out="${out}"` : ""} data-anim="${anim}"${extra}>${text}</${tag}>`;

const counter = (n: number, at: number, out: number, cls = "big") => el("div", cls, nl(n), at, out, "up", ` data-count="${n}"`);

const outro = (from: number): Scene => ({
  from,
  to: from + 4,
  html: [
    `<div class="logo" data-in="${from + 0.1}" data-anim="scale"><span class="mark">V</span><span>VrijStaan</span></div>`,
    el("p", "sub", "Camperplaatsen in heel Nederland", from + 0.6),
    el("p", "url", "vrijstaan.nl", from + 1.1),
    el("p", "small", "Gratis, zonder account", from + 1.5),
  ].join(""),
});

const phone = (key: ShotKey, opts: VideoOptions, at: number, out: number) => {
  const src = opts.shots?.[key];
  const label = SHOTS.find((s) => s.key === key)?.label ?? key;
  return `<div class="phone" data-in="${at}" data-out="${out}" data-anim="rise">${src ? `<img src="${esc(src)}" alt="">` : `<div class="noshot">${esc(label)}</div>`}</div>`;
};

/** Scènes per sjabloon; elke scène loopt van `from` tot `to` seconden */
function scenes(t: VideoTemplate, f: Facts, o: VideoOptions): Scene[] {
  const d = f.departure;
  switch (t) {
    case "cijfers": {
      const out: Scene[] = [
        { from: 0, to: 3.8, html: [el("p", "kicker", "Camperplaatsen in Nederland", 0.15, 3.5), counter(f.places, 0.4, 3.5), el("p", "sub", "op één kaart, met prijs en vertrektijd als we die weten", 1.4, 3.5)].join("") },
      ];
      let at = 3.9;
      if (pub(d.uitslapers) || pub(d.known)) {
        out.push({
          from: at,
          to: at + 3.9,
          html: [
            el("h2", "title", "Hoe laat moet je weg?", at + 0.1, at + 3.6),
            pub(d.known) ? el("p", "line", `Bij ${nl(d.known)} plekken staat het erbij`, at + 0.9, at + 3.6) : "",
            pub(d.uitslapers) ? el("p", "line", `Bij ${nl(d.uitslapers)} mag je tot 12:00 of later blijven`, at + 1.7, at + 3.6) : "",
          ].join(""),
        });
        at += 4;
      }
      const priceLines = [pub(f.price.known) ? `${nl(f.price.known)} met prijs per nacht` : "", pub(f.facilities.power) ? `${nl(f.facilities.power)} met stroom` : "", pub(f.facilities.dogs) ? `${nl(f.facilities.dogs)} waar je hond welkom is` : ""].filter(Boolean);
      if (priceLines.length) {
        out.push({ from: at, to: at + 3.9, html: [el("h2", "title", "Wat je vooraf weet", at + 0.1, at + 3.6), ...priceLines.map((l, i) => el("p", "line", l, at + 0.8 + i * 0.6, at + 3.6))].join("") });
        at += 4;
      }
      return [...out, outro(at)];
    }
    case "provincie": {
      const p = f.provinces.find((x) => x.province === o.province) ?? f.provinces[0];
      return [
        { from: 0, to: 3.8, html: [el("p", "kicker", "Camperplaatsen in", 0.15, 3.5), el("div", "big word", esc(p?.province ?? "Nederland"), 0.4, 3.5, "scale"), counter(p?.places ?? f.places, 1.0, 3.5, "mid")].join("") },
        { from: 3.9, to: 7.8, html: [el("h2", "title", "Op de kaart, met alles erbij", 4.0, 7.5), el("p", "line", "Prijs per nacht, met toeslagen als we ze weten", 4.8, 7.5), el("p", "line", "Hoe laat je weg moet", 5.5, 7.5), el("p", "line", "Stroom, water, honden", 6.1, 7.5)].join("") },
        outro(7.9),
      ];
    }
    case "zo-werkt-het": {
      const steps: { shot: ShotKey; text: string }[] = [
        { shot: "zoeken", text: "Zoek op de kaart of in de lijst" },
        { shot: "plek", text: "Per plek: prijs, vertrektijd en voorzieningen" },
        { shot: "dichtbij", text: "Of kijk wat er bij jou in de buurt is" },
      ];
      return [
        { from: 0, to: 2.9, html: [el("h2", "title hook", "Hoe laat moet je weg? Zie het vooraf.", 0.1, 2.6)].join("") },
        ...steps.map((s, i) => {
          const from = 3 + i * 4;
          return { from, to: from + 3.9, html: [el("p", "caption", s.text, from + 0.1, from + 3.6), phone(s.shot, o, from + 0.2, from + 3.6)].join("") };
        }),
        outro(15),
      ];
    }
    case "nieuw": {
      const feat = FEATURES[o.feature ?? "uitslapers"];
      return [
        { from: 0, to: 3.4, html: [el("p", "kicker", "Nieuw in VrijStaan", 0.1, 3.1), el("h2", "title", feat.title, 0.5, 3.1, "scale"), ...feat.lines.map((l, i) => el("p", "line", l, 1.2 + i * 0.6, 3.1))].join("") },
        { from: 3.5, to: 8.4, html: [el("p", "caption", feat.title, 3.6, 8.1), phone(feat.shot, o, 3.7, 8.1)].join("") },
        outro(8.5),
      ];
    }
    case "doe-mee":
      return [
        { from: 0, to: 3.4, html: [el("p", "kicker", "Doe mee", 0.1, 3.1), el("h2", "title", "Weet jij hoe laat je weg moet?", 0.4, 3.1)].join("") },
        { from: 3.5, to: 8.4, html: [el("p", "caption", "Meld het in een paar tikken", 3.6, 8.1), phone("doe-mee", o, 3.7, 8.1)].join("") },
        { from: 8.5, to: 11.4, html: [el("h2", "title", "Dan weet de volgende camperaar het ook", 8.6, 11.1), el("p", "url", "vrijstaan.nl/doe-mee", 9.6, 11.1)].join("") },
        outro(11.5),
      ];
  }
}

/** Het hele HTML-document en de lengte in seconden */
export function buildVideo(template: VideoTemplate, format: VideoFormatKey, facts: Facts, opts: VideoOptions = {}): { html: string; duration: number } {
  const { w, h } = VIDEO_FORMATS[format];
  const list = scenes(template, facts, opts);
  const duration = Math.max(...list.map((s) => s.to));
  const phoneH = format === "vertical" ? 1150 : format === "portrait" ? 800 : 640;
  const css = `
${opts.fontUrl ? `@font-face{font-family:Geist;src:url(${JSON.stringify(opts.fontUrl)}) format("woff2");font-weight:100 900;font-display:block}` : ""}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#f7eed9;color:#1f2b24;font-family:Geist,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:28px;padding:${format === "vertical" ? "180px 84px" : "90px 84px"}}
.scene.has-phone{align-items:center;text-align:center;justify-content:${format === "vertical" ? "flex-start" : "center"};gap:${format === "square" ? 24 : 40}px}
[data-in]{opacity:0;will-change:transform,opacity}
.kicker{font-size:52px;color:#46524a;font-weight:500}
.big{font-size:${format === "square" ? 210 : 250}px;line-height:.95;font-weight:650;color:#1f4e37;letter-spacing:-8px;font-variant-numeric:tabular-nums}
.big.word{font-size:${format === "square" ? 120 : 140}px;letter-spacing:-4px}
.mid{font-size:120px;font-weight:650;color:#1f4e37;letter-spacing:-3px;font-variant-numeric:tabular-nums}
.sub{font-size:60px;line-height:1.15;font-weight:550;max-width:900px}
.title{font-size:${format === "square" ? 80 : 92}px;line-height:1.05;font-weight:650;letter-spacing:-2px;max-width:920px}
.title.hook{font-size:${format === "square" ? 92 : 110}px}
.line{font-size:54px;line-height:1.2;color:#1f2b24;display:flex;gap:22px;align-items:baseline;max-width:920px}
.line::before{content:"";flex:none;width:16px;height:16px;border-radius:8px;background:#1f4e37;transform:translateY(-4px)}
.caption{font-size:${format === "square" ? 46 : 56}px;line-height:1.15;font-weight:600;max-width:920px}
.phone{height:${phoneH}px;aspect-ratio:390/844;border-radius:${Math.round(phoneH / 14)}px;background:#1f2b24;padding:${Math.round(phoneH / 70)}px;box-shadow:0 30px 60px -20px rgb(50 38 18/.35)}
.phone img,.phone .noshot{width:100%;height:100%;border-radius:${Math.round(phoneH / 16)}px;object-fit:cover;object-position:top;display:block;background:#fffaef}
.phone .noshot{display:grid;place-items:center;font-size:40px;color:#5c665e}
.logo{display:flex;align-items:center;gap:28px;font-size:96px;font-weight:650;color:#1f4e37;letter-spacing:-2px}
.logo .mark{display:grid;place-items:center;width:132px;height:132px;border-radius:32px;background:#1f4e37;color:#fffaef;font-size:84px}
.url{font-size:64px;font-weight:600;color:#1f4e37}
.small{font-size:46px;color:#46524a}
#progress{position:absolute;left:0;bottom:0;height:10px;background:#1f4e37;opacity:.85}
`;
  const body = list
    .map((s) => `<section class="scene${s.html.includes('class="phone"') ? " has-phone" : ""}">${s.html}</section>`)
    .join("");
  const engine = `
(function(){
  var D=${duration};
  var els=[].slice.call(document.querySelectorAll('[data-in]'));
  function c(x){return x<0?0:x>1?1:x}
  function ease(x){x=c(x);return 1-Math.pow(1-x,3)}
  function seek(t){
    for(var k=0;k<els.length;k++){
      var e=els[k],i=+e.dataset.in,o=e.dataset.out?+e.dataset.out:1e9,a=e.dataset.anim||'up';
      var pi=ease((t-i)/0.55),po=ease((t-o)/0.4);
      e.style.opacity=String(pi*(1-po));
      var tr='';
      if(a==='up')tr='translateY('+((1-pi)*56-po*28)+'px)';
      else if(a==='scale')tr='scale('+(0.9+0.1*pi-0.04*po)+')';
      else if(a==='rise')tr='translateY('+((1-pi)*160-po*60)+'px) scale('+(0.94+0.06*pi)+')';
      e.style.transform=tr;
      if(e.dataset.count){var n=+e.dataset.count;e.textContent=Math.round(n*ease((t-i)/1.6)).toLocaleString('nl-NL')}
    }
    var b=document.getElementById('progress');if(b)b.style.width=(c(t/D)*100)+'%';
  }
  window.__video={duration:D,fps:${FPS},seek:seek};
  ${opts.render ? "seek(0);" : "var s=performance.now();(function loop(n){seek(((n-s)/1000)%D);requestAnimationFrame(loop)})(s);"}
})();`;
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=${w}"><style>${css}</style></head><body>${body}<div id="progress"></div><script>${engine}</script></body></html>`;
  return { html, duration };
}
