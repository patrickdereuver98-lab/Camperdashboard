"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketingAsset, MarketingJob } from "@/lib/marketing/db-types";
import { factDate } from "@/lib/marketing/facts";
import { buildVideo, FEATURES, SHOTS, VIDEO_FORMATS, VIDEO_TEMPLATES, type FeatureKey, type ShotKey, type VideoFormatKey, type VideoTemplate } from "@/lib/marketing/video";
import { errorMessage, toJson } from "@/lib/supabase-browser";
import { PROVINCES } from "@/lib/types";
import { Badge, Empty, ErrorNote, db, input, primary, secondary, useQuery, when } from "../../ui";
import { AssetCard } from "../kalender/page";
import { Section, notLive, useFacts } from "../shared";

const JOB_TONE = { wacht: "neutral", bezig: "yellow", klaar: "green", fout: "red" } as const;

/** Videostudio (plan §3.4): live voorbeeld in de browser, MP4 via de GitHub Action */
export function VideoStudio() {
  const { facts, error: factsError } = useFacts();
  const [template, setTemplate] = useState<VideoTemplate>("cijfers");
  const [format, setFormat] = useState<VideoFormatKey>("vertical");
  const [province, setProvince] = useState<string>("Gelderland");
  const [feature, setFeature] = useState<FeatureKey>("uitslapers");
  const [err, setErr] = useState<string | null>(null);

  const jobs = useQuery(() => db().from("marketing_jobs").select("*").order("created_at", { ascending: false }).limit(20), []);
  const shotsQ = useQuery(() => db().from("marketing_assets").select("*").eq("kind", "schermopname").order("created_at", { ascending: false }).limit(SHOTS.length * 2), []);
  const jobList = (jobs.data ?? []) as MarketingJob[];
  const shotAssets = useMemo(() => (shotsQ.data ?? []) as MarketingAsset[], [shotsQ.data]);
  const open = jobList.some((j) => j.status === "wacht" || j.status === "bezig");

  // Zolang er een opdracht loopt elke 15 seconden kijken
  const { reload: reloadJobs } = jobs;
  const { reload: reloadShots } = shotsQ;
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => {
      reloadJobs();
      reloadShots();
    }, 15_000);
    return () => clearInterval(t);
  }, [open, reloadJobs, reloadShots]);

  // Nieuwste schermopname per scherm, met tijdelijke link, voor het voorbeeld
  const [shotUrls, setShotUrls] = useState<Partial<Record<ShotKey, string>>>({});
  useEffect(() => {
    const latest = new Map<string, MarketingAsset>();
    for (const a of shotAssets) {
      const key = a.storage_path.split("/").pop()?.replace(/\.png$/, "") ?? "";
      if (!latest.has(key)) latest.set(key, a);
    }
    if (!latest.size) return;
    void db()
      .storage.from("marketing")
      .createSignedUrls([...latest.values()].map((a) => a.storage_path), 3600)
      .then(({ data }) => {
        const out: Partial<Record<ShotKey, string>> = {};
        for (const [key, a] of latest) {
          const url = data?.find((d) => d.path === a.storage_path)?.signedUrl;
          if (url) out[key as ShotKey] = url;
        }
        setShotUrls(out);
      });
  }, [shotAssets]);

  const preview = useMemo(
    // srcdoc erft de basis-URL van deze pagina, dus een relatief pad naar het lettertype werkt
    () => (facts ? buildVideo(template, format, facts, { province, feature, shots: shotUrls, fontUrl: "/fonts/Geist-Variable.woff2" }) : null),
    [facts, template, format, province, feature, shotUrls],
  );
  const { w, h } = VIDEO_FORMATS[format];
  const scale = 360 / w;

  async function order(kind: "video" | "schermopnames") {
    setErr(null);
    const { error } = await db()
      .from("marketing_jobs")
      .insert(
        kind === "video"
          ? { kind, template, format, props: toJson({ facts, ...(template === "provincie" ? { province } : {}), ...(template === "nieuw" ? { feature } : {}) }) }
          : { kind },
      );
    if (error) setErr(errorMessage(error));
    jobs.reload();
  }

  return (
    <div className="space-y-8">
      <ErrorNote message={factsError} />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Sjabloon</span>
            <select className={input} value={template} onChange={(e) => setTemplate(e.target.value as VideoTemplate)}>
              {Object.entries(VIDEO_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-muted">{VIDEO_TEMPLATES[template].about}</p>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Formaat</span>
            <select className={input} value={format} onChange={(e) => setFormat(e.target.value as VideoFormatKey)}>
              {Object.entries(VIDEO_FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
            </select>
          </label>
          {template === "provincie" && (
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Provincie</span>
              <select className={input} value={province} onChange={(e) => setProvince(e.target.value)}>
                {PROVINCES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          )}
          {template === "nieuw" && (
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Functie</span>
              <select className={input} value={feature} onChange={(e) => setFeature(e.target.value as FeatureKey)}>
                {Object.entries(FEATURES).map(([k, f]) => <option key={k} value={k}>{f.title}</option>)}
              </select>
            </label>
          )}
          <button className={`${primary} w-full`} disabled={!facts} onClick={() => order("video")}>Maak MP4</button>
          <p className="text-sm text-muted">
            De GitHub Action maakt het filmpje binnen ongeveer 10 minuten (1080 × {h}, {preview ? Math.round(preview.duration) : "–"} seconden, zonder geluid: voeg muziek toe in Instagram of TikTok).
            {facts && ` Cijfers: stand ${factDate(facts.measured_at)}.`}
          </p>
          <ErrorNote message={err} />
        </div>
        <div>
          {preview ? (
            <div className="overflow-hidden rounded-lg outline outline-1 outline-line" style={{ width: w * scale, height: h * scale }}>
              <iframe
                key={`${template}-${format}`}
                title="Voorbeeld van het filmpje"
                srcDoc={preview.html}
                sandbox="allow-scripts"
                width={w}
                height={h}
                style={{ transform: `scale(${scale})`, transformOrigin: "0 0", border: 0 }}
              />
            </div>
          ) : (
            <Empty>Voorbeeld laden…</Empty>
          )}
        </div>
      </div>

      <Section title="Opdrachten" action={<button className={secondary} onClick={jobs.reload}>Vernieuwen</button>}>
        <ErrorNote message={notLive(jobs.error)} />
        {!jobList.length ? (
          <Empty>Nog geen opdrachten.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-lg bg-surface outline outline-1 outline-line">
            {jobList.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <Badge tone={JOB_TONE[j.status]}>{j.status}</Badge>
                <span className="font-semibold">{j.kind === "video" ? `${VIDEO_TEMPLATES[j.template as VideoTemplate]?.label ?? j.template} · ${j.format}` : "Schermopnames"}</span>
                <span className="text-sm text-muted">{when(j.created_at)}</span>
                {j.error && <span className="w-full text-sm text-alert">{j.error}</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">Klaar? Het bestand staat in Kalender → Bibliotheek.</p>
      </Section>

      <Section title="Schermopnames van de app" action={<button className={secondary} onClick={() => order("schermopnames")}>Nieuwe schermopnames</button>}>
        <p className="text-sm text-muted">
          Telefoonformaat, van de live site, zonder account (Mijn reis toont de lege staat). Elke maandag automatisch, of nu met de knop. Filmpjes met schermen maken bij het renderen altijd verse opnames.
        </p>
        {!shotAssets.length ? <Empty>Nog geen schermopnames.</Empty> : <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{shotAssets.slice(0, SHOTS.length).map((a) => <AssetCard key={a.id} asset={a} />)}</ul>}
      </Section>

      <Section title="Launch-video met /brag">
        <div className="space-y-2 rounded-lg bg-surface p-4 text-ink-2 outline outline-1 outline-line">
          <p>
            Voor een eenmalige, vrijere launch-video (bijvoorbeeld bij een grote nieuwe functie) staat de skill <code>brag-slim</code> van latent-spaces/brag (MIT) in deze repository. Vraag in een
            Claude Code-sessie op deze repository: <q>let&apos;s /brag about VrijStaan</q>. De agent bekijkt de app, schrijft een draaiboek en maakt een filmpje van ongeveer 20 seconden, plus deeltekst.
          </p>
          <p>
            Huisregels voor die video staan in <code>.claude/skills/brag-slim/VRIJSTAAN.md</code>: je-vorm, geen emoji, alleen cijfers uit de feitenbank. Muziek uit /brag (Sascha Ende, CC BY 4.0) mag, met
            vermelding.
          </p>
        </div>
      </Section>
    </div>
  );
}
