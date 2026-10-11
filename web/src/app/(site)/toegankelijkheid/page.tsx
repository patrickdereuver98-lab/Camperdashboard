import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Toegankelijkheid", description: "Hoe VrijStaan bruikbaar is voor iedereen." };

export default function AccessibilityPage() {
  return (
    <ProsePage title="Toegankelijkheid" intro="VrijStaan moet voor iedereen goed te gebruiken zijn, ook onderweg en met kleinere letters op een telefoon." updated="11 oktober 2026">
      <Section title="Wat we doen">
        <ul>
          <li>We volgen de richtlijnen van WCAG 2.2 op niveau AA.</li>
          <li>Goed leesbare tekst in Inter op minimaal 17 pixels, met voldoende contrast in licht en donker.</li>
          <li>Grote knoppen (minimaal 44 bij 44 pixels) en hoog contrast, ook in donkere modus.</li>
          <li>Alles is met het toetsenbord te bedienen; de focus is altijd zichtbaar.</li>
          <li>Animaties staan uit als je apparaat is ingesteld op &quot;minder beweging&quot;.</li>
          <li>Voorzieningen hebben altijd een tekstlabel naast het pictogram.</li>
        </ul>
      </Section>
      <Section title="Bekende beperkingen">
        <p>
          De kaart is lastig te gebruiken met een schermlezer. Alle informatie op de kaart staat daarom ook in de lijst met
          resultaten.
        </p>
      </Section>
      <Section title="Iets niet goed bruikbaar?">
        <p>
          Laat het ons weten via <Link href="/contact">het contactformulier</Link>. We reageren binnen twee werkdagen.
        </p>
      </Section>
    </ProsePage>
  );
}
