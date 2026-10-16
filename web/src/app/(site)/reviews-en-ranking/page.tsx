import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Reviews en ranking",
  description: "Hoe VrijStaan reviews controleert, wat we niet controleren en hoe we de volgorde van zoekresultaten bepalen.",
};

export default function ReviewsRankingPage() {
  const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
  return (
    <ProsePage
      title="Reviews en ranking"
      intro="Hoe reviews op VrijStaan komen, wat we wel en niet controleren, en waarom de ene plek boven de andere staat."
      updated="11 oktober 2026"
    >
      <Section title="Wie een review kan schrijven">
        <p>
          Iedereen kan een review schrijven, zonder account. We vragen een totaalcijfer van 1 tot 10 en je ervaring, in minstens
          20 tekens. Als je wilt, geef je ook cijfers voor ligging, rust, voorzieningen en prijs/kwaliteit, een titel, de maand
          van je bezoek en je soort voertuig. Je naam staat bij je review. Je e-mailadres hoef je niet te geven en is nooit
          zichtbaar. We gebruiken het alleen als we een vraag hebben over je review.
        </p>
      </Section>

      <Section title="Wat we controleren">
        <ul>
          <li>Elke review wordt gelezen door iemand van ons voordat hij online komt. Dat gebeurt meestal binnen twee werkdagen.</li>
          <li>We kijken of de review over de plek zelf gaat.</li>
          <li>We weigeren reviews met persoonsgegevens van anderen, beledigingen, haat, reclame of andere inhoud die niet mag volgens de <Link href="/voorwaarden">gebruiksvoorwaarden</Link>.</li>
          <li>Tegen misbruik: per e-mailadres kun je maximaal 5 reviews per uur sturen, en een filter houdt automatische inzendingen tegen.</li>
        </ul>
        <p>
          We plaatsen een review zoals hij is, of niet. We passen de tekst niet aan. Een negatieve review plaatsen we net zo goed
          als een positieve, zolang hij aan de regels voldoet. Over reviews beslist altijd een mens, nooit een computer.
        </p>
      </Section>

      <Section title="Wat we niet controleren">
        <ul>
          <li>
            We controleren niet of je echt op de plek bent geweest. VrijStaan neemt geen boekingen aan, dus we hebben daar geen
            bewijs van.
          </li>
          <li>We controleren niet wie je bent en sturen geen bevestigingsmail naar je e-mailadres.</li>
        </ul>
        <p>
          Reviews op VrijStaan zijn daarom niet geverifieerd. Lees ze als ervaringen van andere camperaars, niet als
          vaststaande feiten.
        </p>
      </Section>

      <Section title="Het cijfer van een plek">
        <p>
          Het cijfer van een plek is het gemiddelde van alle goedgekeurde reviews, afgerond op één decimaal. De cijfers voor
          ligging, rust, voorzieningen en prijs/kwaliteit zijn het gemiddelde van de reviews die dat onderdeel invulden.
          Eigenaren kunnen reviews niet laten verwijderen of verbergen en kunnen niet betalen voor een ander cijfer.
        </p>
      </Section>

      <Section title="Je eigen review laten verwijderen">
        <p>
          Mail naar {mail} met de naam van de plek en de naam bij je review. Gebruik als het kan hetzelfde e-mailadres als bij je
          review. Dan halen we hem weg.
        </p>
      </Section>

      <Section title="Een review melden">
        <p>
          Bevat een review volgens jou illegale inhoud, persoonsgegevens of onjuiste informatie, meld het dan via{" "}
          <Link href="/melden">Meld inhoud</Link>. We bekijken elke melding en laten je weten wat we besluiten.
        </p>
      </Section>

      <Section title="Vertrektijd in je review">
        <p>
          In het reviewformulier kun je invullen hoe laat je weg moest. Dat antwoord gaat apart naar ons. We controleren het
          en passen dan de vertrektijd van de plek aan.
        </p>
      </Section>

      <Section title="Binnenkort">
        <p>
          Foto&apos;s toevoegen bij je review kan nog niet. Dat komt er binnenkort bij. Ook die bekijken we eerst voordat ze
          online komen.
        </p>
      </Section>

      <Section title="Hoe de volgorde van zoekresultaten werkt">
        <p>
          Je kiest zelf hoe je de zoekresultaten sorteert. Niemand kan betalen voor een hogere plek. Betaalde plaatsing bestaat
          niet op VrijStaan en we krijgen geen commissie van plekken. Filters halen plekken weg die niet passen. De volgorde
          veranderen ze niet.
        </p>
        <p>
          <strong>Aanbevolen</strong> is de standaard. Elke plek krijgt punten:
        </p>
        <ul>
          <li>
            <strong>Volledigheid, tot 2 punten.</strong> Hoeveel we weten van 15 belangrijke gegevens: een echte naam, soort
            plek, woonplaats, prijs, stroom, water, lozen, toilet, douche, honden, aantal plekken, seizoen, website of telefoon,
            een foto en een beschrijving.
          </li>
          <li>
            <strong>Reviews, tot 1 punt.</strong> Het gemiddelde cijfer gedeeld door 10. Dit telt helemaal mee vanaf 5
            goedgekeurde reviews. Met minder reviews telt het naar verhouding minder.
          </li>
          <li>
            <strong>Foto, 0,3 punt.</strong> Als we een foto hebben die we mogen tonen.
          </li>
          <li>
            <strong>Zonder vertrektijd, 0,3 punt.</strong> Als de website van de plek zegt dat je vertrekt wanneer je wilt, of
            dat je per 24 uur betaalt.
          </li>
          <li>
            <strong>Uitslapers, 0,15 punt.</strong> Als de vaste vertrektijd 12:00 of later is.
          </li>
          <li>
            <strong>Afstand, punten eraf.</strong> Alleen als je een bestemming kiest. Voor elke afstand zo groot als je
            zoekstraal (minimaal 10 km) gaat er 1 punt af. Zoek je binnen 25 km, dan krijgt een plek op 25 km dus 1 punt minder
            dan een plek in het centrum.
          </li>
        </ul>
        <p>
          <strong>Afstand</strong>: de dichtstbijzijnde plek eerst, in een rechte lijn vanaf je bestemming. Dit kan alleen als
          je een bestemming kiest.
        </p>
        <p>
          <strong>Laagste prijs</strong>: de laagste prijs per nacht eerst. Plekken zonder bekende prijs staan onderaan.
        </p>
        <p>
          <strong>Beste score</strong>: het hoogste gemiddelde reviewcijfer eerst. Plekken zonder reviews staan onderaan. Bij
          gelijke cijfers telt de score van Aanbevolen.
        </p>
        <p>
          Plekken die volgens hun seizoen nu zeker dicht zijn, staan bij elke sortering onderaan. Is het seizoen onbekend, dan
          blijft de plek gewoon staan.
        </p>
      </Section>

      <Section title="Andere lijsten">
        <ul>
          <li>
            <strong>Dichtbij</strong>: de plekken die het dichtst bij je locatie liggen, gesorteerd op rijtijd zodra die bekend is.
          </li>
          <li>
            <strong>Pagina&apos;s per provincie</strong>: de uitgelichte plekken zijn de plekken met de meest volledige gegevens,
            daarna met een foto, daarna met het hoogste cijfer.
          </li>
        </ul>
      </Section>

      <Section title="Zonder vertrektijd, uitslapers en overige plekken">
        <p>We verdelen de plekken in drie groepen, elk met een eigen pagina:</p>
        <ul>
          <li>
            <Link href="/zonder-vertrektijd">Zonder vertrektijd</Link>: de website van de plek zegt dat je vertrekt wanneer
            je wilt, of je betaalt per 24 uur vanaf je aankomst.
          </li>
          <li>
            <Link href="/uitslapers">Uitslapers</Link>: de vaste vertrektijd is 12:00 of later.
          </li>
          <li>
            <Link href="/overige-plekken">Overige plekken</Link>: je vertrekt om 11:00 of 11:30, eerder dan 11:00, of we
            weten de vertrektijd nog niet.
          </li>
        </ul>
        <p>
          Een plek komt alleen bij &quot;Zonder vertrektijd&quot; als de website dat echt zegt. Tijden voor chalets, verhuur
          of de receptie tellen niet mee. Staat er iets tegenstrijdigs op de website, dan laten we de vertrektijd leeg.
        </p>
      </Section>
    </ProsePage>
  );
}
