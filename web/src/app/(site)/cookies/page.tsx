import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { CookieSettingsLink } from "@/components/cookie-banner";

export const metadata: Metadata = { title: "Cookiebeleid", description: "Welke lokale opslag VrijStaan gebruikt, waarvoor en hoe lang." };

const ROWS = [
  ["vrijstaan:toestemming", "Noodzakelijk", "Je keuze over statistieken, met een willekeurig id, de versie van de melding en het tijdstip", "Tot je hem wijzigt of je browsergegevens wist"],
  ["vrijstaan:reis", "Noodzakelijk", "De plekken die je bewaart en het aantal nachten (Mijn reis)", "Tot je hem wist"],
  ["vrijstaan:reis-plekken", "Noodzakelijk", "Een kopie van de gegevens van je bewaarde plekken, zodat Mijn reis ook zonder bereik werkt", "Tot je je reis wist"],
  ["vrijstaan:reisinstellingen", "Noodzakelijk", "Verbruik, brandstofprijs, personen en toeristenbelasting voor de kostenberekening", "Tot je hem wist"],
  ["vrijstaan-auth", "Noodzakelijk, alleen beheerders", "Inlogsessie van Supabase voor de beheeromgeving. Komt er alleen als een beheerder inlogt", "Tot uitloggen"],
  ["vrijstaan:sessie", "Statistiek, alleen met toestemming", "Willekeurig nummer om paginaweergaven binnen één bezoek te tellen (sessieopslag)", "Tot je het tabblad sluit"],
];

export default function CookiePage() {
  return (
    <ProsePage
      title="Cookiebeleid"
      intro="VrijStaan plaatst geen cookies bij bezoekers en gebruikt geen diensten voor advertenties of tracking. We slaan wel een paar dingen op in je browser. Die staan hieronder."
      updated="11 oktober 2026"
    >
      <Section title="Wat we opslaan in je browser">
        {/* Mobiel: kaartjes; vanaf sm een tabel */}
        <ul className="space-y-2 sm:hidden">
          {ROWS.map((r) => (
            <li key={r[0]} className="!ml-0 !list-none rounded-lg bg-surface p-3 outline-1 outline-line outline">
              <p className="font-mono text-sm break-all text-ink">{r[0]}</p>
              <dl className="mt-1 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-0.5 text-sm">
                <dt className="text-muted">Soort</dt>
                <dd>{r[1]}</dd>
                <dt className="text-muted">Doel</dt>
                <dd>{r[2]}</dd>
                <dt className="text-muted">Bewaartermijn</dt>
                <dd>{r[3]}</dd>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-hidden rounded-lg outline-1 outline-line outline sm:block">
          <table className="w-full text-left text-sm">
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
                    <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-mono text-sm" : ""}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Dit zijn geen cookies, maar lokale opslag (localStorage) en sessieopslag (sessionStorage) in je browser. Voor de wet
          is dat hetzelfde als cookies. Wat hier noodzakelijk heet, is nodig voor iets waar je zelf om vraagt. Het sessienummer
          voor statistieken maken we pas aan als je daar toestemming voor geeft.
        </p>
        <p>
          De noodzakelijke opslag blijft op je apparaat. We sturen hem niet naar onze server, behalve je cookiekeuze als bewijs.
        </p>
      </Section>

      <Section title="Offline gebruik">
        <p>
          De site gebruikt een service worker. Die bewaart pagina&apos;s die je hebt bekeken, de gegevens van plekken en
          kaarttegels op je apparaat. Zo werkt VrijStaan ook als je even geen bereik hebt. Dit staat alleen op je eigen
          apparaat. Je wist het door de sitegegevens van vrijstaan.nl in je browser te verwijderen.
        </p>
      </Section>

      <Section title="Statistieken">
        <p>
          Met je toestemming tellen we in onze eigen database welke pagina&apos;s, zoekopdrachten en plekken worden bekeken. We
          slaan daarbij geen IP-adres op, gebruiken geen cookies en delen niets met anderen. We bewaren deze gegevens 13 maanden.
        </p>
        <p>
          Volgens art. 11.7a Telecommunicatiewet mag statistiek met weinig gevolgen voor je privacy soms zonder toestemming. We
          vragen het toch. Je keuze leggen we vast als bewijs, met een willekeurig id, je keuze, de versie van de melding en het
          tijdstip. Dat bewaren we 24 maanden. Meer hierover lees je in de <Link href="/privacy">privacyverklaring</Link>.
        </p>
      </Section>

      <Section title="Externe diensten">
        <p>
          De kaart laadt tegels van OpenFreeMap. Foto&apos;s komen van Wikimedia Commons, uit onze eigen opslag of van de
          website van de plek, meestal verkleind via de beelddienst wsrv.nl. Die servers zien je IP-adres, omdat je browser daar iets ophaalt. Voor zover wij weten plaatsen
          ze geen cookies. De lettertypes staan op onze eigen server. De knop &quot;Open in navigatie&quot; opent Google Maps.
          Daar gelden de regels van Google.
        </p>
      </Section>

      <Section title="Je keuze wijzigen">
        <p>
          Je wijzigt je keuze net zo makkelijk als je hem gaf: via &quot;Cookie-instellingen&quot; onderaan elke pagina, of
          hieronder.
        </p>
        <CookieSettingsLink className="!font-semibold !text-forest underline" />
      </Section>
    </ProsePage>
  );
}
