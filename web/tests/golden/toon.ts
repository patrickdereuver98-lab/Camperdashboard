// Hulpje: wat de extractor van één gouden pagina maakt. Gebruik: node --import ./tests/register.mjs tests/golden/toon.ts <naam>
import { extract, nightPrices } from "../../supabase/functions/pipeline/extract";
import { GEVALLEN } from "./gevallen";
import { pagina } from "./pagina";
for (const naam of process.argv.slice(2)) {
  const g = GEVALLEN.find((x) => x.naam === naam)!;
  const r = extract([pagina(naam)], new URL(g.url)) as Record<string, unknown>;
  const { photos, description, fields, ...rest } = r;
  void photos; void description; void fields;
  console.log(naam, JSON.stringify(rest, null, 1));
  if (process.env.PRIJZEN) console.log(nightPrices(pagina(naam).replace(/<[^>]+>/g, " . ").toLowerCase()));
}
