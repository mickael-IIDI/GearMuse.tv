import { and, asc, eq, inArray, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { creators, importBatches, sources, videos } from "@/db/schema";
import { classify } from "@/lib/taxonomy/classifier";
import { CURATED_CHANNELS, HN_DISCOVERY_QUERIES, REDDIT_SUBREDDITS } from "@/lib/taxonomy/sources";
import { editDistance, normalize, parseYouTubeId } from "@/lib/text";
import { getSetting } from "@/server/settings";
import { hnCommentDiscovery, hnItemUrl, hnMentionsOf, hnYouTubeStories } from "./hn";
import { pMap } from "./http";
import { analyzeVideos, consoleLogger, enrichVideos, registerCandidate, scoreVideos, type Logger } from "./pipeline";
import { redditEnabled, redditTopVideos } from "./reddit";
import { channelIdsByName } from "./wikidata";
import { apiChannels, apiPlaylistVideoIds, channelFeed, youtubeApiEnabled } from "./youtube";

/** Pré-filtre peu coûteux sur un titre avant toute requête vers YouTube. */
function plausiblyInScope(title: string, hint?: string | null): boolean {
  const r = classify({ title, evidenceTitles: [title], universeHint: hint ?? null });
  return Math.max(...Object.values(r.universeScores)) >= 2.5;
}

/* ------------------------------------------------------------------ */
/* Sources : chaînes spécialisées (Wikidata → vérification RSS)        */
/* ------------------------------------------------------------------ */

export async function resolveCuratedSources(log: Logger = consoleLogger) {
  const db = await getDb();
  const found = await channelIdsByName(CURATED_CHANNELS.map((c) => c.name));
  for (const seed of CURATED_CHANNELS) {
    const candidates = found.get(seed.name) ?? [];
    let verified: { channelId: string; wikidataId: string; title: string } | null = null;
    for (const cand of candidates) {
      const feed = await channelFeed(cand.channelId);
      if (!feed) continue;
      const a = normalize(feed.title);
      const b = normalize(seed.name);
      if (a === b || a.includes(b) || b.includes(a) || editDistance(a, b, 3) <= 2) {
        verified = { ...cand, title: feed.title };
        break;
      }
      await log.warn(`Chaîne ${seed.name} : le flux ${cand.channelId} porte le titre « ${feed.title} », ignoré`);
    }
    if (!verified) {
      log.stat("sources_unverified");
      await log.warn(`Chaîne non vérifiée, ignorée : ${seed.name}`);
      continue;
    }
    await db
      .insert(sources)
      .values({
        type: "youtube_channel",
        name: verified.title,
        config: { channelId: verified.channelId, wikidataId: verified.wikidataId },
        universeHint: seed.universe,
        trustLevel: seed.trust,
        isOfficial: seed.official ?? false,
        verifiedAt: new Date(),
      })
      .onConflictDoUpdate({ target: [sources.type, sources.name], set: { config: { channelId: verified.channelId, wikidataId: verified.wikidataId }, verifiedAt: new Date(), updatedAt: new Date() } });
    const key = `yt:channel:${verified.channelId}`;
    await db
      .insert(creators)
      .values({ key, channelId: verified.channelId, name: verified.title, url: `https://www.youtube.com/channel/${verified.channelId}`, isCuratedSource: true, isOfficial: seed.official ?? false, trustLevel: seed.trust })
      .onConflictDoUpdate({ target: creators.key, set: { isCuratedSource: true, isOfficial: seed.official ?? false, trustLevel: seed.trust, updatedAt: new Date() } });
    log.stat("sources_verified");
  }
  // Requêtes HN et subreddits (configurables ensuite depuis l'administration)
  for (const q of HN_DISCOVERY_QUERIES) {
    await db.insert(sources).values({ type: "hn_query", name: `HN : youtube + ${q.query}`, config: { query: q.query }, universeHint: q.universe, trustLevel: 60 }).onConflictDoNothing();
  }
  await db.insert(sources).values({ type: "hn_youtube_index", name: "Hacker News : stories liant YouTube", config: {}, trustLevel: 70 }).onConflictDoNothing();
  for (const r of REDDIT_SUBREDDITS) {
    await db.insert(sources).values({ type: "reddit_subreddit", name: `r/${r.name}`, config: { subreddit: r.name }, universeHint: r.universe, trustLevel: 55, enabled: redditEnabled() }).onConflictDoNothing();
  }
}

/* ------------------------------------------------------------------ */
/* Découverte : flux RSS des chaînes suivies                           */
/* ------------------------------------------------------------------ */

/**
 * @param opts.backfillPages pages de 50 vidéos à remonter par chaîne (clé API requise)
 * @param opts.pagesByUniverse profondeur spécifique par univers indicatif (ex. { moto: 10 }) pour cibler les univers sous-représentés
 */
export async function discoverChannelFeeds(log: Logger = consoleLogger, opts: { backfillPages?: number; pagesByUniverse?: Record<string, number> } = {}) {
  const db = await getDb();
  const list = await db.select().from(sources).where(and(eq(sources.type, "youtube_channel"), eq(sources.enabled, true)));
  for (const src of list) {
    const channelId = String(src.config.channelId ?? "");
    try {
      const feed = await channelFeed(channelId);
      if (!feed) throw new Error("flux indisponible");
      let n = 0;
      for (const e of feed.entries) {
        if (e.isShort) {
          log.stat("shorts_skipped");
          continue;
        }
        const r = await registerCandidate(db, {
          externalId: e.videoId,
          title: e.title,
          description: e.description,
          publishedAt: e.publishedAt,
          thumbnailUrl: e.thumbnailUrl,
          viewCount: e.views,
          likeCount: e.likes,
          channel: { channelId: e.channelId, name: e.authorName || feed.title },
          metadataSource: "rss",
          source: { type: "youtube_channel_rss", ref: channelId, url: `https://www.youtube.com/channel/${channelId}`, title: feed.title, sourceId: src.id },
          evidence: [
            {
              kind: src.isOfficial ? "official_channel" : "curated_channel",
              sourceType: "youtube_channel_rss",
              sourceName: feed.title,
              externalRef: `channel:${channelId}`,
              url: `https://www.youtube.com/channel/${channelId}`,
              occurredAt: e.publishedAt,
              independenceKey: `channel:${channelId}`,
            },
          ],
        });
        if (r.created) n++;
      }
      // Avec une clé API : remontée du catalogue complet de la chaîne (1 unité par page de 50).
      const pages = (src.universeHint ? opts.pagesByUniverse?.[src.universeHint] : undefined) ?? opts.backfillPages ?? 0;
      if (youtubeApiEnabled() && pages > 0) {
        const [ch] = await apiChannels({ ids: [channelId] });
        if (ch?.uploadsPlaylistId) {
          for (const vid of await apiPlaylistVideoIds(ch.uploadsPlaylistId, pages)) {
            const r = await registerCandidate(db, {
              externalId: vid,
              channel: { channelId, name: feed.title },
              source: { type: "youtube_api_channel", ref: channelId, title: feed.title, sourceId: src.id },
              evidence: [{ kind: src.isOfficial ? "official_channel" : "curated_channel", sourceType: "youtube_api_channel", sourceName: feed.title, externalRef: `channel:${channelId}`, independenceKey: `channel:${channelId}` }],
            });
            if (r.created) n++;
          }
        }
      }
      await db.update(sources).set({ lastRunAt: new Date(), lastStatus: "ok", lastError: null, itemsFound: sql`${sources.itemsFound} + ${n}` }).where(eq(sources.id, src.id));
      log.stat("candidates_rss", n);
    } catch (e) {
      log.stat("errors");
      await db.update(sources).set({ lastRunAt: new Date(), lastStatus: "error", lastError: String(e).slice(0, 500) }).where(eq(sources.id, src.id));
      await log.warn(`Flux en échec : ${src.name}`, { error: String(e) });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Découverte : Hacker News                                            */
/* ------------------------------------------------------------------ */

export async function discoverHnStories(log: Logger = consoleLogger, opts: { fromYear?: number; toYear?: number; minPoints?: number } = {}) {
  const db = await getDb();
  const cfg = await getSetting("ingestion");
  const fromYear = opts.fromYear ?? cfg.hnFromYear;
  const toYear = opts.toYear ?? new Date().getUTCFullYear();
  const src = await db.query.sources.findFirst({ where: eq(sources.type, "hn_youtube_index") });
  let created = 0;
  for (let y = fromYear; y <= toYear; y++) {
    const stories = await hnYouTubeStories({ from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)), minPoints: opts.minPoints ?? cfg.hnMinPoints });
    let kept = 0;
    for (const s of stories) {
      if (!plausiblyInScope(s.title)) continue;
      kept++;
      const r = await registerCandidate(db, {
        externalId: s.videoId,
        source: { type: "hackernews", ref: `story:${s.storyId}`, url: hnItemUrl(s.storyId), title: s.title, sourceId: src?.id ?? null, payload: { points: s.points, comments: s.comments } },
        evidence: [
          {
            kind: "community_upvote",
            sourceType: "hackernews",
            sourceName: "Hacker News",
            externalRef: `story:${s.storyId}`,
            url: hnItemUrl(s.storyId),
            title: s.title,
            author: s.author,
            points: s.points,
            commentsCount: s.comments,
            occurredAt: s.createdAt,
            independenceKey: `hn:user:${s.author.toLowerCase()}`,
          },
        ],
      });
      if (r.created) created++;
    }
    await log.info(`HN ${y} : ${stories.length} stories YouTube, ${kept} plausiblement dans le périmètre`);
    log.stat("hn_stories_seen", stories.length);
    log.stat("hn_stories_kept", kept);
  }
  log.stat("candidates_hn", created);
  if (src) await db.update(sources).set({ lastRunAt: new Date(), lastStatus: "ok", itemsFound: sql`${sources.itemsFound} + ${created}` }).where(eq(sources.id, src.id));
}

/** Recherche, pour les vidéos du périmètre, les commentaires HN qui les citent (recommandeurs distincts). */
export async function discoverHnMentions(log: Logger = consoleLogger, opts: { limit?: number; olderThanDays?: number } = {}) {
  const db = await getDb();
  const cutoff = new Date(Date.now() - (opts.olderThanDays ?? 30) * 86400e3);
  const list = await db
    .select({ id: videos.id, externalId: videos.externalId })
    .from(videos)
    .where(and(inArray(videos.status, ["published", "pending_review", "discovered"]), or(isNull(videos.mentionsCheckedAt), lt(videos.mentionsCheckedAt, cutoff)), sql`${videos.searchEntities} <> ''`))
    .orderBy(asc(videos.mentionsCheckedAt))
    .limit(opts.limit ?? 1500);
  await log.info(`Recherche des mentions HN pour ${list.length} vidéo(s)`);
  await pMap(
    list,
    async (v) => {
      try {
        const mentions = await hnMentionsOf(v.externalId);
        if (mentions.length) {
          await registerCandidate(db, {
            externalId: v.externalId,
            source: { type: "hackernews", ref: `mentions:${v.externalId}` },
            evidence: mentions.map((m) => ({
              kind: "community_comment" as const,
              sourceType: "hackernews" as const,
              sourceName: "Hacker News",
              externalRef: `comment:${m.commentId}`,
              url: hnItemUrl(m.commentId),
              title: m.storyTitle,
              author: m.author,
              excerpt: m.excerpt,
              occurredAt: m.createdAt,
              independenceKey: `hn:user:${m.author.toLowerCase()}`,
            })),
          });
          log.stat("mentions_found", mentions.length);
        }
        await db.update(videos).set({ mentionsCheckedAt: new Date() }).where(eq(videos.id, v.id));
      } catch (e) {
        log.stat("errors");
        await log.warn(`Mentions HN en échec pour ${v.externalId}`, { error: String(e) });
      }
    },
    3,
  );
}

/** Découverte dans les commentaires HN (« youtube » + terme). Seuil de recommandeurs distincts configurable. */
export async function discoverHnComments(log: Logger = consoleLogger, opts: { queries?: string[] } = {}) {
  const db = await getDb();
  const cfg = await getSetting("ingestion");
  const srcRows = await db.select().from(sources).where(and(eq(sources.type, "hn_query"), eq(sources.enabled, true)));
  const queries = opts.queries ?? srcRows.map((s) => String(s.config.query));
  const byVideo = new Map<string, Awaited<ReturnType<typeof hnCommentDiscovery>>>();
  for (const q of queries) {
    try {
      const mentions = await hnCommentDiscovery(q);
      for (const m of mentions) byVideo.set(m.videoId, [...(byVideo.get(m.videoId) ?? []), m]);
      log.stat("hn_comment_queries");
    } catch (e) {
      await log.warn(`Requête HN en échec : ${q}`, { error: String(e) });
    }
  }
  const existing = new Set(
    (await db.select({ e: videos.externalId }).from(videos).where(inArray(videos.externalId, [...byVideo.keys()].length ? [...byVideo.keys()] : ["-"]))).map((r) => r.e),
  );
  let created = 0;
  for (const [videoId, list] of byVideo) {
    const authors = new Set(list.map((m) => m.author.toLowerCase()));
    if (authors.size < cfg.commentDiscoveryMinAuthors && !existing.has(videoId)) continue;
    const seen = new Set<string>();
    const r = await registerCandidate(db, {
      externalId: videoId,
      source: { type: "hackernews", ref: `comments:${videoId}` },
      evidence: list
        .filter((m) => (seen.has(m.commentId) ? false : (seen.add(m.commentId), true)))
        .map((m) => ({
          kind: "community_comment" as const,
          sourceType: "hackernews" as const,
          sourceName: "Hacker News",
          externalRef: `comment:${m.commentId}`,
          url: hnItemUrl(m.commentId),
          title: m.storyTitle,
          author: m.author,
          excerpt: m.excerpt,
          occurredAt: m.createdAt,
          independenceKey: `hn:user:${m.author.toLowerCase()}`,
        })),
    });
    if (r.created) created++;
  }
  log.stat("candidates_hn_comments", created);
  await log.info(`Commentaires HN : ${byVideo.size} vidéos citées, ${created} nouvelles candidates`);
}

/* ------------------------------------------------------------------ */
/* Découverte : Reddit (OAuth)                                         */
/* ------------------------------------------------------------------ */

export async function discoverReddit(log: Logger = consoleLogger) {
  if (!redditEnabled()) {
    await log.info("Reddit non configuré : étape ignorée (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)");
    return;
  }
  const db = await getDb();
  const list = await db.select().from(sources).where(and(eq(sources.type, "reddit_subreddit"), eq(sources.enabled, true)));
  for (const src of list) {
    try {
      const posts = await redditTopVideos(String(src.config.subreddit), "all", 100);
      let n = 0;
      for (const p of posts) {
        if (!plausiblyInScope(p.title, src.universeHint)) continue;
        const r = await registerCandidate(db, {
          externalId: p.videoId,
          source: { type: "reddit", ref: `post:${p.postId}`, url: p.permalink, title: p.title, sourceId: src.id },
          evidence: [{ kind: "community_upvote", sourceType: "reddit", sourceName: `r/${p.subreddit}`, externalRef: `post:${p.postId}`, url: p.permalink, title: p.title, author: p.author, points: p.score, commentsCount: p.comments, occurredAt: p.createdAt, independenceKey: `reddit:user:${p.author.toLowerCase()}` }],
        });
        if (r.created) n++;
      }
      await db.update(sources).set({ lastRunAt: new Date(), lastStatus: "ok", itemsFound: sql`${sources.itemsFound} + ${n}` }).where(eq(sources.id, src.id));
      log.stat("candidates_reddit", n);
    } catch (e) {
      await db.update(sources).set({ lastRunAt: new Date(), lastStatus: "error", lastError: String(e).slice(0, 500) }).where(eq(sources.id, src.id));
      await log.warn(`Reddit en échec : ${src.name}`, { error: String(e) });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Import manuel (administration)                                      */
/* ------------------------------------------------------------------ */

export async function importUrls(
  input: string[],
  opts: { label: string; adminUserId?: number | null; editorialPick?: boolean; note?: string; log?: Logger } = { label: "Import manuel" },
) {
  const db = await getDb();
  const log = opts.log ?? consoleLogger;
  const ids = [...new Set(input.map((u) => parseYouTubeId(u)).filter((x): x is string => Boolean(x)))];
  const invalid = input.filter((u) => u.trim() && !parseYouTubeId(u));
  const [batch] = await db
    .insert(importBatches)
    .values({ kind: input.length > 1 ? "bulk" : "manual_url", label: opts.label, createdBy: opts.adminUserId ?? null, status: "running", total: input.filter((u) => u.trim()).length })
    .returning();
  const videoIds: number[] = [];
  for (const id of ids) {
    const r = await registerCandidate(db, {
      externalId: id,
      source: { type: "manual_import", ref: `batch:${batch.id}`, title: opts.label },
      evidence: opts.editorialPick
        ? [{ kind: "editorial_pick", sourceType: "editorial", sourceName: "Rédaction", externalRef: `batch:${batch.id}`, excerpt: opts.note ?? null, occurredAt: new Date(), independenceKey: "editorial" }]
        : [],
    });
    videoIds.push(r.id);
  }
  if (opts.editorialPick && videoIds.length) await db.update(videos).set({ editorialPick: true }).where(inArray(videos.id, videoIds));
  await enrichVideos({ videoIds, log });
  await analyzeVideos({ videoIds, log });
  await scoreVideos({ videoIds, log });
  const result = await db.select({ id: videos.id, externalId: videos.externalId, title: videos.title, status: videos.status, statusReason: videos.statusReason, score: videos.qualityScore }).from(videos).where(inArray(videos.id, videoIds.length ? videoIds : [-1]));
  const failed = result.filter((r) => r.status === "unavailable" || !r.title);
  await db
    .update(importBatches)
    .set({
      status: "succeeded",
      succeeded: result.length - failed.length,
      failed: failed.length + invalid.length,
      details: { errors: [...invalid.map((i) => ({ item: i, error: "URL ou identifiant YouTube invalide" })), ...failed.map((f) => ({ item: f.externalId, error: f.statusReason ?? "Indisponible" }))] },
      finishedAt: new Date(),
    })
    .where(eq(importBatches.id, batch.id));
  return { batchId: batch.id, result, invalid };
}

export const _internal = { plausiblyInScope, notInArray };
