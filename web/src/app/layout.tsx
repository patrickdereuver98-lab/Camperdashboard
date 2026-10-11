import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Overpass } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Header, Runtime, SaveToast, TabBar } from "@/components/chrome";
import { CookieBanner } from "@/components/cookie-banner";
import { SITE_URL } from "@/lib/env";

const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });
const overpass = Overpass({ variable: "--font-overpass", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "VrijStaan: camperplaatsen in Nederland", template: "%s | VrijStaan" },
  description:
    "Vind een camperplaats in Nederland met gecontroleerde prijzen, voorzieningen, foto's en reviews. Plan je route met echte rijtijden.",
  applicationName: "VrijStaan",
  appleWebApp: { capable: true, title: "VrijStaan", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", locale: "nl_NL", siteName: "VrijStaan" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#152238" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nl" className={`${atkinson.variable} ${overpass.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <div id="inhoud" className="flex flex-1 flex-col">
          {children}
        </div>
        <TabBar />
        <SaveToast />
        <CookieBanner />
        <Runtime />
      </body>
    </html>
  );
}
