import type { Metadata } from "next";
import { ProsePage, Section } from "@/components/prose";

export const metadata: Metadata = { title: "Disclaimer", description: "Over de juistheid van de informatie op VrijStaan." };

export default function DisclaimerPage() {
  return (
    <ProsePage title="Disclaimer" updated="11 oktober 2026">
      <Section title="Informatie">
        <p>
          De gegevens op VrijStaan komen uit OpenStreetMap, van de websites van de plekken en van gebruikers. We controleren
          ze zo goed mogelijk en tonen alleen plekken waarvan minstens 80% van de belangrijkste gegevens bekend is. Toch
          kunnen prijzen, openingstijden en voorzieningen afwijken.
        </p>
      </Section>
      <Section title="Routes en afstanden">
        <p>
          Rijtijden en afstanden worden berekend met open routeplanners op basis van OpenStreetMap. Ze houden geen rekening
          met verkeer, wegwerkzaamheden of beperkingen voor grote voertuigen (hoogte, gewicht). Volg altijd de
          verkeersborden.
        </p>
      </Section>
      <Section title="Foto's">
        <p>
          Foto&apos;s worden rechtstreeks geladen van de website van de plek of van Wikimedia Commons, met bronvermelding. Ben je
          rechthebbende en wil je dat een foto verdwijnt? Laat het ons weten via het contactformulier; we verwijderen hem
          direct.
        </p>
      </Section>
      <Section title="Externe links">
        <p>We zijn niet verantwoordelijk voor de inhoud van websites waar we naar linken.</p>
      </Section>
    </ProsePage>
  );
}
