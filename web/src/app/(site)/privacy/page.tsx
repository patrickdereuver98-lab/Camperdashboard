import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, Section } from "@/components/prose";
import { CookieSettingsLink } from "@/components/cookie-banner";
import { COMPANY, company, companyAddress } from "@/lib/company";

export const metadata: Metadata = { title: "Privacyverklaring", description: "Welke gegevens VrijStaan verwerkt, waarom, op welke grondslag en hoe lang." };

const HEAD = ["Doel", "Gegevens", "Grondslag (AVG)", "Bewaartermijn"];

const ROWS: string[][] = [
  [
    "Account (optioneel)",
    "E-mailadres, naam en profielfoto zoals Google, Apple of Facebook die doorgeven, de manier van inloggen, je bewaarde reis en tijdstippen van aanmaken en inloggen",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b): je kiest zelf voor een account",
    "Tot je je account verwijdert",
  ],
  [
    "Samen plannen",
    "De gedeelde reis (plekken en nachten), wie hem het laatst wijzigde, en je naam zoals de andere deelnemers die zien. Alleen deelnemers kunnen de reis zien",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b): je doet zelf mee",
    "Zolang de gedeelde reis bestaat; je deelname eindigt als je stopt of je account verwijdert",
  ],
  [
    "Uitgaven onderweg",
    "Datum, soort, bedrag, eventueel liters, de stop en je notitie. Zonder account alleen op je toestel; met account ook in je account",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b)",
    "Tot je ze weghaalt of je account verwijdert",
  ],
  [
    "Mijn camper",
    "Naam, maten, brandstof en verbruik die je zelf invult. Zonder account alleen op je toestel; met account ook in je account",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b)",
    "Tot je de gegevens wist of je account verwijdert",
  ],
  [
    "Papieren van je camper",
    "Bestanden die je zelf uploadt (bijvoorbeeld kentekenbewijs of verzekering). Ze staan in een afgeschermde map die alleen jij kunt openen; wij kijken er niet in",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b)",
    "Tot je ze weghaalt of je account verwijdert",
  ],
  [
    "Drukte die je doorgeeft",
    "Of het rustig, druk of vol is, de plek, je account-id en het tijdstip. Anderen zien alleen het totaal van de laatste 3 uur, nooit wie iets meldde",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b): je geeft de drukte zelf door",
    "30 dagen",
  ],
  [
    "Meldingen als het rustig wordt",
    "Welke plek je volgt (24 uur), en het adres waarop de pushdienst van je browser jouw toestel bereikt, met de sleutels om de melding te versleutelen",
    "Toestemming (art. 6 lid 1 sub a): je zet de melding zelf aan en kunt hem altijd uitzetten",
    "Tot je de melding uitzet, de toestemming in je browser intrekt of je account verwijdert",
  ],
  [
    "Foto's die je toevoegt",
    "De foto (verkleind in je browser, zonder locatie- of cameragegevens), het bijschrift, de naam die je bij de foto zet, je account-id en het tijdstip",
    "Uitvoering van de overeenkomst (art. 6 lid 1 sub b): je plaatst de foto zelf",
    "Zolang de foto online staat of tot je om verwijdering vraagt; bij het verwijderen van je account blijft een goedgekeurde foto staan zonder koppeling aan jou",
  ],
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
    "Foutmeldingen uit de browser (de melding en de pagina), het aantal inzendingen per e-mailadres om misbruik te beperken, het aantal routeverzoeken per IP-adres (alleen een minuut in het werkgeheugen, nooit opgeslagen) en een logboek van wat beheerders wijzigen",
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
  [
    "Zoeken op adres, postcode of plaats",
    "Wat je in het zoekveld typt",
    "Gerechtvaardigd belang, op jouw verzoek (art. 6 lid 1 sub f)",
    "Niet opgeslagen in onze database; de server onthoudt het antwoord van PDOK een paar uur",
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
      updated="18 oktober 2026"
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
          <li>Kies je toch voor een account, dan bewaren we alleen wat nodig is om je reis op al je apparaten te tonen.</li>
          <li>Statistieken verzamelen we alleen als je dat toestaat, zonder IP-adres en zonder cookies.</li>
          <li>We verkopen geen gegevens en delen ze niet voor reclame.</li>
          <li>
            Zonder account staan je bewaarde reis en instellingen alleen op je eigen apparaat; wij kunnen ze niet zien. Met
            een account bewaren we je reis ook in onze database.
          </li>
        </ul>
      </Section>

      <Section title="Wat we verwerken, waarom en hoe lang">
        <Table head={HEAD} rows={ROWS} />
        <p>
          De bewaartermijnen gelden voor onze eigen database. Daarna verwijderen we de gegevens of maken we ze anoniem. We
          nemen geen besluiten over je die alleen door een computer worden genomen, en we maken geen profielen.
        </p>
      </Section>

      <Section title="Een account (optioneel)">
        <p>
          Je kunt inloggen met Google, Apple, Facebook of een inlogcode per e-mail. Log je in via een van die diensten, dan
          krijgen we van hen alleen je naam, e-mailadres en profielfoto. We plaatsen nooit iets namens je en vragen geen
          toegang tot je contacten of berichten. Bij Apple kun je je e-mailadres verbergen.
        </p>
        <p>
          Met een account bewaren we je reis (de plekken en het aantal nachten) zodat je hem op al je apparaten ziet. Om
          ingelogd te blijven staat er een sessiesleutel in de lokale opslag van je browser; dat is strikt noodzakelijk en
          geen tracking-cookie. Je verwijdert je account zelf op <Link href="/account">Mijn account</Link>; je profiel en reis
          verdwijnen dan direct.
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
        <p>
          Zoek je op een adres, postcode of plaats, dan stuurt onze server wat je typt naar de Locatieserver van PDOK
          (Kadaster, de Nederlandse overheid). Alleen de zoekterm gaat mee: geen IP-adres en geen andere gegevens over jou.
          Je browser praat zelf niet met PDOK. Werkt PDOK even niet, dan zoeken we in onze eigen lijst met plaatsen.
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
            <strong>De pushdienst van je browser</strong> (bij Chrome Google, bij Safari Apple, bij Firefox Mozilla) als je een
            melding aanzet. Die dienst bezorgt alleen de versleutelde melding op je toestel.
          </li>
          <li>
            <strong>Google</strong>, <strong>Apple</strong> of <strong>Meta (Facebook)</strong> als je via hen inlogt. Daarvoor
            gelden ook hun eigen privacyregels.
          </li>
          <li>
            <strong>OpenRouteService</strong> (HeiGIT gGmbH) of <strong>FOSSGIS e.V.</strong> krijgen coördinaten als je een
            rijtijd laat berekenen.
          </li>
          <li>
            <strong>PDOK</strong> (Kadaster) krijgt via onze server de zoekterm als je op een adres, postcode of plaats
            zoekt, zonder je IP-adres.
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
