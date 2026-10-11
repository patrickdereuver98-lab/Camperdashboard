import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Privacyverklaring", description: "Welke gegevens VrijStaan verwerkt, waarom en hoe lang." };

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacyverklaring"
      intro="We verwerken zo weinig persoonsgegevens als mogelijk. Hier lees je precies welke, waarom en hoe lang."
      updated="11 oktober 2026"
    >
      <Section title="Wie zijn wij">
        <p>
          VrijStaan is verwerkingsverantwoordelijke voor de gegevens op deze site. Vragen over privacy stel je via{" "}
          <Link href="/contact?onderwerp=privacy">het contactformulier</Link> (kies &quot;Privacy&quot;).
        </p>
      </Section>
      <Section title="Wat we verwerken en waarom">
        <ul>
          <li>
            <strong>Je bewaarde reis en instellingen</strong> staan alleen op je eigen apparaat (localStorage). Wij kunnen ze niet
            zien.
          </li>
          <li>
            <strong>Je locatie</strong> gebruiken we alleen als je daar zelf op tikt, om afstanden te berekenen. Voor een
            route sturen we coördinaten naar onze server, die ze doorgeeft aan de routeplanner (OpenRouteService of de
            OSRM-server van FOSSGIS). We slaan je locatie niet op.
          </li>
          <li>
            <strong>Contactberichten</strong>: je naam, e-mailadres en bericht, om je vraag te beantwoorden (grondslag:
            gerechtvaardigd belang en uitvoering van je verzoek).
          </li>
          <li>
            <strong>Reviews en meldingen</strong>: de naam die je opgeeft, je review en optioneel je e-mailadres. Je naam en
            review zijn openbaar zichtbaar na goedkeuring. Je e-mailadres nooit.
          </li>
          <li>
            <strong>Anonieme statistieken</strong>, alleen met je toestemming: welke pagina&apos;s en zoekopdrachten worden
            gebruikt, met een willekeurig sessienummer. Geen IP-adres, geen cookies van derden, geen profilering.
          </li>
          <li>
            <strong>Bewijs van cookietoestemming</strong>: een willekeurig id, je keuze en het tijdstip (wettelijke
            verplichting).
          </li>
        </ul>
      </Section>
      <Section title="Hoe lang we het bewaren">
        <ul>
          <li>Contactberichten: tot 12 maanden na afhandeling.</li>
          <li>Reviews: zolang de review online staat; afgewezen reviews 3 maanden.</li>
          <li>Anonieme statistieken en technische logs: 180 dagen.</li>
          <li>Bewijs van toestemming: 2 jaar.</li>
        </ul>
      </Section>
      <Section title="Met wie we gegevens delen">
        <p>
          We verkopen niets. De database draait bij Supabase in Frankfurt (EU). Kaarttegels komen van OpenFreeMap, routes
          van OpenRouteService of FOSSGIS. Foto&apos;s van plekken worden rechtstreeks van de website van de plek geladen.
          Deze partijen zien bij het laden technisch je IP-adres.
        </p>
      </Section>
      <Section title="Jouw rechten">
        <p>
          Je mag je gegevens inzien, laten aanpassen of verwijderen, bezwaar maken en een klacht indienen bij de Autoriteit
          Persoonsgegevens. Stuur je verzoek via <Link href="/contact?onderwerp=privacy">het contactformulier</Link>; we
          reageren binnen 30 dagen.
        </p>
      </Section>
      <Section title="Beveiliging">
        <p>
          Alle verbindingen zijn versleuteld. De database is afgeschermd met rijniveau-beveiliging: bezoekers kunnen alleen
          gepubliceerde informatie lezen. Alleen beheerders met een eigen account kunnen berichten en meldingen inzien.
        </p>
      </Section>
    </ProsePage>
  );
}
