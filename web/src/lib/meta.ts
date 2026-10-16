import type { Metadata } from "next";

// Een pagina die zelf `openGraph` zet, vervangt het hele blok uit de layout. Spreid daarom deze basis erin,
// anders verdwijnen de deelafbeelding, de taal en de sitenaam.
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "VrijStaan: camperplaatsen in Nederland met vertrektijd, prijs en voorzieningen",
};

export const OPEN_GRAPH = {
  type: "website",
  locale: "nl_NL",
  siteName: "VrijStaan",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];
