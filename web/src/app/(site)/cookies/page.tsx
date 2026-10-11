import type { Metadata } from "next";
import { ProsePage, Section } from "@/components/prose";
import { CookieSettingsLink } from "@/components/cookie-banner";

export const metadata: Metadata = { title: "Cookiebeleid", description: "Welke cookies en lokale opslag VrijStaan gebruikt." };

const ROWS = [
  ["vrijstaan:toestemming", "Noodzakelijk", "Onthoudt je cookiekeuze", "Tot je hem wijzigt"],
  ["vrijstaan:reis", "Noodzakelijk", "Je bewaarde plekken en nachten (Mijn reis)", "Tot je hem wist"],
  ["vrijstaan:reisinstellingen", "Noodzakelijk", "Verbruik, brandstofprijs en personen voor de kostenberekening", "Tot je hem wist"],
  ["vrijstaan-auth", "Noodzakelijk", "Inlogsessie, alleen voor beheerders", "Tot uitloggen"],
  ["vrijstaan:sessie", "Statistiek (toestemming)", "Willekeurig nummer om paginaweergaven binnen één bezoek te tellen", "Tot je de browser sluit"],
];

export default function CookiePage() {
  return (
    <ProsePage
      title="Cookiebeleid"
      intro="VrijStaan gebruikt geen advertentie- of trackingcookies van derden. Alles wat we opslaan staat hieronder."
      updated="11 oktober 2026"
    >
      <Section title="Wat we opslaan">
        <div className="overflow-x-auto rounded-xl outline-1 outline-line outline">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-sunken">
              <tr>
                {["Naam", "Soort", "Doel", "Bewaartermijn"].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold text-ink">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ROWS.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className={`px-3 py-2 ${i === 0 ? "font-mono text-xs" : ""}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>Dit zijn geen klassieke cookies maar lokale opslag in je browser. De regels zijn hetzelfde, dus we vragen toestemming waar dat nodig is.</p>
      </Section>
      <Section title="Externe diensten">
        <p>
          De kaart laadt tegels van OpenFreeMap en foto&apos;s komen van de websites van de plekken. Deze diensten plaatsen bij
          ons weten geen cookies, maar zien technisch wel je IP-adres.
        </p>
      </Section>
      <Section title="Je keuze wijzigen">
        <p>Je kunt je keuze altijd aanpassen.</p>
        <CookieSettingsLink className="!font-semibold !text-road underline" />
      </Section>
    </ProsePage>
  );
}
