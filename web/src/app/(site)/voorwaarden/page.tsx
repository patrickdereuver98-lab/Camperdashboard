import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Gebruiksvoorwaarden", description: "De voorwaarden voor het gebruik van VrijStaan." };

export default function TermsPage() {
  return (
    <ProsePage title="Gebruiksvoorwaarden" intro="Kort en duidelijk: wat je van VrijStaan mag verwachten en wat wij van jou vragen." updated="11 oktober 2026">
      <Section title="1. De dienst">
        <p>
          VrijStaan is een gratis gids voor camperplaatsen. We bemiddelen niet bij boekingen. Een overeenkomst over een
          overnachting sluit je altijd rechtstreeks met de eigenaar van de plek.
        </p>
      </Section>
      <Section title="2. Juistheid van informatie">
        <p>
          We doen ons best om alleen juiste en actuele informatie te tonen, maar prijzen, openingstijden en voorzieningen
          kunnen veranderen. Controleer belangrijke zaken altijd bij de plek zelf. Zie ook de <Link href="/disclaimer">disclaimer</Link>.
        </p>
      </Section>
      <Section title="3. Reviews en meldingen">
        <ul>
          <li>Schrijf alleen over plekken waar je zelf bent geweest, eerlijk en zonder beledigingen.</li>
          <li>Geen reclame, persoonsgegevens van anderen of auteursrechtelijk beschermd materiaal.</li>
          <li>We mogen reviews weigeren of verwijderen die niet aan deze regels voldoen.</li>
          <li>Door een review te plaatsen geef je ons het recht hem op VrijStaan te tonen.</li>
        </ul>
      </Section>
      <Section title="4. Gebruik van de site">
        <p>
          Je mag VrijStaan gebruiken voor persoonlijk, niet-commercieel gebruik. Het is niet toegestaan de site
          geautomatiseerd uit te lezen of de dienst te verstoren. Kaartgegevens zijn afkomstig van OpenStreetMap
          (© OpenStreetMap-bijdragers, ODbL).
        </p>
      </Section>
      <Section title="5. Eigenaren van plekken">
        <p>
          Ben je eigenaar en wil je gegevens aanpassen of je plek laten verwijderen? Gebruik{" "}
          <Link href="/plek-aanmelden?soort=eigenaar">het formulier voor eigenaren</Link>. We verwerken dit meestal binnen
          twee werkdagen.
        </p>
      </Section>
      <Section title="6. Aansprakelijkheid">
        <p>
          VrijStaan is niet aansprakelijk voor schade die ontstaat door het gebruik van informatie op de site, behalve bij
          opzet of grove nalatigheid. Op deze voorwaarden is Nederlands recht van toepassing.
        </p>
      </Section>
    </ProsePage>
  );
}
