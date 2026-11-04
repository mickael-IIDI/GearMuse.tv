import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const allow = process.env.ALLOW_INDEXING !== "false";
  return {
    rules: allow
      ? [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/recherche", "/pour-vous", "/favoris", "/historique", "/a-regarder", "/parametres"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
