/**
 * Configuration de marque. Le nom, le domaine et les coordonnées restent
 * surchargeables par variables d'environnement (voir .env.example).
 */

/** Domaine de production (acheté par le propriétaire le 6 novembre 2026). */
export const PRODUCTION_URL = "https://gearmuse.tv";

/**
 * URL publique canonique : NEXT_PUBLIC_SITE_URL si elle est définie, sinon le domaine de production
 * pour un build de production (y compris les prévisualisations, dont les pages pointent ainsi vers
 * le site officiel), et le serveur local en développement.
 */
export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string }): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || (env.NODE_ENV === "production" ? PRODUCTION_URL : "http://localhost:3000");
  return raw.trim().replace(/\/+$/, "");
}

// Références explicites : Next.js n'injecte dans le code client que les accès littéraux à process.env.X.
const url = resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL, NODE_ENV: process.env.NODE_ENV });

export const siteConfig = {
  /** Nom de la marque — variable PROJECT_NAME. */
  name: process.env.NEXT_PUBLIC_PROJECT_NAME || process.env.PROJECT_NAME || "GearMuse",
  /** Accroche affichée dans l'en-tête et les métadonnées. */
  tagline:
    process.env.NEXT_PUBLIC_PROJECT_TAGLINE ||
    "Les meilleures vidéos sur les véhicules motorisés, sélectionnées pour leur valeur",
  /** URL publique canonique (sans slash final). */
  url,
  /** Nom d'hôte affiché (ex. « gearmuse.tv »). */
  domain: new URL(url).host,
  /** Contact éditorial / signalements. */
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  /** Éditeur du site pour les mentions légales. */
  publisher: process.env.NEXT_PUBLIC_PUBLISHER_NAME || "",
  /** Couleurs de la marque (identiques aux jetons du thème sombre). */
  colors: { background: "#0a0c0f", accent: "#ffb020" },
  defaultLocale: "fr" as const,
  locales: ["fr", "en"] as const,
};

/** URL présentée aux services tiers (agent HTTP) : le site public, même en développement local. */
export const publicReferenceUrl = /localhost|127\.0\.0\.1/.test(url) ? PRODUCTION_URL : url;

export type Locale = (typeof siteConfig.locales)[number];
