"use client";

import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/supabase-browser";
import { Card, ErrorNote, PageTitle, db, input, primary, secondary, textarea, useQuery } from "../ui";

type Settings = {
  contact: { email: string; response_days: number };
  announcement: { text: string; enabled: boolean };
  publish_threshold: number;
  website_photos: boolean;
};

export default function SettingsPage() {
  const { data, error, reload } = useQuery(() => db().from("site_settings").select("key,value"), []);
  const loaded = useMemo<Settings | null>(() => {
    if (!data) return null;
    const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
    return {
      contact: (map.contact as Settings["contact"]) ?? { email: "", response_days: 2 },
      announcement: (map.announcement as Settings["announcement"]) ?? { text: "", enabled: false },
      publish_threshold: Number(map.publish_threshold ?? 0.7),
      website_photos: map.website_photos !== false,
    };
  }, [data]);
  const [edited, setS] = useState<Settings | null>(null);
  const s = edited ?? loaded;
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!s) return;
    setErr(null);
    setMsg(null);
    const rows = Object.entries(s).map(([key, value]) => ({ key, value }));
    const { error } = await db().from("site_settings").upsert(rows);
    if (error) return setErr(errorMessage(error));
    setMsg("Opgeslagen.");
    setS(null);
    reload();
  }

  async function action(name: string, confirmText: string) {
    if (!confirm(confirmText)) return;
    setErr(null);
    const { data, error } = await db().rpc("admin_pipeline", { p_action: name });
    if (error) return setErr(errorMessage(error));
    setMsg(name === "apply-threshold" ? `${data} plekken van status gewisseld.` : "Gestart. Voortgang zie je op het overzicht.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle title="Instellingen" />
      <ErrorNote message={error ?? err} />
      {msg && <p role="status" className="rounded-lg bg-forest-tint px-4 py-3 font-semibold text-forest">{msg}</p>}
      {s && (
        <form onSubmit={save} className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Contact</h2>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">E-mailadres op de site</span>
              <input type="email" className={input} value={s.contact.email} onChange={(e) => setS({ ...s, contact: { ...s.contact, email: e.target.value } })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Reactietermijn (werkdagen)</span>
              <input type="number" min={1} max={14} className={input} value={s.contact.response_days} onChange={(e) => setS({ ...s, contact: { ...s.contact, response_days: Number(e.target.value) } })} />
            </label>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Mededeling bovenaan de site</h2>
            <textarea rows={2} maxLength={200} className={textarea} value={s.announcement.text} onChange={(e) => setS({ ...s, announcement: { ...s.announcement, text: e.target.value } })} />
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-[var(--forest)]" checked={s.announcement.enabled} onChange={(e) => setS({ ...s, announcement: { ...s.announcement, enabled: e.target.checked } })} />
              Tonen
            </label>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Wanneer staat een plek online</h2>
            <p className="text-sm text-muted">
              Een plek gaat vanzelf online als er een contact is (website, telefoon, e-mail of beheerder) en minstens twee
              punten uit vertrekregel (telt dubbel), openingsperiode, stroom en prijs. Met een vertrekregel staat hij er
              gewoon; zonder vertrekregel staat hij er grijs, met de vraag om de vertrektijd door te geven, en zoekmachines
              slaan hem over tot de vertrektijd bekend is. De score telt alleen nog voor de volgorde in de lijst. Plekken
              die je handmatig hebt vastgezet blijven zoals ze zijn.
            </p>
            <p className="text-sm text-muted">Na een wijziging in de regels: klik op &quot;Regels opnieuw toepassen&quot; hieronder.</p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Foto&apos;s van websites</h2>
            <p className="text-sm text-muted">
              Aan (standaard): foto&apos;s van de website van de plek worden getoond, met bronvermelding. Ze zijn
              auteursrechtelijk beschermd; vraagt een rechthebbende om verwijdering (via Meld inhoud), haal de foto dan weg bij
              de plek. Uit: alleen Wikimedia Commons, uploads van bezoekers en eigenaren, en foto&apos;s die je per plek als
              &quot;toestemming&quot; hebt gemarkeerd.
            </p>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-[var(--forest)]" checked={s.website_photos} onChange={(e) => setS({ ...s, website_photos: e.target.checked })} />
              Websitefoto&apos;s tonen
            </label>
          </Card>
          <button className={`${primary} h-12 w-full`}>Instellingen opslaan</button>
        </form>
      )}
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Data-pipeline</h2>
        <p className="text-sm text-muted">
          De pipeline draait automatisch: OpenStreetMap wordt per provincie wekelijks ververst, nieuwe websites worden elk half uur ingepland en continu gelezen. Gebruik deze knoppen alleen als je niet wilt wachten.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className={secondary} onClick={() => action("apply-threshold", "De regels opnieuw op alle plekken toepassen?")}>Regels opnieuw toepassen</button>
          <button className={secondary} onClick={() => action("scrape-missing", "Websites van nieuwe plekken inplannen?")}>Nieuwe websites lezen</button>
          <button className={secondary} onClick={() => action("scrape-all", "Alle websites opnieuw lezen? Dit duurt enkele uren.")}>Alle websites opnieuw lezen</button>
          <button className={secondary} onClick={() => action("osm-refresh", "Alle provincies opnieuw uit OpenStreetMap halen?")}>OpenStreetMap verversen</button>
        </div>
      </Card>
    </div>
  );
}
