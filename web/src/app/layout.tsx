import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Header, Runtime, SaveToast, TabBar } from "@/components/chrome";
import { TripSync } from "@/components/trip-sync";
import { CookieBanner } from "@/components/cookie-banner";
import { SITE_URL } from "@/lib/env";
import { OPEN_GRAPH } from "@/lib/meta";
import { THEME_BOOT } from "@/lib/theme";

// Eén lettertype voor koppen, tekst en cijfers (zie docs/stijlgids.md §4)
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VrijStaan: camperplaatsen in Nederland", template: "%s | VrijStaan" },
  description:
    "Camperplaatsen in Nederland met vertrektijd, prijs en voorzieningen. Zoek op plaats of kijk wat er bij jou in de buurt is.",
  applicationName: "VrijStaan",
  appleWebApp: { capable: true, title: "VrijStaan", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: OPEN_GRAPH,
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffcf6" },
    { media: "(prefers-color-scheme: dark)", color: "#18201b" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme zet het script in <head> vóór de eerste weergave (avondmodus, lib/theme.ts); React ziet dat verschil niet als fout
    <html lang="nl" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Header />
        <div id="inhoud" className="flex flex-1 flex-col">
          {children}
        </div>
        <TabBar />
        <SaveToast />
        <CookieBanner />
        <Runtime />
        <TripSync />
      </body>
    </html>
  );
}
