import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { SiteHeader, TabBar } from "@/components/site-nav";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "VrijStaan · Camperplaatsen in Nederland",
    template: "%s · VrijStaan",
  },
  description:
    "Vind een plek om met je camper te staan. Ruim 3.500 camperplaatsen in heel Nederland, met kaart, filters en een reisplanner.",
  applicationName: "VrijStaan",
  appleWebApp: { capable: true, title: "VrijStaan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#111713" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
