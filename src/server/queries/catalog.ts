import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { brands, categories, creators, playlists, recommendationEvidence, subcategories, vehicleModels, videos } from "@/db/schema";
import { idFromVideoSlug } from "@/lib/text";
import { toCard, type VideoCard } from "./videos";

export async function universes() {
  const db = await getDb();
  return db.select().from(categories).where(and(eq(categories.kind, "universe"), eq(categories.isActive, true))).orderBy(asc(categories.sortOrder));
}

export async function categoryTree() {
  const db = await getDb();
  const cats = await db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder));
  const subs = await db.select().from(subcategories).where(eq(subcategories.isActive, true)).orderBy(asc(subcategories.sortOrder));
  return {
    universes: cats.filter((c) => c.kind === "universe").map((u) => ({ ...u, subs: subs.filter((s) => s.categoryId === u.id) })),
    themes: cats.filter((c) => c.kind === "theme"),
    formats: cats.filter((c) => c.kind === "format"),
    technologies: cats.filter((c) => c.kind === "technology"),
  };
}

export async function getCategory(slug: string) {
  const db = await getDb();
  return db.query.categories.findFirst({ where: and(eq(categories.slug, slug), eq(categories.isActive, true)) });
}

export async function getSubcategory(universeSlug: string, subSlug: string) {
  const db = await getDb();
  const u = await getCategory(universeSlug);
  if (!u) return null;
  const s = await db.query.subcategories.findFirst({ where: and(eq(subcategories.categoryId, u.id), eq(subcategories.slug, subSlug)) });
  return s ? { universe: u, sub: s } : null;
}

export async function subcategoriesOf(categoryId: number) {
  const db = await getDb();
  return db.select().from(subcategories).where(and(eq(subcategories.categoryId, categoryId), eq(subcategories.isActive, true))).orderBy(desc(subcategories.videoCount), asc(subcategories.sortOrder));
}

export async function brandList(minVideos = 1) {
  const db = await getDb();
  return db.select().from(brands).where(and(eq(brands.isActive, true), sql`${brands.videoCount} >= ${minVideos}`)).orderBy(desc(brands.videoCount), asc(brands.name));
}

export async function getBrand(slug: string) {
  const db = await getDb();
  const b = await db.query.brands.findFirst({ where: eq(brands.slug, slug) });
  if (!b) return null;
  const models = await db.select().from(vehicleModels).where(and(eq(vehicleModels.brandId, b.id), sql`${vehicleModels.videoCount} > 0`)).orderBy(desc(vehicleModels.videoCount));
  return { brand: b, models };
}

export async function getModel(brandSlug: string, modelSlug: string) {
  const db = await getDb();
  const b = await db.query.brands.findFirst({ where: eq(brands.slug, brandSlug) });
  if (!b) return null;
  const m = await db.query.vehicleModels.findFirst({ where: and(eq(vehicleModels.brandId, b.id), eq(vehicleModels.slug, modelSlug)) });
  return m ? { brand: b, model: m } : null;
}

export async function getCreator(id: number) {
  const db = await getDb();
  return db.query.creators.findFirst({ where: eq(creators.id, id) });
}

/* ------------------------------------------------------------------ */
/* Page vidéo                                                          */
/* ------------------------------------------------------------------ */

export async function getVideoPage(slug: string) {
  const db = await getDb();
  const ext = idFromVideoSlug(slug);
  if (!ext) return null;
  const v = await db.query.videos.findFirst({ where: eq(videos.externalId, ext) });
  if (!v || v.status === "excluded" || v.status === "rejected" || v.status === "discovered") return null;
  const card = toCard(
    rows<Record<string, unknown>>(
      await db.execute(sql`select v.*, cr.id as creator_id, cr.name as creator_name, cr.url as creator_url,
        (select json_build_object('slug', c.slug, 'labels', c.labels, 'color', c.color) from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.kind = 'universe' order by vc.is_primary desc limit 1) as universe,
        (select coalesce(json_agg(x), '[]'::json) from (select s.slug, s.labels, pc.slug as universe from video_subcategories vs join subcategories s on s.id = vs.subcategory_id join categories pc on pc.id = s.category_id where vs.video_id = v.id order by vs.confidence desc) x) as subs
        from videos v left join creators cr on cr.id = v.creator_id where v.id = ${v.id}`),
    )[0],
  );
  const cats = rows<{ slug: string; kind: string; labels: { fr: string; en?: string } }>(
    await db.execute(sql`select c.slug, c.kind, c.labels from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = ${v.id} order by vc.is_primary desc, vc.confidence desc`),
  );
  const tagList = rows<{ slug: string; labels: { fr: string } }>(await db.execute(sql`select t.slug, t.labels from video_tags vt join tags t on t.id = vt.tag_id where vt.video_id = ${v.id}`));
  const brandList = rows<{ slug: string; name: string }>(await db.execute(sql`select b.slug, b.name from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = ${v.id}`));
  const modelList = rows<{ slug: string; name: string; bslug: string }>(
    await db.execute(sql`select m.slug, m.name, b.slug as bslug from video_models vm join vehicle_models m on m.id = vm.model_id join brands b on b.id = m.brand_id where vm.video_id = ${v.id}`),
  );
  const evidence = await db.select().from(recommendationEvidence).where(eq(recommendationEvidence.videoId, v.id)).orderBy(desc(recommendationEvidence.points), asc(recommendationEvidence.occurredAt));
  const creator = v.creatorId ? await db.query.creators.findFirst({ where: eq(creators.id, v.creatorId) }) : null;
  return { video: v, card, categories: cats, tags: tagList, brands: brandList, models: modelList, evidence, creator };
}

