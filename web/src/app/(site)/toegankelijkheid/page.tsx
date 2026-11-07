import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Toegankelijkheid", description: "Hoe VrijStaan bruikbaar is voor iedereen.", alternates: { canonical: "/toegankelijkheid" } };

export default function AccessibilityPage() {
  return (
    <ProsePage title="Toegankelijkheid" intro="VrijStaan moet voor iedereen goed werken, ook onderweg op een telefoon." updated="7 november 2026">
      <Section title="Wat we doen">
        <ul>
          <li>
            We bouwen volgens de richtlijnen van WCAG 2.1 op niveau AA. Bij elke wijziging controleert een automatische
            test de belangrijkste pagina&apos;s in licht en donker. Zo&apos;n test vindt niet alles, en een onafhankelijke
            keuring hebben we nog niet laten doen. We zeggen dus niet dat alles al voldoet.
          </li>
          <li>
            Tekst is op een telefoon 16 pixels groot en op een tablet of computer 17 pixels. Kleine tekst, zoals een
            toelichting of een fotobron, is 14 pixels. Kleiner wordt het nergens, op één uitzondering na (zie hieronder).
          </li>
          <li>
            Tekst heeft genoeg contrast, in licht en in donker. De rand van een invulveld is donker genoeg om het veld te
            zien.
          </li>
          <li>
            De site past op een smal scherm vanaf 320 pixels, zonder dat je zijwaarts hoeft te schuiven. Een test controleert
            dat op 320, 360, 390 en 820 pixels breed.
          </li>
          <li>
            Alles wat je kunt aantikken is minstens 44 bij 44 pixels: knoppen, velden, filterknoppen, links in lijsten en de
            punten op de kaart. Rond een punt op de kaart ligt een onzichtbaar tikvlak, zodat een tik net ernaast ook telt.
          </li>
          <li>
            Met het toetsenbord kun je alles bedienen behalve de punten op de kaart (zie hieronder). Je ziet een groene rand
            om waar je bent, en die valt niet weg achter de kop of de balk onderaan. In een venster dat omhoog schuift,
            blijf je met Tab binnen dat venster. Escape sluit het en brengt je terug waar je was.
          </li>
          <li>Elk invulveld heeft een label, en knoppen met alleen een icoontje hebben een naam voor schermlezers.</li>
          <li>Bij een keuze uit een paar rondjes, zoals een cijfer of de vertrektijd, kies je met de pijltjestoetsen.</li>
          <li>
            Klopt er iets niet in wat je invult, dan staat de melding bij het formulier en weet een schermlezer bij welk veld
            die hoort. Na het versturen gaat de focus naar de bevestiging, zodat je die hoort.
          </li>
          <li>Bij zoeken leest een schermlezer alleen het aantal plekken voor als dat verandert, niet de hele lijst.</li>
          <li>De vraag over cookies komt met Tab direct na de kop. Nee zeggen is even makkelijk als ja.</li>
          <li>De knoppen op de kaart, zoals inzoomen en uitzoomen, hebben een Nederlandse naam.</li>
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
          <li>
            Gaat het versturen mis door een storing of een verbroken verbinding, dan staat die melding onder het formulier en
            niet bij één veld.
          </li>
          <li>De beheeromgeving, die alleen ons team gebruikt, testen we minder grondig dan de rest van de site.</li>
        </ul>
      </Section>
      <Section title="Werkt iets niet goed voor je">
        <p>
          Laat het ons weten via <Link href="/contact">het contactformulier</Link>. We reageren meestal binnen twee werkdagen.
        </p>
      </Section>
    </ProsePage>
  );
}
