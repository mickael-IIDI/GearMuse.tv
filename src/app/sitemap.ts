import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { siteConfig } from "@/config/site";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

/**
 * Plan du site : uniquement les pages utiles (vidéos publiées, catégories, marques
 * et playlists suffisamment fournies). Les pages trop pauvres sont exclues.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const db = await getDb();
  const statics = ["", "/videos", "/videos/longues", "/categories", "/technologies", "/decouvertes", "/mieux-notees", "/playlists", "/marques", "/a-propos"].map((p) => ({ url: `${base}${p}`, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.7 }));
  const vids = rows<{ slug: string; updated_at: string }>(await db.execute(sql`select slug, updated_at from videos where status = 'published' order by quality_score desc nulls last limit 45000`));
  const unis = rows<{ slug: string }>(await db.execute(sql`select slug from categories where kind = 'universe' and is_active`));
  const subs = rows<{ slug: string; u: string }>(await db.execute(sql`select s.slug, c.slug as u from subcategories s join categories c on c.id = s.category_id where s.video_count >= 3`));
  const themes = rows<{ slug: string; kind: string }>(await db.execute(sql`select slug, kind from categories where kind in ('theme', 'technology') and video_count >= 3`));
  const brands = rows<{ slug: string }>(await db.execute(sql`select slug from brands where video_count >= 3`));
  const models = rows<{ slug: string; b: string }>(await db.execute(sql`select m.slug, b.slug as b from vehicle_models m join brands b on b.id = m.brand_id where m.video_count >= 3`));
  const pls = rows<{ slug: string }>(await db.execute(sql`select p.slug from playlists p where p.status = 'published' and (select count(*) from playlist_items pi join videos v on v.id = pi.video_id where pi.playlist_id = p.id and v.status = 'published') >= 3`));
  return [
    ...statics,
    ...unis.map((u) => ({ url: `${base}/univers/${u.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...subs.map((s) => ({ url: `${base}/univers/${s.u}/${s.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...themes.map((t) => ({ url: t.kind === "theme" ? `${base}/themes/${t.slug}` : `${base}/technologies/${t.slug.replace("techno-", "")}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...brands.map((b) => ({ url: `${base}/marques/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...models.map((m) => ({ url: `${base}/marques/${m.b}/${m.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...pls.map((p) => ({ url: `${base}/playlists/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...vids.map((v) => ({ url: `${base}/video/${v.slug}`, lastModified: new Date(v.updated_at), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
