import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { getStats } from "@/lib/places";

export const metadata: Metadata = { title: "Over VrijStaan", description: "Waarom VrijStaan bestaat en hoe we zorgen dat de informatie klopt." };

export default async function AboutPage() {
  const stats = await getStats();
  return (
    <ProsePage title="Over VrijStaan" intro="Een onafhankelijke gids voor camperplaatsen in Nederland, gemaakt voor onderweg.">
      <Section title="Waarom">
        <p>
          Wie met de camper door Nederland reist, wil snel weten waar je kunt staan, wat het kost en of je er stroom, water
          en een loosplaats hebt. Die informatie staat verspreid over honderden websites en is vaak verouderd. VrijStaan
          brengt het samen op één plek, met een kaart, filters en echte rijtijden.
        </p>
      </Section>
      <Section title="Alleen complete plekken">
        <p>
          We tonen op dit moment {stats.total.toLocaleString("nl-NL")} plekken. Een plek komt pas online als we een website of
          telefoonnummer hebben, minstens twee van de vier beslisfeiten kennen (vertrektijd, openingsperiode, stroom en prijs)
          en genoeg weten van wat camperaars willen weten. Of je kunt vertrekken wanneer je wilt, telt het zwaarst. Wat we niet
          zeker weten, laten we leeg. We vullen nooit iets in op basis van een aanname.
        </p>
      </Section>
      <Section title="Waar de gegevens vandaan komen">
        <ul>
          <li>OpenStreetMap, de open kaart die door vrijwilligers wordt bijgehouden (ODbL-licentie).</li>
          <li>De website van de plek zelf. We lezen openbare informatie en respecteren robots.txt.</li>
          <li>Meldingen en reviews van camperaars en eigenaren, die we eerst controleren.</li>
        </ul>
        <p>Bij elke plek staat waar de gegevens vandaan komen en wanneer ze voor het laatst zijn opgehaald.</p>
      </Section>
      <Section title="Onafhankelijk">
        <p>
          VrijStaan neemt geen boekingen aan en rekent geen commissie. Plekken kunnen geen hogere positie kopen. De volgorde
          van zoekresultaten hangt af van hoe compleet de informatie is, de reviews en de afstand.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          Vragen, tips of een fout gezien? <Link href="/contact">Neem contact op</Link> of kijk bij de{" "}
          <Link href="/veelgestelde-vragen">veelgestelde vragen</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
