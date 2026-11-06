import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Icon } from "@/components/icons";
import { JsonLd } from "@/components/seo-ui";
import { SITE_URL } from "@/lib/env";
import { getSettings } from "@/lib/places";
import { siteLd } from "@/lib/seo-pages";

// Canonical "./" = het eigen adres zonder zoekparameters (Next.js vult het pad in). Zo heeft de startpagina een
// canonical en krijgt elke pagina zonder eigen canonical er een die naar zichzelf wijst, nooit naar de start.
export const metadata: Metadata = {
  alternates: { canonical: "./" },
};

/** WebSite en Organization (Schema.org) op elke publieke pagina */
async function SiteLd() {
  const { contact } = await getSettings();
  return <JsonLd data={siteLd(SITE_URL, contact.email || undefined)} />;
}

async function Announcement() {
  const { announcement } = await getSettings();
  if (!announcement.enabled || !announcement.text.trim()) return null;
  return (
    <div role="status" className="flex items-start justify-center gap-2 bg-ember px-4 py-2.5 text-center text-sm font-semibold text-on-ember">
      <Icon name="info" size={18} className="mt-px shrink-0" />
      {announcement.text}
    </div>
  );
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteLd />
      <Announcement />
      {/* Minstens één scherm hoog: bij Partial Prerender staat eerst alleen de schil (header en footer) en komt de inhoud
          later binnen. Zonder deze hoogte staat de footer even in beeld en springt hij weg (CLS 0,10 op zoeken en 0,15 op
          de plekpagina, gemeten op een trage telefoon, audit 1 november 2026). */}
      <main className="min-h-dvh flex-1">{children}</main>
      <Footer />
    </>
  );
}
