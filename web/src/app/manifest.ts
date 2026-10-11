import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VrijStaan: camperplaatsen in Nederland",
    short_name: "VrijStaan",
    description: "Vind een camperplaats in Nederland met gecontroleerde prijzen, voorzieningen en echte rijtijden.",
    start_url: "/?bron=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f4",
    theme_color: "#0f4c8a",
    lang: "nl",
    dir: "ltr",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Zoeken op de kaart", short_name: "Zoeken", url: "/zoeken" },
      { name: "Plekken dichtbij", short_name: "Dichtbij", url: "/dichtbij" },
      { name: "Mijn reis", url: "/mijn-reis" },
    ],
  };
}
