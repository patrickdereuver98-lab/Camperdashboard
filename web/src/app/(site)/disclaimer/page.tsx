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
          eigenaren. We verzinnen niets. Wat we niet weten, staat er als onbekend. We tonen alleen plekken waarvan we de
          belangrijkste gegevens kennen. Toch kunnen prijzen, openingstijden, vertrektijden en voorzieningen anders zijn.
          Controleer belangrijke dingen bij de plek zelf.
        </p>
      </Section>
      <Section title="Prijzen">
        <p>
          We tonen de basisprijs en de extra kosten zoals de website van de plek ze noemt, bijvoorbeeld toeristenbelasting,
          stroom, een bedrag per persoon of voor een hond. Bovenaan de pagina van de plek staat wanneer we de gegevens voor het
          laatst hebben bijgewerkt. Je betaalt de prijs die de plek ter plekke vraagt.
        </p>
      </Section>
      <Section title="Routes en afstanden">
        <p>
          We rekenen rijtijden en afstanden uit met open routeplanners die de kaart van OpenStreetMap gebruiken. Die houden
          geen rekening met verkeer, wegwerkzaamheden of beperkingen voor grote voertuigen, zoals hoogte of gewicht. Volg
          altijd de verkeersborden.
        </p>
      </Section>
      <Section title="Foto's">
        <p>
          We tonen foto&apos;s van Wikimedia Commons, uit onze eigen opslag en van de openbare website van de plek. Op
          foto&apos;s van Wikimedia en van websites staat klein van wie ze zijn. De rechten blijven bij de maker of bij de
          eigenaar van de plek. Foto&apos;s van websites slaan we niet zelf op. Ben je rechthebbende en wil
          je dat een foto verdwijnt, meld het dan via <Link href="/melden">Meld inhoud</Link>. We halen hem dan zo snel
          mogelijk weg.
        </p>
      </Section>
      <Section title="Externe links">
        <p>We zijn niet verantwoordelijk voor de inhoud van websites waar we naar linken.</p>
      </Section>
      <Section title="Contact">
        <p>
          {COMPANY.tradeName} is een handelsnaam van {company("name")}, KvK-nummer {company("kvk")}. Zie je een fout, mail dan
          naar <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> of gebruik de knop &quot;Klopt er iets niet?&quot; op
          de pagina van de plek.
        </p>
      </Section>
    </ProsePage>
  );
}
