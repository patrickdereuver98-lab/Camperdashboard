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
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