/* ------------------------------------------------------------------ */
/* Playlists                                                           */
/* ------------------------------------------------------------------ */

export type PlaylistSummary = {
  id: number;
  slug: string;
  tier: string;
  titles: { fr: string; en?: string };
  pitches: { fr: string; en?: string } | null;
  count: number;
  minutes: number | null;
  covers: { thumbnailUrl: string | null; externalId: string }[];
};

export async function playlistSummaries(opts: { includeDrafts?: boolean; minItems?: number } = {}): Promise<PlaylistSummary[]> {
  const db = await getDb();
  const res = await db.execute(sql`
    select p.id, p.slug, p.tier, p.titles, p.pitches,
      (select count(*)::int from playlist_items pi join videos v on v.id = pi.video_id where pi.playlist_id = p.id and v.status = 'published') as count,
      (select (sum(v.duration_seconds) / 60)::int from playlist_items pi join videos v on v.id = pi.video_id where pi.playlist_id = p.id and v.status = 'published' having count(v.duration_seconds) = count(*)) as minutes,
      (select coalesce(json_agg(x), '[]'::json) from (select v.thumbnail_url as "thumbnailUrl", v.external_id as "externalId" from playlist_items pi join videos v on v.id = pi.video_id where pi.playlist_id = p.id and v.status = 'published' order by pi.position limit 4) x) as covers
    from playlists p ${opts.includeDrafts ? sql`` : sql`where p.status = 'published'`}
    order by p.tier, p.sort_order`);
  return rows<Record<string, unknown>>(res)
    .map((r) => ({
      id: Number(r.id),
      slug: String(r.slug),
      tier: String(r.tier),
      titles: (typeof r.titles === "string" ? JSON.parse(r.titles) : r.titles) as PlaylistSummary["titles"],
      pitches: (typeof r.pitches === "string" ? JSON.parse(r.pitches) : r.pitches) as PlaylistSummary["pitches"],
      count: Number(r.count),
      minutes: r.minutes == null ? null : Number(r.minutes),
      covers: (typeof r.covers === "string" ? JSON.parse(r.covers) : r.covers) as PlaylistSummary["covers"],
    }))
    .filter((p) => p.count >= (opts.minItems ?? 3));
}

export async function getPlaylist(slug: string, opts: { includeDrafts?: boolean } = {}) {
  const db = await getDb();
  const p = await db.query.playlists.findFirst({ where: eq(playlists.slug, slug) });
  if (!p || (p.status !== "published" && !opts.includeDrafts)) return null;
  const res = await db.execute(sql`
    select v.id, v.external_id, v.slug, v.title, v.published_at, v.duration_seconds, v.thumbnail_url, v.quality_score, v.score_confidence,
      v.editorial_pick, v.recommender_count, v.discovery_score, v.view_count, v.language, v.selection_reason, v.editorial_summary, v.availability, v.embeddable, v.primary_format,
      cr.id as creator_id, cr.name as creator_name, cr.url as creator_url, pi.note, pi.position,
      (select json_build_object('slug', c.slug, 'labels', c.labels, 'color', c.color) from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.kind = 'universe' order by vc.is_primary desc limit 1) as universe,
      '[]'::json as subs
    from playlist_items pi join videos v on v.id = pi.video_id left join creators cr on cr.id = v.creator_id
    where pi.playlist_id = ${p.id} and v.status = 'published' order by pi.position`);
  const items: VideoCard[] = rows<Record<string, unknown>>(res).map(toCard);
  return { playlist: p, items };
}
