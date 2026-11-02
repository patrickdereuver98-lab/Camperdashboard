"use client";

import { useState } from "react";
import { FORMATS, TEMPLATES, type ImageFormat, type ImageTemplate } from "@/lib/marketing/images";
import { PROVINCES } from "@/lib/types";
import { input, secondary } from "../../ui";

/** Beeldsjablonen (plan §3.4): voorbeeld en download, gemaakt door /api/marketing/beeld */
export function ImageStudio() {
  const [t, setT] = useState<ImageTemplate>("cijfers");
  const [f, setF] = useState<ImageFormat>("portrait");
  const [p, setP] = useState<string>(PROVINCES[0]);
  const [i, setI] = useState(1);
  const qs = new URLSearchParams({ t, f, ...(t === "provincie" ? { p } : {}), ...(t === "carrousel" ? { i: String(i) } : {}) });
  const src = `/api/marketing/beeld?${qs}`;
  const name = `vrijstaan-${t}${t === "provincie" ? `-${p.toLowerCase()}` : ""}${t === "carrousel" ? `-${i}` : ""}-${f}.png`;
  const { w, h } = FORMATS[f];

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Sjabloon</span>
          <select className={input} value={t} onChange={(e) => setT(e.target.value as ImageTemplate)}>
            {Object.entries(TEMPLATES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-semibold">Formaat</span>
          <select className={input} value={f} onChange={(e) => setF(e.target.value as ImageFormat)}>
            {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        {t === "provincie" && (
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Provincie</span>
            <select className={input} value={p} onChange={(e) => setP(e.target.value)}>
              {PROVINCES.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        )}
        {t === "carrousel" && (
          <div className="space-y-1">
            <span className="text-sm font-semibold">Dia</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`${secondary} h-10 w-10 px-0 ${n === i ? "border-forest bg-forest-tint" : ""}`} aria-pressed={n === i} onClick={() => setI(n)}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <a className={`${secondary} w-full`} href={src} download={name}>Downloaden ({w} × {h})</a>
        <p className="text-sm text-muted">
          De cijfers komen live uit de openbare plekken. Teksten liggen vast, zodat ze altijd kloppen met de huisstijl. Een provincie met minder dan 50 plekken geeft geen beeld.
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamische PNG uit onze eigen route */}
      <img key={src} src={src} alt={`Voorbeeld: ${TEMPLATES[t]}`} width={w} height={h} className="h-auto max-h-[70vh] w-auto max-w-full rounded-lg outline outline-1 outline-line" />
    </div>
  );
}
