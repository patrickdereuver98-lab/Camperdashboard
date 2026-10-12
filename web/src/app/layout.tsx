import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Header, Runtime, SaveToast, TabBar } from "@/components/chrome";
import { TripSync } from "@/components/trip-sync";
import { CookieBanner } from "@/components/cookie-banner";
import { SITE_URL } from "@/lib/env";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VrijStaan: camperplaatsen in Nederland", template: "%s | VrijStaan" },
  description:
    "Vind een camperplaats in Nederland met prijzen, voorzieningen en openingsperiode uit echte bronnen. Plan je route met echte rijtijden.",
  applicationName: "VrijStaan",
  appleWebApp: { capable: true, title: "VrijStaan", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "nl_NL", siteName: "VrijStaan" },
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
    <html lang="nl" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
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
