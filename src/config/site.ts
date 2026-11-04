/**
 * Configuration de marque. Le nom définitif, le domaine et les couleurs
 * restent configurables par variables d'environnement (voir .env.example).
 */
export const siteConfig = {
  /** Nom provisoire du projet — variable PROJECT_NAME. */
  name: process.env.NEXT_PUBLIC_PROJECT_NAME || process.env.PROJECT_NAME || "VehiCult",
  /** Accroche affichée dans l'en-tête et les métadonnées. */
  tagline:
    process.env.NEXT_PUBLIC_PROJECT_TAGLINE ||
    "Les meilleures vidéos sur les véhicules motorisés, sélectionnées pour leur valeur",
  /** URL publique canonique (sans slash final). */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** Contact éditorial / signalements. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /** Éditeur du site pour les mentions légales. */
  publisher: process.env.NEXT_PUBLIC_PUBLISHER_NAME || "",
  defaultLocale: "fr" as const,
  locales: ["fr", "en"] as const,
};

export type Locale = (typeof siteConfig.locales)[number];
