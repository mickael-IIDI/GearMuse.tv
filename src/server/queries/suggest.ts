import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { normalize } from "@/lib/text";

export type Suggestion = { type: "category" | "subcategory" | "brand" | "model" | "video" | "query"; label: string; sub?: string; href: string };

/** Autocomplétion : univers, sous-catégories, marques, modèles puis titres de vidéos (préfixe + trigrammes). */
export async function suggest(q: string, locale: string): Promise<Suggestion[]> {
  const n = normalize(q);
  if (n.length < 2) return [];
  const db = await getDb();
  const like = `%${n}%`;
  const prefix = `${n}%`;
  const en = locale === "en";
  const lab = (l: { fr: string; en?: string }) => (en && l.en) || l.fr;
  const out: Suggestion[] = [];
  const cats = rows<{ slug: string; kind: string; labels: { fr: string; en?: string } }>(
    await db.execute(sql`select slug, kind, labels from categories where is_active and video_count > 0 and (translate(lower(labels->>'fr'), 'àâäáãéèêëíîïóôöõúùûüçœ', 'aaaaaeeeeiiiooooouuuuco') like ${like} or lower(labels->>'en') like ${like}) order by video_count desc limit 3`),
  ).map((c) => ({
    type: "category" as const,
    label: lab(c.labels),
    sub: c.kind === "universe" ? (en ? "Universe" : "Univers") : c.kind === "theme" ? (en ? "Theme" : "Thème") : c.kind === "format" ? "Format" : (en ? "Technology" : "Technologie"),
    href: c.kind === "universe" ? `/univers/${c.slug}` : c.kind === "theme" ? `/themes/${c.slug}` : c.kind === "format" ? `/videos?format=${c.slug.replace("format-", "")}` : `/technologies/${c.slug.replace("techno-", "")}`,
  }));
  out.push(...cats);
  const subs = rows<{ slug: string; labels: { fr: string; en?: string }; u: string }>(
    await db.execute(sql`select s.slug, s.labels, c.slug as u from subcategories s join categories c on c.id = s.category_id where s.is_active and s.video_count > 0 and (translate(lower(s.labels->>'fr'), 'àâäáãéèêëíîïóôöõúùûüçœ', 'aaaaaeeeeiiiooooouuuuco') like ${like} or lower(s.labels->>'en') like ${like}) order by s.video_count desc limit 3`),
  );
  out.push(...subs.map((s) => ({ type: "subcategory" as const, label: lab(s.labels), sub: en ? "Category" : "Catégorie", href: `/univers/${s.u}/${s.slug}` })));
  const brands = rows<{ slug: string; name: string }>(
    await db.execute(sql`select slug, name from brands where is_active and video_count > 0 and (lower(name) like ${prefix} or exists (select 1 from unnest(aliases) a where a like ${prefix})) order by video_count desc limit 3`),
  );
  out.push(...brands.map((b) => ({ type: "brand" as const, label: b.name, sub: en ? "Brand" : "Marque", href: `/marques/${b.slug}` })));
  const models = rows<{ slug: string; name: string; b: string }>(
    await db.execute(sql`select m.slug, m.name, b.slug as b from vehicle_models m join brands b on b.id = m.brand_id where m.is_active and m.video_count > 0 and (lower(m.name) like ${like} or exists (select 1 from unnest(m.aliases) a where a like ${prefix})) order by m.video_count desc limit 3`),
  );
  out.push(...models.map((m) => ({ type: "model" as const, label: m.name, sub: en ? "Model" : "Modèle", href: `/marques/${m.b}/${m.slug}` })));
  const vids = rows<{ slug: string; title: string }>(
    await db.execute(sql`select slug, title from videos where status = 'published' and (search_title like ${like} or similarity(search_title, ${n}) > 0.3) order by (search_title like ${prefix}) desc, similarity(search_title, ${n}) desc, quality_score desc nulls last limit 5`),
  );
  out.push(...vids.map((v) => ({ type: "video" as const, label: v.title, sub: en ? "Video" : "Vidéo", href: `/video/${v.slug}` })));
  const first: Suggestion = { type: "query", label: q.trim(), href: `/recherche?q=${encodeURIComponent(q.trim())}` };
  return [first, ...out].slice(0, 12);
}
