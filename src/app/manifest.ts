import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** Manifeste d'application web : installation sur l'écran d'accueil (icônes générées par npm run brand:generate). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${siteConfig.name} — vidéos sur les véhicules motorisés`,
    short_name: siteConfig.name,
    description: siteConfig.tagline,
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: siteConfig.colors.background,
    theme_color: siteConfig.colors.background,
    categories: ["entertainment", "education"],
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
