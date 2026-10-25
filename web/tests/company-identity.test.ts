// De juridische pagina's tonen geen "[… nog invullen]" meer, en verzinnen nooit bedrijfsgegevens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = ["voorwaarden", "disclaimer", "privacy"].map((p) => [p, readFileSync(`src/app/(site)/${p}/page.tsx`, "utf8")] as const);

test("juridische pagina's gebruiken CompanyIdentity en geen losse plaatshouders", () => {
  for (const [name, src] of pages) {
    assert.ok(src.includes("CompanyIdentity"), `${name} gebruikt CompanyIdentity`);
    assert.ok(!/company\("(name|kvk|vat|phone)"\)[^}]*nog invullen/.test(src), `${name} heeft geen losse plaatshouder`);
  }
});

test("CompanyIdentity zegt eerlijk dat het een hobbyproject is zolang de naam ontbreekt", () => {
  const src = readFileSync("src/components/company-identity.tsx", "utf8");
  assert.ok(src.includes("hobbyproject in beta"));
  assert.ok(src.includes("!COMPANY.name"));
  // Geen verzonnen gegevens in de component zelf
  assert.ok(!/KvK-nummer\s*\d/.test(src));
});

test("voorwaarden toont KvK-, btw- en telefoonregels alleen als ze zijn ingevuld", () => {
  const src = pages[0][1];
  assert.ok(src.includes("COMPANY.kvk &&"));
  assert.ok(src.includes("COMPANY.vat &&"));
  assert.ok(src.includes("COMPANY.phone &&"));
});
