import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VrijStaan · Camperplaatsen in Nederland",
    short_name: "VrijStaan",
    description: "Vind een plek om met je camper te staan, in heel Nederland.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f0e6",
    theme_color: "#2d5a43",
    lang: "nl",
    categories: ["travel", "navigation", "lifestyle"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Zoeken", url: "/zoeken" },
      { name: "Dichtbij", url: "/dichtbij" },
      { name: "Mijn reis", url: "/mijn-reis" },
    ],
  };
}
