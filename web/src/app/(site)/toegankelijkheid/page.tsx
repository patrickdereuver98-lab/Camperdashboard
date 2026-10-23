import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Toegankelijkheid", description: "Hoe VrijStaan bruikbaar is voor iedereen." };

export default function AccessibilityPage() {
  return (
    <ProsePage title="Toegankelijkheid" intro="VrijStaan moet voor iedereen goed werken, ook onderweg op een telefoon." updated="22 oktober 2026">
      <Section title="Wat we doen">
        <ul>
          <li>
            We houden ons aan de richtlijnen van WCAG 2.1 op niveau AA. Bij elke wijziging controleert een automatische
            test de belangrijkste pagina&apos;s in licht en donker. Een onafhankelijke keuring hebben we nog niet laten doen.
          </li>
          <li>
            Tekst is op een telefoon 16 pixels groot en op een tablet of computer 17 pixels. Kleine tekst, zoals een
            toelichting of een fotobron, is 14 pixels. Kleiner wordt het nergens, op één uitzondering na (zie hieronder).
          </li>
          <li>Tekst heeft genoeg contrast, in licht en in donker.</li>
          <li>
            Alles wat je kunt aantikken is minstens 44 bij 44 pixels: knoppen, velden, filterknoppen, links in lijsten en de
            punten op de kaart. Rond een punt op de kaart ligt een onzichtbaar tikvlak, zodat een tik net ernaast ook telt.
          </li>
          <li>
            Je kunt alles met het toetsenbord bedienen en je ziet altijd een groene rand om waar je bent. In een venster
            dat omhoog schuift, blijf je met Tab binnen dat venster. Escape sluit het en brengt je terug waar je was.
          </li>
          <li>Elk invulveld heeft een label, en knoppen met alleen een icoontje hebben een naam voor schermlezers.</li>
          <li>Staat je apparaat op &quot;minder beweging&quot;, dan staan de animaties uit.</li>
          <li>Bij elk icoontje van een voorziening staat ook tekst.</li>
        </ul>
      </Section>
      <Section title="Bekende beperkingen">
        <ul>
          <li>
            De kaart werk je met de muis of je vinger. Met een schermlezer of alleen het toetsenbord kun je de punten niet
            kiezen. Alles wat op de kaart staat, vind je daarom ook in de lijst met resultaten.
          </li>
          <li>De bronvermelding op de kaart (© OpenStreetMap) is 12 pixels. Dezelfde vermelding staat groter onderaan elke pagina.</li>
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
