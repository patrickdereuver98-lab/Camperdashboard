import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { COMPANY, company, companyAddress } from "@/lib/company";

export const metadata: Metadata = { title: "Gebruiksvoorwaarden", description: "De voorwaarden voor het gebruik van VrijStaan en voor reviews, foto's en meldingen." };

export default function TermsPage() {
  const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
  return (
    <ProsePage title="Gebruiksvoorwaarden" intro="Wat je van VrijStaan mag verwachten en wat wij van jou vragen als je de site gebruikt of iets plaatst." updated="11 oktober 2026">
      <Section title="1. Wie wij zijn">
        <p>
          {COMPANY.tradeName} is een handelsnaam van {company("name")}, {companyAddress()}.
        </p>
        <ul>
          <li>KvK-nummer: {company("kvk")}</li>
          <li>Btw-nummer: {company("vat")}</li>
          <li>E-mail: {mail}</li>
          <li>Telefoon: {company("phone")}</li>
        </ul>
        <p>
          Door VrijStaan te gebruiken, ga je akkoord met deze voorwaarden. Plaats je een review, foto of melding, dan gelden ze
          als afspraak tussen jou en ons.
        </p>
      </Section>

      <Section title="2. De dienst">
        <p>
          VrijStaan is een gratis gids voor camperplaatsen in Nederland. We geven informatie. We bemiddelen niet, nemen geen
          boekingen aan en verwerken geen betalingen. Een afspraak over een overnachting maak je altijd rechtstreeks met de
          plek.
        </p>
        <p>
          De gegevens komen uit OpenStreetMap, van de openbare website van de plek en van bezoekers en eigenaren. Prijzen tonen
          we zoals de website van de plek ze noemt: de basisprijs en de extra kosten die erbij staan, zoals toeristenbelasting,
          stroom, per persoon of voor een hond, met de bron en de datum. We doen ons best, maar kunnen niet garanderen dat alles
          klopt of actueel is. Controleer belangrijke zaken bij de plek zelf. Zie ook de <Link href="/disclaimer">disclaimer</Link>.
        </p>
      </Section>

      <Section title="3. Gebruik van de site">
        <p>
          Je mag VrijStaan gebruiken voor persoonlijk, niet-commercieel gebruik. Het is niet toegestaan de site op grote schaal
          automatisch uit te lezen, de dienst te verstoren of beveiliging te omzeilen. Kaartgegevens zijn afkomstig van
          OpenStreetMap (© OpenStreetMap-bijdragers, ODbL).
        </p>
      </Section>

      <Section title="4. Regels voor reviews, foto's en meldingen">
        <ul>
          <li>Schrijf alleen over je eigen ervaring op een plek waar je zelf bent geweest.</li>
          <li>Plaats alleen foto&apos;s die je zelf hebt gemaakt.</li>
          <li>Geen persoonsgegevens van anderen, zoals namen, kentekens of herkenbare mensen op foto&apos;s zonder hun toestemming.</li>
          <li>Geen reclame, links naar eigen bedrijven of reviews in ruil voor een beloning.</li>
          <li>Geen haat, discriminatie, bedreigingen of beledigingen.</li>
          <li>Geen inhoud die in strijd is met de wet of met rechten van anderen, zoals auteursrecht.</li>
          <li>Ben je eigenaar of werk je voor een plek? Schrijf dan geen review over die plek of een concurrent.</li>
        </ul>
      </Section>

      <Section title="5. Jouw toestemming om je bijdrage te tonen">
        <p>
          Je blijft eigenaar van je review en je foto&apos;s. Door ze te plaatsen geef je ons een niet-exclusieve, wereldwijde en
          kosteloze licentie om ze te tonen op VrijStaan en op de sociale kanalen van VrijStaan, met je opgegeven naam. Je kunt
          deze licentie intrekken door je bijdrage te laten verwijderen. Stuur daarvoor een mail naar {mail}.
        </p>
        <p>
          Je verklaart dat je de foto zelf hebt gemaakt of dat je het recht hebt hem zo te delen, en dat er niemand herkenbaar
          op staat die daar geen toestemming voor gaf. Stelt iemand ons aansprakelijk omdat dat niet klopt, dan ben jij daarvoor
          verantwoordelijk.
        </p>
      </Section>

      <Section title="6. Controle en verwijderen">
        <p>
          Reviews komen pas online nadat iemand van ons ze heeft gelezen. We weigeren of verwijderen bijdragen die niet aan deze
          regels voldoen of die illegaal zijn. Een bijdrage aanpassen doen we niet: we plaatsen hem zoals hij is, of niet. We
          beslissen niet automatisch; er kijkt altijd een mens naar. Hoe we reviews controleren en wat we niet controleren, lees
          je op <Link href="/reviews-en-ranking">Reviews en ranking</Link>.
        </p>
        <p>
          Weigeren of verwijderen we je bijdrage en heb je een e-mailadres opgegeven, dan sturen we je een bericht met de reden:
          welke regel of wet het betreft, wat we hebben gedaan en hoe je bezwaar maakt (art. 17 Digital Services Act). Ben je het
          er niet mee eens? Mail naar {mail}. Iemand die niet bij het eerste besluit betrokken was, kijkt er opnieuw naar, als dat
          kan. Je kunt ook naar de rechter.
        </p>
      </Section>

      <Section title="7. Inhoud melden">
        <p>
          Zie je iets op VrijStaan dat volgens jou illegaal is, inbreuk maakt op je rechten of niet klopt? Meld het via{" "}
          <Link href="/melden">Meld inhoud</Link>. Je krijgt een bevestiging en we laten je weten wat we met je melding doen.
          We reageren zo snel mogelijk, uiterlijk binnen 5 werkdagen.
        </p>
        <p>
          Ons contactpunt voor gebruikers en autoriteiten (art. 11 en 12 Digital Services Act) is {mail}. Je kunt ons schrijven
          in het Nederlands of het Engels.
        </p>
      </Section>

      <Section title="8. Eigenaren van plekken">
        <p>
          Ben je eigenaar of beheerder van een plek? Dan kun je je vermelding claimen, gegevens laten aanpassen of de plek laten
          verwijderen via <Link href="/plek-aanmelden?soort=eigenaar">het formulier voor eigenaren</Link> of de knop &quot;Klopt
          er iets niet?&quot; op de pagina van de plek. We verwerken dit meestal binnen twee werkdagen. Foto&apos;s van je eigen
          website tonen we met bronvermelding; wil je dat een foto verdwijnt, meld het dan via{" "}
          <Link href="/melden">Meld inhoud</Link> en we halen hem weg.
        </p>
        <p>
          Reviews van bezoekers kun je niet laten verwijderen omdat ze negatief zijn. Bevat een review volgens jou illegale
          inhoud of breekt hij de regels uit artikel 4? Meld hem dan via <Link href="/melden">Meld inhoud</Link>.
        </p>
      </Section>

      <Section title="9. Volgorde van plekken">
        <p>
          Hoe de volgorde van zoekresultaten tot stand komt en welke factoren meewegen, lees je op{" "}
          <Link href="/reviews-en-ranking">Reviews en ranking</Link>. Niemand kan betalen voor een hogere plek.
        </p>
      </Section>

      <Section title="10. Aansprakelijkheid">
        <p>
          VrijStaan is gratis en geeft informatie zonder garantie. We zijn niet aansprakelijk voor schade door het gebruik van
          die informatie, door bijdragen van anderen, door websites waar we naar linken of doordat de site tijdelijk niet werkt.
          Dit geldt niet bij opzet of bewuste roekeloosheid van ons, en niet voor zover de wet dat niet toestaat.
        </p>
      </Section>

      <Section title="11. Wijzigingen">
        <p>
          We kunnen deze voorwaarden aanpassen. De datum bovenaan laat zien wanneer dat voor het laatst gebeurde. Voor
          bijdragen die je al hebt geplaatst, gelden de voorwaarden van dat moment, tenzij een wijziging in je voordeel is.
        </p>
      </Section>

      <Section title="12. Toepasselijk recht">
        <p>
          Op deze voorwaarden is Nederlands recht van toepassing. Woon je in een ander EU-land, dan houd je de bescherming die
          het recht van dat land je als consument geeft. Geschillen leggen we voor aan de bevoegde rechter in Nederland, tenzij
          de wet een andere rechter aanwijst.
        </p>
      </Section>
    </ProsePage>
  );
}
