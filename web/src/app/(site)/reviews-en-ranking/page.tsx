import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Reviews en ranking",
  description: "Hoe VrijStaan reviews controleert, wat we niet controleren en hoe de volgorde van zoekresultaten tot stand komt.",
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
          Iedereen kan een review schrijven, zonder account. We vragen een totaalcijfer van 1 tot 10 en je ervaring (minstens
          20 tekens). Optioneel geef je cijfers voor ligging, rust, voorzieningen en prijs/kwaliteit, een titel, de maand van je
          bezoek en je soort voertuig. Je naam staat bij je review. Je e-mailadres is optioneel en nooit zichtbaar; we gebruiken
          het alleen voor vragen over je review.
        </p>
      </Section>

      <Section title="Wat we controleren">
        <ul>
          <li>Elke review wordt gelezen door iemand van ons voordat hij online komt. Dat gebeurt meestal binnen twee werkdagen.</li>
          <li>We kijken of de review over de plek zelf gaat.</li>
          <li>We weigeren reviews met persoonsgegevens van anderen, beledigingen, haat, reclame of andere inhoud die niet mag volgens de <Link href="/voorwaarden">gebruiksvoorwaarden</Link>.</li>
          <li>We beperken misbruik: per e-mailadres kun je maximaal 5 reviews per uur sturen, en we hebben een filter tegen automatische inzendingen.</li>
        </ul>
        <p>
          We plaatsen een review zoals hij is, of niet. We passen de tekst niet aan. Negatieve reviews plaatsen we net zo goed
          als positieve, zolang ze aan de regels voldoen. Over reviews beslist altijd een mens, nooit een computer.
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
          Wil je je review laten weghalen? Mail naar {mail} met de naam van de plek en de naam bij je review. Gebruik als het kan
          hetzelfde e-mailadres als bij je review.
        </p>
      </Section>

      <Section title="Klopt een review niet?">
        <p>
          Bevat een review volgens jou illegale inhoud, persoonsgegevens of onjuiste informatie? Meld het via{" "}
          <Link href="/melden">Meld inhoud</Link>. We bekijken elke melding en laten je weten wat we besluiten.
        </p>
      </Section>

      <Section title="Binnenkort">
        <p>Deze onderdelen zijn nog niet beschikbaar. We voegen ze binnenkort toe:</p>
        <ul>
          <li>Binnenkort: foto&apos;s toevoegen bij je review. Ook die lezen we eerst voordat ze online komen.</li>
          <li>Binnenkort: de vraag &quot;Moest je voor een vaste tijd vertrekken?&quot; in het reviewformulier.</li>
        </ul>
      </Section>

      <Section title="Hoe de volgorde van zoekresultaten werkt">
        <p>
          Je kiest zelf hoe je zoekresultaten sorteert. Niemand kan betalen voor een hogere plek: betaalde plaatsing bestaat
          niet op VrijStaan en we krijgen geen commissie van plekken. Filters halen plekken weg die niet passen; ze veranderen de
          volgorde niet.
        </p>
        <p>
          <strong>Aanbevolen</strong> is de standaard. Elke plek krijgt punten:
        </p>
        <ul>
          <li>
            <strong>Volledigheid, tot 2 punten.</strong> Hoeveel van 15 belangrijke gegevens we kennen: een echte naam, soort
            plek, woonplaats, prijs, stroom, water, lozen, toilet, douche, honden, aantal plekken, seizoen, website of telefoon,
            een foto en een beschrijving.
          </li>
          <li>
            <strong>Reviews, tot 1 punt.</strong> Het gemiddelde cijfer gedeeld door 10. Dit telt pas volledig mee vanaf 5
            goedgekeurde reviews; met minder reviews telt het naar verhouding minder.
          </li>
          <li>
            <strong>Foto, 0,3 punt.</strong> Als we een foto hebben die we mogen tonen.
          </li>
          <li>
            <strong>Geen vaste vertrektijd, 0,3 punt.</strong> Als de website van de plek letterlijk zegt dat je geen vaste
            vertrektijd hebt, of dat je per 24 uur betaalt.
          </li>
          <li>
            <strong>Afstand, punten eraf.</strong> Alleen als je een bestemming kiest. Per afstand gelijk aan je zoekstraal (minimaal
            10 km) gaat er 1 punt af. Zoek je binnen 25 km, dan staat een plek op 25 km dus 1 punt lager dan een plek in het
            centrum.
          </li>
        </ul>
        <p>
          <strong>Afstand</strong>: de dichtstbijzijnde plek eerst, in een rechte lijn vanaf je bestemming. Alleen beschikbaar
          als je een bestemming kiest.
        </p>
        <p>
          <strong>Laagste prijs</strong>: de laagste prijs per nacht eerst. Plekken zonder bekende prijs staan onderaan.
        </p>
        <p>
          <strong>Beste score</strong>: het hoogste gemiddelde reviewcijfer eerst. Plekken zonder reviews staan onderaan. Bij
          gelijke cijfers telt de score van Aanbevolen.
        </p>
        <p>
          Bij elke sortering staan plekken die volgens hun seizoen nu zeker gesloten zijn altijd onderaan. Is het seizoen
          onbekend, dan blijft de plek gewoon staan.
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

      <Section title={'Wat "Geen vaste vertrektijd" betekent'}>
        <p>
          Bij een plek met &quot;Geen vaste vertrektijd&quot; zegt de website van de plek letterlijk dat je kunt vertrekken
          wanneer je wilt, of dat je per 24 uur betaalt vanaf je aankomst. We bewaren de zin van de website als bewijs. Tijden
          voor chalets, verhuur of de receptie tellen niet mee. Staan er tegenstrijdige dingen op de website, dan vullen we niets
          in. Met het filter &quot;Geen vaste vertrektijd&quot; zie je alleen deze plekken.
        </p>
      </Section>
    </ProsePage>
  );
}
