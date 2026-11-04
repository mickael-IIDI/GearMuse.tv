import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { playlistItems, playlists, type PlaylistRules } from "@/db/schema";
import { normalize } from "@/lib/text";

/** Sélectionne les vidéos publiées correspondant aux règles d'une playlist intelligente. */
export async function videosForRules(rules: PlaylistRules): Promise<number[]> {
  const db = await getDb();
  const conds: SQL[] = [sql`v.status = 'published'`];
  const catIn = (slugs: string[]) =>
    sql`exists (select 1 from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)}))`;
  if (rules.universes?.length) conds.push(catIn(rules.universes));
  if (rules.themes?.length) conds.push(catIn(rules.themes));
  if (rules.formats?.length) conds.push(catIn(rules.formats.map((f) => `format-${f}`)));
  if (rules.technologies?.length) conds.push(catIn(rules.technologies.map((f) => `techno-${f}`)));
  if (rules.subcategories?.length)
    conds.push(sql`exists (select 1 from video_subcategories vs join subcategories s on s.id = vs.subcategory_id where vs.video_id = v.id and s.slug in (${sql.join(rules.subcategories.map((s) => sql`${s}`), sql`, `)}))`);
  if (rules.brands?.length)
    conds.push(sql`exists (select 1 from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = v.id and b.slug in (${sql.join(rules.brands.map((s) => sql`${s}`), sql`, `)}))`);
  if (rules.keywords?.length) conds.push(sql`(${sql.join(rules.keywords.map((k) => sql`v.search_title like ${"%" + normalize(k) + "%"}`), sql` or `)})`);
  if (rules.minScore != null) conds.push(sql`coalesce(v.quality_score, 0) >= ${rules.minScore}`);
  if (rules.minDurationSeconds != null) conds.push(sql`v.duration_seconds >= ${rules.minDurationSeconds}`);
  const order =
    rules.order === "published_asc"
      ? sql`v.published_at asc nulls last, v.first_recommended_at asc nulls last`
      : rules.order === "published_desc"
        ? sql`v.published_at desc nulls last`
        : rules.order === "duration"
          ? sql`v.duration_seconds desc nulls last`
          : sql`v.quality_score desc nulls last, v.recommender_count desc`;
  const res = await db.execute(sql`select v.id from videos v where ${sql.join(conds, sql` and `)} order by ${order} limit ${rules.limit ?? 14}`);
  return rows<{ id: number }>(res).map((r) => Number(r.id));
}

/** Recalcule les playlists intelligentes. Les vidéos ajoutées ou épinglées par la rédaction sont conservées. */
export async function refreshSmartPlaylists() {
  const db = await getDb();
  const list = await db.select().from(playlists).where(eq(playlists.kind, "smart"));
  const out: Record<string, number> = {};
  for (const p of list) {
    if (!p.rules) continue;
    const ids = await videosForRules(p.rules);
    const kept = await db.select().from(playlistItems).where(and(eq(playlistItems.playlistId, p.id), sql`(${playlistItems.pinned} or ${playlistItems.addedBy} = 'editor')`));
    await db.delete(playlistItems).where(and(eq(playlistItems.playlistId, p.id), eq(playlistItems.pinned, false), eq(playlistItems.addedBy, "rule")));
    const keptIds = new Set(kept.map((k) => k.videoId));
    let pos = Math.max(0, ...kept.map((k) => k.position)) + 1;
    const values = ids.filter((id) => !keptIds.has(id)).map((videoId) => ({ playlistId: p.id, videoId, position: pos++, addedBy: "rule" as const }));
    if (values.length) await db.insert(playlistItems).values(values).onConflictDoNothing();
    const first = kept.sort((a, b) => a.position - b.position)[0]?.videoId ?? ids[0] ?? null;
    await db.update(playlists).set({ coverVideoId: first, updatedAt: new Date() }).where(eq(playlists.id, p.id));
    out[p.slug] = kept.length + values.length;
  }
  return out;
}

export async function reorderPlaylist(playlistId: number, orderedVideoIds: number[]) {
  const db = await getDb();
  for (const [i, videoId] of orderedVideoIds.entries()) {
    await db.update(playlistItems).set({ position: i + 1 }).where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
  }
}

export { inArray };
