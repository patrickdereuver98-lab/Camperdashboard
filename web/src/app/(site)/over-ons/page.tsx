import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { getStats } from "@/lib/places";

export const metadata: Metadata = { title: "Over VrijStaan", description: "Waarom VrijStaan bestaat en wanneer een plek bij ons online komt." };

export default async function AboutPage() {
  const stats = await getStats();
  return (
    <ProsePage title="Over VrijStaan" intro="Een onafhankelijke gids voor camperplaatsen in Nederland, gemaakt voor onderweg.">
      <Section title="Waarom">
        <p>
          Reis je met de camper door Nederland, dan wil je snel weten waar je kunt staan, hoe laat je weer weg moet, wat het
          kost en of er stroom, water en een loosplaats is. Die informatie staat verspreid over honderden websites en is vaak
          verouderd. Op VrijStaan staat het bij elkaar, met een kaart, filters en echte rijtijden.
        </p>
      </Section>
      <Section title="Wanneer een plek online komt">
        <p>
          Er staan nu {stats.total.toLocaleString("nl-NL")} plekken op VrijStaan. Een plek komt pas online als we een website of
          telefoonnummer hebben. Van de vertrektijd, de openingsperiode, stroom en de prijs moeten we er minstens twee kennen.
          En we moeten genoeg weten van wat camperaars willen weten. De vertrektijd telt daarbij het zwaarst. Wat we niet zeker
          weten, laten we leeg. We gokken nooit.
        </p>
      </Section>
      <Section title="Waar de gegevens vandaan komen">
        <ul>
          <li>OpenStreetMap, de open kaart die vrijwilligers bijhouden (ODbL-licentie).</li>
          <li>De website van de plek zelf. We lezen alleen wat openbaar is en houden ons aan robots.txt.</li>
          <li>Meldingen en reviews van camperaars en eigenaren. Die controleren we eerst.</li>
        </ul>
        <p>Bovenaan elke plek staat wanneer we de gegevens voor het laatst hebben bijgewerkt.</p>
      </Section>
      <Section title="Onafhankelijk">
        <p>
          VrijStaan neemt geen boekingen aan en rekent geen commissie. Een plek kan geen hogere positie kopen. De volgorde van
          de zoekresultaten hangt af van hoe compleet de gegevens zijn, de reviews, de vertrektijd, of er een foto is en de
          afstand. Hoe dat precies werkt, lees je op <Link href="/reviews-en-ranking">Reviews en ranking</Link>.
        </p>
      </Section>
      <Section title="Contact">
        <p>
          Heb je een vraag of een tip, of zie je een fout, <Link href="/contact">neem dan contact op</Link>. Veel antwoorden
          staan al bij de <Link href="/veelgestelde-vragen">veelgestelde vragen</Link>.
        </p>
      </Section>
    </ProsePage>
  );
}
