import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { COMPANY, company } from "@/lib/company";

export const metadata: Metadata = { title: "Disclaimer", description: "Over de juistheid van de informatie op VrijStaan." };

export default function DisclaimerPage() {
  return (
    <ProsePage title="Disclaimer" updated="11 oktober 2026">
      <Section title="Informatie">
        <p>
          De gegevens op VrijStaan komen uit OpenStreetMap, van de openbare websites van de plekken en van bezoekers en
          eigenaren. We verzinnen niets: wat we niet weten, staat er als onbekend. We tonen alleen plekken waarvan de
          belangrijkste gegevens bekend zijn. Toch kunnen prijzen, openingstijden, vertrektijden en voorzieningen afwijken.
          Controleer belangrijke zaken bij de plek zelf.
        </p>
      </Section>
      <Section title="Prijzen">
        <p>
          We tonen de basisprijs en de extra kosten zoals de website van de plek ze noemt, bijvoorbeeld toeristenbelasting,
          stroom, een bedrag per persoon of voor een hond. Daarbij staan de bron en de datum waarop we het lazen. De prijs die de
          plek ter plekke vraagt, geldt.
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
          We tonen foto&apos;s van Wikimedia Commons (met naamsvermelding), foto&apos;s in onze eigen opslag en foto&apos;s
          van de openbare website van de plek. Bij die laatste staat altijd de bron. De rechten blijven bij de maker of de
          eigenaar van de plek; we slaan de foto&apos;s niet zelf op. Ben je rechthebbende en wil je dat een foto verdwijnt? Meld het via{" "}
          <Link href="/melden">Meld inhoud</Link>; we halen hem dan zo snel mogelijk weg.
        </p>
      </Section>
      <Section title="Externe links">
        <p>We zijn niet verantwoordelijk voor de inhoud van websites waar we naar linken.</p>
      </Section>
      <Section title="Contact">
        <p>
          {COMPANY.tradeName} is een handelsnaam van {company("name")}, KvK-nummer {company("kvk")}. Klopt er iets niet? Mail naar{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> of gebruik de knop &quot;Klopt er iets niet?&quot; op de
          pagina van de plek.
        </p>
      </Section>
    </ProsePage>
  );
}
