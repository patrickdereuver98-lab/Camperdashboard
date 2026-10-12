import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Toegankelijkheid", description: "Hoe VrijStaan bruikbaar is voor iedereen." };

export default function AccessibilityPage() {
  return (
    <ProsePage title="Toegankelijkheid" intro="VrijStaan moet voor iedereen goed werken, ook onderweg op een telefoon." updated="11 oktober 2026">
      <Section title="Wat we doen">
        <ul>
          <li>We volgen de richtlijnen van WCAG 2.2 op niveau AA.</li>
          <li>De tekst staat in Inter, minstens 17 pixels groot, met genoeg contrast in licht en donker.</li>
          <li>Knoppen zijn groot, minstens 44 bij 44 pixels, en hebben ook in de donkere modus genoeg contrast.</li>
          <li>Je kunt alles met het toetsenbord bedienen. Je ziet altijd waar je bent.</li>
          <li>Staat je apparaat op &quot;minder beweging&quot;, dan staan de animaties uit.</li>
          <li>Bij elk icoontje van een voorziening staat ook tekst.</li>
        </ul>
      </Section>
      <Section title="Bekende beperkingen">
        <p>
          De kaart is lastig te gebruiken met een schermlezer. Alles wat op de kaart staat, vind je daarom ook in de lijst met
          resultaten.
        </p>
      </Section>
      <Section title="Werkt iets niet goed voor je">
        <p>
          Laat het ons weten via <Link href="/contact">het contactformulier</Link>. We reageren binnen twee werkdagen.
        </p>
      </Section>
    </ProsePage>
  );
}
