import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { CookieSettingsLink } from "@/components/cookie-banner";
import { COMPANY, company, companyAddress } from "@/lib/company";

export const metadata: Metadata = { title: "Privacyverklaring", description: "Welke gegevens VrijStaan verwerkt, waarom, op welke grondslag en hoe lang." };

const HEAD = ["Doel", "Gegevens", "Grondslag (AVG)", "Bewaartermijn"];

const ROWS: string[][] = [
  [
    "Statistieken",
    "Wat er gebeurde (pagina bekeken, zoekopdracht, plek bekeken, link naar buiten, route, bewaard), het pad van de pagina, een klein detail zoals de zoekterm of de plek, een willekeurig sessienummer en het tijdstip",
    "Toestemming (art. 6 lid 1 sub a)",
    "13 maanden",
  ],
  [
    "Bewijs van je cookiekeuze",
    "Een willekeurig id, je keuze, de versie van de melding en het tijdstip",
    "Wettelijke verplichting (art. 6 lid 1 sub c jo. art. 7 lid 1)",
    "24 maanden",
  ],
  [
    "Contact en support",
    "Naam, e-mailadres, onderwerp, categorie, je berichten en onze antwoorden, eventueel de plek waar het over gaat",
    "Gerechtvaardigd belang (je vraag beantwoorden) en het uitvoeren van je verzoek (art. 6 lid 1 sub b en f)",
    "12 maanden nadat het bericht is gesloten",
  ],
  [
    "Meldingen van illegale of onjuiste inhoud",
    "Reden, adres (URL) van de inhoud, je toelichting, naam en e-mailadres",
    "Wettelijke verplichting (art. 6 lid 1 sub c, art. 16 Digital Services Act)",
    "12 maanden nadat de melding is gesloten",
  ],
  [
    "Reviews",
    "Je naam (openbaar), e-mailadres (optioneel, nooit openbaar), cijfers, titel, tekst, maand van je bezoek, soort voertuig, de plek en het tijdstip",
    "Overeenkomst: de gebruiksvoorwaarden (art. 6 lid 1 sub b)",
    "Gepubliceerd: tot de review wordt verwijderd. Afgewezen: 3 maanden",
  ],
  [
    "Plek aanmelden, correcties en verzoeken van eigenaren",
    "De gegevens van de plek die je invult, je toelichting en, als je die opgeeft, je naam en e-mailadres (verplicht voor eigenaren)",
    "Overeenkomst: de gebruiksvoorwaarden (art. 6 lid 1 sub b)",
    "Zolang nodig om de inzending te verwerken en om te kunnen laten zien waar een wijziging vandaan komt",
  ],
  [
    "Moderatie en beveiliging",
    "Foutmeldingen uit de browser (de melding en de pagina), het aantal inzendingen per e-mailadres om misbruik te beperken en een logboek van wat beheerders wijzigen",
    "Gerechtvaardigd belang: de site veilig en betrouwbaar houden (art. 6 lid 1 sub f)",
    "Zolang nodig voor dat doel",
  ],
  [
    "Gegevens van plekken en eigenaren",
    "Zakelijke gegevens die de plek zelf openbaar heeft gemaakt: naam, adres, telefoon, e-mail, website, prijzen en voorzieningen",
    "Gerechtvaardigd belang: een gratis, openbare gids maken (art. 6 lid 1 sub f)",
    "Zolang de plek in de gids staat",
  ],
  [
    "Rijtijd en afstand berekenen",
    "De coördinaten van je vertrekpunt en bestemming",
    "Gerechtvaardigd belang, op jouw verzoek (art. 6 lid 1 sub f)",
    "Niet opgeslagen in onze database",
  ],
];

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <>
      {/* Mobiel: kaartjes; vanaf sm een tabel */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r[0]} className="rounded-lg bg-surface p-3 outline-1 outline-line outline !ml-0 !list-none">
            <p className="font-semibold text-ink">{r[0]}</p>
            <dl className="mt-1 space-y-1 text-sm">
              {r.slice(1).map((c, i) => (
                <div key={i}>
                  <dt className="text-muted">{head[i + 1]}</dt>
                  <dd>{c}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-hidden rounded-lg outline-1 outline-line outline sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-sunken">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 font-semibold text-ink">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r[0]}>
                {r.map((c, i) => (
                  <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-semibold text-ink" : ""}`}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PrivacyPage() {
  const mail = <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>;
  return (
    <ProsePage
      title="Privacyverklaring"
      intro="We verwerken zo weinig persoonsgegevens als we kunnen. Hier lees je welke, waarom, op welke grondslag en hoe lang."
      updated="11 oktober 2026"
    >
      <Section title="Wie zijn wij">
        <p>
          {COMPANY.tradeName} is een handelsnaam van {company("name")}, {companyAddress()}. KvK-nummer {company("kvk")}.
          Wij zijn verwerkingsverantwoordelijke voor de persoonsgegevens op deze site.
        </p>
        <p>
          Heb je een vraag over privacy, mail dan naar {mail} of gebruik{" "}
          <Link href="/contact?onderwerp=privacy">het contactformulier</Link> en kies &quot;Privacy en mijn gegevens&quot;.
        </p>
      </Section>

      <Section title="In het kort">
        <ul>
          <li>Je hebt geen account nodig. We plaatsen geen cookies bij bezoekers en tonen geen advertenties.</li>
          <li>Statistieken verzamelen we alleen als je dat toestaat, zonder IP-adres en zonder cookies.</li>
          <li>We verkopen geen gegevens en delen ze niet voor reclame.</li>
          <li>Je bewaarde reis en instellingen staan alleen op je eigen apparaat. Wij kunnen ze niet zien.</li>
        </ul>
      </Section>

      <Section title="Wat we verwerken, waarom en hoe lang">
        <Table head={HEAD} rows={ROWS} />
        <p>
          De bewaartermijnen gelden voor onze eigen database. Daarna verwijderen we de gegevens of maken we ze anoniem. We
          nemen geen besluiten over je die alleen door een computer worden genomen, en we maken geen profielen.
        </p>
      </Section>

      <Section title="Statistieken">
        <p>
          Alleen als je kiest voor &quot;Statistieken toestaan&quot;, houden we bij hoe de site wordt gebruikt. Dat staat in onze
          eigen database (tabel <em>events</em>): de soort gebeurtenis, het pad van de pagina, een klein detail zoals de zoekterm
          of de plek, een willekeurig sessienummer en het tijdstip. We slaan geen IP-adres op, gebruiken geen cookies, koppelen
          het niet aan andere gegevens en delen het met niemand.
        </p>
        <p>
          Het sessienummer staat in de sessieopslag van je browser en verdwijnt als je het tabblad sluit. Volgens art. 11.7a
          Telecommunicatiewet is voor statistieken met weinig gevolgen voor je privacy soms geen toestemming nodig. We vragen
          het toch.
        </p>
        <p>
          Je keuze leggen we vast als bewijs: een willekeurig id, je keuze, de versie van de melding en het tijdstip. Je
          wijzigt je keuze net zo makkelijk als je hem gaf, via &quot;Cookie-instellingen&quot; onderaan elke pagina.
        </p>
        <CookieSettingsLink className="!font-semibold !text-forest underline" />
      </Section>

      <Section title="Je locatie en routes">
        <p>
          Je locatie gebruiken we alleen als je daar zelf om vraagt en je browser het toestaat. Je telefoon rondt hem eerst af
          op ongeveer 1 kilometer. Je precieze locatie verlaat je apparaat dus niet. Onze server stuurt de afgeronde
          coördinaten en de bestemming naar een routeplanner om de rijtijd uit te rekenen:
        </p>
        <ul>
          <li>OpenRouteService van HeiGIT gGmbH in Heidelberg (Duitsland), als we daar een sleutel voor hebben ingesteld;</li>
          <li>anders de openbare routeplanner routing.openstreetmap.de van FOSSGIS e.V. (Duitsland).</li>
        </ul>
        <p>
          We gebruiken de afgeronde locatie alleen voor die berekening. We slaan hem niet op in onze database en koppelen hem
          niet aan andere gegevens over jou. Zodat de routeplanner niet te veel vragen krijgt, bewaart de server de uitkomst
          (de rijtijd bij een afgerond punt) een paar dagen in een technische cache. Daarin staat niets wat naar jou te
          herleiden is. De knop &quot;Open in navigatie&quot; opent Google Maps. Daar gelden de privacyregels van Google.
        </p>
      </Section>

      <Section title="De kaart, lettertypes en foto's">
        <ul>
          <li>
            De kaarttegels komen van OpenFreeMap (tiles.openfreemap.org). Als de kaart laadt, krijgt die server je IP-adres.
            OpenFreeMap geeft aan standaard geen IP-adressen te bewaren. Kaartgegevens © OpenStreetMap-bijdragers (ODbL).
          </li>
          <li>De lettertypes staan op onze eigen server. Er gaan geen verzoeken naar Google Fonts.</li>
          <li>
            We tonen foto&apos;s van Wikimedia Commons, uit onze eigen opslag en van de openbare website van de plek. Op
            foto&apos;s van Wikimedia en van websites staat klein van wie ze zijn. Foto&apos;s van buiten
            laten we verkleinen door wsrv.nl, een gratis beelddienst (open source, via Cloudflare), zodat ze snel laden op je
            telefoon. Je browser haalt de foto dan op bij wsrv.nl, en als dat niet lukt bij Wikimedia, uit onze opslag bij
            Supabase of bij de website van de plek. Die server ziet dan je IP-adres. wsrv.nl bewaart geen cookies.
          </li>
        </ul>
      </Section>

      <Section title="Gegevens over plekken en eigenaren">
        <p>
          De plekken in de gids komen uit OpenStreetMap (ODbL) en van de openbare website van de plek zelf. We nemen daarvan
          alleen zakelijke gegevens over: naam, adres, telefoon, e-mail, website, prijzen en voorzieningen. Is de eigenaar een
          natuurlijk persoon, zoals een boer met een camperplek of iemand met een eenmanszaak, dan zijn dit persoonsgegevens
          die we niet bij die persoon zelf hebben verzameld (art. 14 AVG).
        </p>
        <ul>
          <li>Bron: OpenStreetMap en de website van de plek.</li>
          <li>Soort gegevens: zakelijke contactgegevens, adres, prijzen en voorzieningen.</li>
          <li>
            Grondslag: gerechtvaardigd belang. We maken een gratis, openbare gids en tonen alleen wat het bedrijf zelf al
            openbaar heeft gemaakt.
          </li>
          <li>
            Op foto&apos;s van de website van een plek staat klein waar ze vandaan komen. Wil de eigenaar of maker dat een
            foto verdwijnt, dan halen we hem weg na een melding via <Link href="/melden">Meld inhoud</Link>.
          </li>
          <li>
            Bezwaar maken, iets laten verbeteren of laten verwijderen kan via het{" "}
            <Link href="/plek-aanmelden?soort=eigenaar">formulier voor eigenaren</Link>, met de knop &quot;Klopt er iets
            niet?&quot; op de pagina van de plek, of per mail naar {mail}.
          </li>
        </ul>
      </Section>

      <Section title="Met wie we gegevens delen">
        <p>We verkopen niets. Deze partijen verwerken gegevens voor ons of krijgen ze technisch mee:</p>
        <ul>
          <li>
            <strong>Vercel Inc.</strong> (Verenigde Staten) host de site. Vercel bewaart kort serverlogs, met daarin je
            IP-adres. Met Vercel hebben we een verwerkersovereenkomst. De doorgifte naar de VS valt onder het EU-US Data Privacy
            Framework.
          </li>
          <li>
            <strong>Supabase</strong> levert onze database en backend, in de regio Frankfurt (EU). Met Supabase hebben we een
            verwerkersovereenkomst. Voor hun subverwerkers gelden de standaardcontractbepalingen van de Europese Commissie.
          </li>
          <li>
            <strong>OpenRouteService</strong> (HeiGIT gGmbH) of <strong>FOSSGIS e.V.</strong> krijgen coördinaten als je een
            rijtijd laat berekenen.
          </li>
          <li>
            <strong>OpenFreeMap</strong>, <strong>wsrv.nl</strong>, <strong>Wikimedia</strong> en de website van een plek
            zien je IP-adres als je browser daar kaarttegels of foto&apos;s laadt.
          </li>
        </ul>
        <p>Als de wet ons verplicht, geven we gegevens aan een bevoegde instantie.</p>
      </Section>

      <Section title="Op je eigen apparaat">
        <p>
          Je bewaarde reis, je instellingen en je cookiekeuze staan in de lokale opslag van je browser. De service worker bewaart
          pagina&apos;s en gegevens van plekken op je apparaat, zodat de site ook zonder bereik werkt. Wij kunnen daar niet bij.
          Wat we precies opslaan, lees je in het <Link href="/cookies">cookiebeleid</Link>.
        </p>
      </Section>

      <Section title="Beveiliging en datalekken">
        <p>
          Alle verbindingen zijn versleuteld. De database is per rij afgeschermd. Bezoekers kunnen alleen lezen wat gepubliceerd
          is. Berichten, reviews en meldingen zijn alleen te zien voor beheerders met een eigen account.
        </p>
        <p>
          We hebben een vaste aanpak voor datalekken. Gaat er iets mis met persoonsgegevens, dan melden we dat binnen 72 uur bij
          de Autoriteit Persoonsgegevens als dat verplicht is. Heeft het lek een hoog risico voor jou, dan laten we het jou ook
          weten.
        </p>
      </Section>

      <Section title="Jouw rechten">
        <p>Je hebt het recht om:</p>
        <ul>
          <li>je gegevens in te zien;</li>
          <li>onjuiste gegevens te laten verbeteren;</li>
          <li>je gegevens te laten verwijderen;</li>
          <li>de verwerking te laten beperken;</li>
          <li>bezwaar te maken tegen verwerking op basis van gerechtvaardigd belang;</li>
          <li>je gegevens in een gangbaar bestand te krijgen (overdraagbaarheid);</li>
          <li>je toestemming in te trekken, zonder dat dit eerdere verwerking onrechtmatig maakt.</li>
        </ul>
        <p>
          Stuur je verzoek naar {mail} of via <Link href="/contact?onderwerp=privacy">het contactformulier</Link>. We reageren
          binnen een maand. Soms vragen we je om te laten zien wie je bent, zodat we gegevens niet aan de verkeerde persoon
          geven.
        </p>
        <p>
          Ben je het niet eens met hoe we met je gegevens omgaan, dan kun je een klacht indienen bij de{" "}
          <a href="https://autoriteitpersoonsgegevens.nl">Autoriteit Persoonsgegevens</a>. We horen het graag eerst van jou.
        </p>
      </Section>

      <Section title="Contactpunt">
        <p>
          Ons contactpunt voor gebruikers en autoriteiten, ook voor de Digital Services Act, is {mail}. Je kunt ons schrijven in
          het Nederlands of het Engels.
        </p>
      </Section>

      <Section title="Wijzigingen">
        <p>
          Passen we deze verklaring aan, dan zie je dat aan de datum bovenaan. Bij grote wijzigingen vragen we je cookiekeuze
          opnieuw als dat nodig is.
        </p>
      </Section>
    </ProsePage>
  );
}
