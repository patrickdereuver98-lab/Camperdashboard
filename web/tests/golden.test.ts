// Gouden set: de extractor tegen echte pagina's (dataplan november 2026, spoor 1.1; review R69).
// Elke gemelde parserfout wordt eerst een geval in tests/golden/gevallen.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extract } from "../supabase/functions/pipeline/extract";
import { GEVALLEN, type Geval } from "./golden/gevallen";
import { pagina } from "./golden/pagina";

type Uit = Record<string, unknown> & { price_extras?: { label: string; amount: number }[] };

function verschillen(g: Geval, r: Uit): string[] {
  const fout: string[] = [];
  if (g.vertrek !== undefined && (r.departure ?? null) !== g.vertrek) fout.push(`vertrek ${r.departure ?? "leeg"}, verwacht ${g.vertrek ?? "leeg"}`);
  if (g.tijd && r.checkout_until !== g.tijd) fout.push(`tijd ${r.checkout_until ?? "leeg"}, verwacht ${g.tijd}`);
  if (g.vertrekNiet && r.departure === g.vertrekNiet) fout.push(`vertrek ${r.departure}, mag niet`);
  if (g.aankomst && r.checkin_from !== g.aankomst) fout.push(`aankomst ${r.checkin_from ?? "leeg"}, verwacht ${g.aankomst}`);
  if (g.prijs !== undefined && (r.price_eur ?? null) !== g.prijs) fout.push(`prijs ${r.price_eur ?? "leeg"}, verwacht ${g.prijs ?? "leeg"}`);
  const extras = r.price_extras ?? [];
  for (const x of g.extrasWel ?? [])
    if (!extras.some((e) => e.label === x.label && e.amount === x.amount)) fout.push(`toeslag ${x.label} € ${x.amount} ontbreekt`);
  for (const x of g.extrasNiet ?? [])
    if (extras.some((e) => e.label === x.label && e.amount === x.amount)) fout.push(`toeslag ${x.label} € ${x.amount} hoort er niet`);
  if (g.lengte !== undefined && r.max_length_m !== g.lengte) fout.push(`lengte ${r.max_length_m ?? "leeg"}, verwacht ${g.lengte}`);
  if (g.nachten !== undefined && r.max_stay_nights !== g.nachten) fout.push(`nachten ${r.max_stay_nights ?? "leeg"}, verwacht ${g.nachten}`);
  return fout;
}

for (const g of GEVALLEN) {
  test(`gouden set: ${g.naam}`, g.todo ? { todo: g.todo } : {}, () => {
    const r = extract([pagina(g.naam)], new URL(g.url)) as Uit;
    assert.deepEqual(verschillen(g, r), [], g.url);
  });
}
