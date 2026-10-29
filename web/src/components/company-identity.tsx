import Link from "next/link";
import { COMPANY, company, companyAddress } from "@/lib/company";

/**
 * Wie VrijStaan is, voor de juridische pagina's. Zolang de bedrijfsgegevens niet zijn ingevuld (hobbyproject in beta)
 * staat hier een eerlijke zin in plaats van "[… nog invullen]". Naam, adres en KvK-nummer worden nooit verzonnen.
 * Voor de officiële livegang moet `COMPANY` in `lib/company.ts` zijn ingevuld.
 */
export function CompanyIdentity() {
  if (!COMPANY.name) {
    return (
      <>
        {COMPANY.tradeName} is een hobbyproject in beta. De bedrijfsgegevens volgen vóór de officiële livegang. Vragen kun
        je stellen via <Link href="/contact">het contactformulier</Link>.
      </>
    );
  }
  return (
    <>
      {COMPANY.tradeName} is een handelsnaam van {company("name")}, {companyAddress()}.
      {COMPANY.kvk ? <> KvK-nummer {COMPANY.kvk}.</> : null}
    </>
  );
}
