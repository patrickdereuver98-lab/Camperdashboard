# /brag-slim voor VrijStaan: huisregels

Deze skill komt ongewijzigd uit [latent-spaces/brag](https://github.com/latent-spaces/brag) (commit 669ab92, MIT,
Shunit Haviv Hakimi). Gebruik hem voor een eenmalige launch-video van VrijStaan, bijvoorbeeld bij een grote nieuwe
functie. Voor terugkerende filmpjes is er de Studio in het marketingdashboard (`/admin/marketing/studio`).

Bij een conflict gaan deze regels voor (CLAUDE.md, `docs/stijlgids.md`, skill `vrijstaan-stijl`):

1. **Taal en toon:** Nederlands, je-vorm, nuchter. Geen emoji, geen uitroeptekens, geen superlatieven, geen Engelse
   marketingwoorden. Toon-preset: `default` of `calm`, nooit "hype".
2. **Cijfers:** alleen uit de feitenbank (`public.marketing_facts()`, of het overzicht in `/admin/marketing`), met
   de datum erbij. Aantallen onder 50 noem je niet (bijvoorbeeld "plekken zonder vaste vertrektijd"): noem de functie.
3. **Huisstijl:** zandpapier `#f7eed9`, bosgroen `#1f4e37`, inkt `#1f2b24`, lettertype Geist
   (`web/public/fonts/Geist-Variable.woff2`). Tekst groot genoeg voor een telefoon zonder geluid.
4. **Echte app laten zien** via de live site (`https://vrijstaan.nl`) op telefoonformaat, zonder account. Nooit
   gegevens van echte gebruikers in beeld (Mijn reis, account, reviews met namen).
5. **Muziek:** de nummers uit /brag (Sascha Ende, ende.app) zijn CC BY 4.0: vermeld "Muziek: Sascha Ende, ende.app
   (CC BY 4.0)" in de deeltekst. Geen voice-over tenzij Patrick erom vraagt.
6. **Uitvoer:** `brag-output/` staat in `.gitignore`; de MP4 gaat via Bibliotheek of handmatig naar Patrick, niet in
   de repository.
