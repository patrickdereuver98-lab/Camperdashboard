import { Footer } from "@/components/footer";
import { Icon } from "@/components/icons";
import { getSettings } from "@/lib/places";

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
      <Announcement />
      {/* Minstens één scherm hoog: bij Partial Prerender staat eerst alleen de schil (header en footer) en komt de inhoud
          later binnen. Zonder deze hoogte staat de footer even in beeld en springt hij weg (CLS 0,10 op zoeken en 0,15 op
          de plekpagina, gemeten op een trage telefoon, audit 1 november 2026). */}
      <main className="min-h-dvh flex-1">{children}</main>
      <Footer />
    </>
  );
}
