"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth";
import { useTripSettings, useVehicle } from "@/lib/store";
import { errorMessage, supabase } from "@/lib/supabase-browser";
import { cleanVehicle, hasVehicle, type Fuel, type Vehicle } from "@/lib/vehicle";
import { Icon } from "@/components/icons";
import { field } from "../contact/contact-form";

const FUELS: { value: Fuel; label: string }[] = [
  { value: "diesel", label: "Diesel" },
  { value: "benzine", label: "Benzine" },
  { value: "lpg", label: "LPG" },
  { value: "elektrisch", label: "Elektrisch" },
];

const dec = (n?: number) => (n === undefined ? "" : String(n).replace(".", ","));

export function VehicleApp() {
  const [vehicle, setVehicle] = useVehicle();
  const [settings, setSettings] = useTripSettings();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Na laden uit de opslag (of na synchronisatie) het formulier opnieuw vullen
  const formKey = JSON.stringify(vehicle);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const raw = Object.fromEntries(f.entries());
    const next = cleanVehicle(raw);
    const bad = ["lengthM", "heightM", "widthM", "weightKg", "consumption"].filter((k) => String(raw[k] ?? "").trim() && !(k in next));
    if (bad.length) {
      setErr("Een of meer maten kloppen niet. Controleer de lengte (3 tot 20 m), hoogte, breedte, gewicht en het verbruik.");
      return;
    }
    setErr(null);
    setVehicle(next);
    if (next.consumption && next.fuel !== "elektrisch") setSettings({ ...settings, litersPer100: next.consumption });
    setSaved(true);
  }

  return (
    <>
      <form key={formKey} onSubmit={save} onChange={() => setSaved(false)} className="mt-8 space-y-4" aria-label="Maten van je camper">
        <label className="block">
          <span className="mb-1.5 block font-semibold">Naam (optioneel)</span>
          <input name="name" maxLength={40} defaultValue={vehicle.name ?? ""} placeholder="Bijvoorbeeld: onze Hymer" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Num name="lengthM" label="Lengte in meter" value={dec(vehicle.lengthM)} placeholder="7,4" />
          <Num name="heightM" label="Hoogte in meter" value={dec(vehicle.heightM)} placeholder="2,9" />
          <Num name="widthM" label="Breedte in meter" value={dec(vehicle.widthM)} placeholder="2,3" />
          <Num name="weightKg" label="Gewicht in kg" value={vehicle.weightKg ? String(vehicle.weightKg) : ""} placeholder="3500" />
        </div>
        <label className="block">
          <span className="mb-1.5 block font-semibold">Brandstof</span>
          <select name="fuel" defaultValue={vehicle.fuel ?? ""} className={field}>
            <option value="">Weet ik niet of zeg ik liever niet</option>
            {FUELS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </select>
        </label>
        <Num name="consumption" label="Verbruik per 100 km (liter of kWh)" value={dec(vehicle.consumption)} placeholder="11" />
        <p className="text-sm text-muted">
          Bij het zoeken gebruiken we de lengte. Hoogte en gewicht staan bij te weinig plekken bekend om op te filteren. Het
          verbruik gebruiken we voor de brandstofkosten in Mijn reis.
        </p>
        {err && <p role="alert" className="rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
        <button type="submit" className="h-14 w-full rounded-xl bg-forest font-display text-lg font-semibold text-on-forest">Bewaren</button>
        {saved && (
          <p role="status" className="flex items-center gap-2 font-semibold text-forest">
            <Icon name="check" size={20} /> Bewaard. {vehicle.lengthM ? `Bij het zoeken zie je nu plekken voor ${dec(vehicle.lengthM)} meter.` : ""}
          </p>
        )}
      </form>
      {hasVehicle(vehicle) && (
        <button type="button" onClick={() => setVehicle({})} className="mt-4 font-semibold text-ink-2 underline">
          Gegevens van mijn camper wissen
        </button>
      )}
      <Documents />
    </>
  );
}

function Num({ name, label, value, placeholder }: { name: keyof Vehicle; label: string; value: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-semibold">{label}</span>
      <input name={name} inputMode="decimal" defaultValue={value} placeholder={placeholder} autoComplete="off" className={field} />
    </label>
  );
}

type Doc = { name: string; size: number; created_at: string };

/** Privé-map voor papieren van de camper (alleen met account, alleen jij kunt erbij) */
function Documents() {
  const { session, loading } = useSession();
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uid = session?.user.id;

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void supabase()
      .storage.from("vehicle-docs")
      .list(uid, { sortBy: { column: "created_at", order: "desc" } })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setErr(errorMessage(error));
        else setDocs((data ?? []).filter((d) => d.id).map((d) => ({ name: d.name, size: Number(d.metadata?.size ?? 0), created_at: d.created_at ?? "" })));
      });
    return () => {
      alive = false;
    };
  }, [uid, version]);

  async function upload(file: File | undefined) {
    if (!file || !uid) return;
    setErr(null);
    if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(file.type)) return setErr("Kies een PDF of een foto (JPG, PNG of WebP).");
    if (file.size > 5 * 1024 * 1024) return setErr("Dit bestand is groter dan 5 MB.");
    setBusy(true);
    const safe = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "document";
    const { error } = await supabase().storage.from("vehicle-docs").upload(`${uid}/${Date.now()}-${safe}`, file, { contentType: file.type, upsert: false });
    setBusy(false);
    if (error) return setErr(errorMessage(error));
    reload();
  }

  async function open(name: string) {
    const { data, error } = await supabase().storage.from("vehicle-docs").createSignedUrl(`${uid}/${name}`, 60);
    if (error || !data) return setErr(errorMessage(error));
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(name: string) {
    if (!confirm("Dit document definitief weghalen?")) return;
    const { error } = await supabase().storage.from("vehicle-docs").remove([`${uid}/${name}`]);
    if (error) return setErr(errorMessage(error));
    reload();
  }

  return (
    <section aria-labelledby="papieren" className="mt-12 border-t border-line pt-8">
      <h2 id="papieren" className="font-display text-2xl font-semibold">Papieren</h2>
      <p className="mt-2 text-ink-2">
        Bewaar hier bijvoorbeeld je kentekenbewijs, verzekering of ANWB-pas als PDF of foto. Alleen jij kunt ze zien.
      </p>
      {loading ? null : !session ? (
        <Link href="/inloggen?next=/mijn-camper" className="mt-4 inline-flex h-12 items-center rounded-xl bg-forest px-5 font-semibold text-on-forest">
          Log in om papieren te bewaren
        </Link>
      ) : (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => input.current?.click()}
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold hover:border-forest disabled:opacity-60"
          >
            <Icon name="plus" size={18} /> {busy ? "Uploaden…" : "Document toevoegen"}
          </button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Document kiezen"
            data-testid="doc-input"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {docs && docs.length === 0 && <p className="mt-4 text-muted">Nog geen papieren bewaard.</p>}
          {docs && docs.length > 0 && (
            <ul className="mt-4 divide-y divide-line rounded-2xl bg-surface shadow-low">
              {docs.map((d) => (
                <li key={d.name} className="flex items-center gap-3 p-3">
                  <button type="button" onClick={() => open(d.name)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold underline">{d.name.replace(/^\d+-/, "")}</span>
                    <span className="text-sm text-muted">{Math.max(1, Math.round(d.size / 1024))} kB</span>
                  </button>
                  <button type="button" onClick={() => remove(d.name)} aria-label={`${d.name.replace(/^\d+-/, "")} weghalen`} className="grid h-11 w-11 place-items-center rounded-xl text-ink-2 hover:bg-sunken">
                    <Icon name="trash" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {err && <p role="alert" className="mt-3 rounded-lg bg-alert-tint px-3 py-2 text-alert">{err}</p>}
    </section>
  );
}
