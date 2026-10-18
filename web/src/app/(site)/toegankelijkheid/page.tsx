import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Toegankelijkheid", description: "Hoe VrijStaan bruikbaar is voor iedereen." };

export default function AccessibilityPage() {
  return (
    <ProsePage title="Toegankelijkheid" intro="VrijStaan moet voor iedereen goed werken, ook onderweg op een telefoon." updated="16 oktober 2026">
      <Section title="Wat we doen">
        <ul>
          <li>We werken toe naar de richtlijnen van WCAG 2.1 op niveau AA. We hebben de site nog niet laten keuren.</li>
          <li>Tekst is op een telefoon 16 pixels groot en op een tablet of computer 17 pixels, met genoeg contrast in licht en donker.</li>
          <li>Knoppen en velden zijn minstens 44 pixels hoog.</li>
          <li>Je kunt alles met het toetsenbord bedienen. Je ziet altijd waar je bent.</li>
          <li>Staat je apparaat op &quot;minder beweging&quot;, dan staan de animaties uit.</li>
          <li>Bij elk icoontje van een voorziening staat ook tekst.</li>
        </ul>
      </Section>
      <Section title="Bekende beperkingen">
        <ul>
          <li>
            De kaart is lastig te gebruiken met een schermlezer, en de punten op de kaart zijn kleiner dan 44 pixels. Alles
            wat op de kaart staat, vind je daarom ook in de lijst met resultaten.
          </li>
          <li>De bronvermelding bij een foto is kleiner dan de rest van de tekst.</li>
        </ul>
      </Section>
      <Section title="Werkt iets niet goed voor je">
        <p>
          Laat het ons weten via <Link href="/contact">het contactformulier</Link>. We reageren binnen twee werkdagen.
        </p>
      </Section>
    </ProsePage>
  );
}
