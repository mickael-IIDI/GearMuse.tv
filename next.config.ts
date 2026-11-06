import type { NextConfig } from "next";

/**
 * Politique de sécurité du contenu : seuls YouTube (lecteur, API iframe) et ses
 * miniatures sont autorisés en tiers. Ajustez si vous ajoutez un service.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://i.ytimg.com https://*.ytimg.com https://*.ggpht.com",
  "font-src 'self' data:",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
  "connect-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Domaine canonique (même règle que resolveSiteUrl dans src/config/site.ts) :
 * NEXT_PUBLIC_SITE_URL, sinon https://gearmuse.tv pour un build de production.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://gearmuse.tv" : "http://localhost:3000")).replace(/\/+$/, "");
const canonicalHost = new URL(siteUrl).hostname;
const isPublicDomain = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(canonicalHost);
const hostPattern = (host: string) => host.replace(/\./g, "\\.");

const nextConfig: NextConfig = {
  /**
   * www.gearmuse.tv → gearmuse.tv (301/308). Ne s'applique qu'au domaine public ; si le domaine
   * canonique choisi est lui-même en www, aucune redirection n'est ajoutée.
   */
  async redirects() {
    if (!isPublicDomain || canonicalHost.startsWith("www.")) return [];
    return [{ source: "/:path*", has: [{ type: "host", value: hostPattern(`www.${canonicalHost}`) }], destination: `${siteUrl}/:path*`, permanent: true }];
  },
  // Modèle de cache classique (sans Cache Components) : rendu dynamique et cache HTTP explicite.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      // Toute autre adresse que le domaine canonique (ex. projet.vercel.app) n'est pas indexée : pas de contenu dupliqué.
      ...(isPublicDomain
        ? [{ source: "/:path*", missing: [{ type: "host" as const, value: hostPattern(canonicalHost) }], headers: [{ key: "X-Robots-Tag", value: "noindex" }] }]
        : []),
    ];
  },
};

export default nextConfig;
