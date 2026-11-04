import { and, desc, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { getDb, type DB } from "@/db/client";
import {
  aiAnalysis,
  categories,
  creators,
  recommendationEvidence,
  sources,
  subcategories,
  tags,
  videoBrands,
  videoCategories,
  videoModels,
  videos,
  videoSources,
  videoSubcategories,
  videoTags,
  type AnalysisOutput,
  type EvidenceKind,
  type SourceType,
} from "@/db/schema";
import { classify, HEURISTIC_VERSION } from "@/lib/taxonomy/classifier";
import { guessLanguage, normalize, videoSlug } from "@/lib/text";
import { categoryIdMaps } from "@/server/catalog/seed";
import { buildSelectionReason, computeScore, decideStatus, type EvidenceLite } from "@/server/curation/score";
import { getSetting } from "@/server/settings";
import { createHash } from "node:crypto";
import { pMap } from "./http";
import { apiChannels, apiVideos, oembed, QuotaExceededError, youtubeApiEnabled } from "./youtube";
import { analyzeWithAi, aiEnabled } from "./ai";

export type Logger = {
  info: (msg: string, data?: Record<string, unknown>) => void | Promise<void>;
  warn: (msg: string, data?: Record<string, unknown>) => void | Promise<void>;
  error: (msg: string, data?: Record<string, unknown>) => void | Promise<void>;
  stat: (key: string, inc?: number) => void;
};

export const consoleLogger: Logger = {
  info: (m, d) => console.log(`[info] ${m}`, d ?? ""),
  warn: (m, d) => console.warn(`[warn] ${m}`, d ?? ""),
  error: (m, d) => console.error(`[error] ${m}`, d ?? ""),
  stat: () => {},
};

/* ------------------------------------------------------------------ */
/* Créateurs                                                           */
/* ------------------------------------------------------------------ */

export async function upsertCreator(db: DB, c: { channelId?: string | null; name: string; url?: string | null; handle?: string | null }): Promise<number> {
  const url = c.url ?? (c.channelId ? `https://www.youtube.com/channel/${c.channelId}` : null);
  const handle = c.handle ?? (url?.match(/youtube\.com\/(@[^/?#]+)/)?.[1] ?? null);
  if (c.channelId) {
    const key = `yt:channel:${c.channelId}`;
    const existing = await db.query.creators.findFirst({ where: or(eq(creators.key, key), eq(creators.channelId, c.channelId)) });
    if (existing) {
      if (handle && !existing.handle) await db.update(creators).set({ handle, updatedAt: new Date() }).where(eq(creators.id, existing.id));
      return existing.id;
    }
    // Une chaîne connue par son handle seulement : on la rattache à son identifiant.
    if (handle) {
      const byHandle = await db.query.creators.findFirst({ where: and(eq(creators.handle, handle), isNull(creators.channelId)) });
      if (byHandle) {
        await db.update(creators).set({ channelId: c.channelId, key, updatedAt: new Date() }).where(eq(creators.id, byHandle.id));
        return byHandle.id;
      }
    }
    const [row] = await db.insert(creators).values({ key, channelId: c.channelId, name: c.name, url, handle }).onConflictDoNothing().returning({ id: creators.id });
    if (row) return row.id;
    return (await db.query.creators.findFirst({ where: eq(creators.key, key) }))!.id;
  }
  // Sans identifiant de chaîne (oEmbed) : clé fondée sur l'URL publique.
  const key = `yt:url:${(url ?? c.name).toLowerCase()}`;
  const existing = await db.query.creators.findFirst({ where: or(eq(creators.key, key), handle ? eq(creators.handle, handle) : sql`false`) });
  if (existing) return existing.id;
  // Rapprochement prudent avec une chaîne suivie de nom identique (documenté dans docs/PIPELINE.md).
  const curated = await db.query.creators.findFirst({ where: and(eq(creators.name, c.name), eq(creators.isCuratedSource, true)) });
  if (curated) {
    if (handle && !curated.handle) await db.update(creators).set({ handle, updatedAt: new Date() }).where(eq(creators.id, curated.id));
    return curated.id;
  }
  const [row] = await db.insert(creators).values({ key, name: c.name, url, handle }).onConflictDoNothing().returning({ id: creators.id });
  if (row) return row.id;
  return (await db.query.creators.findFirst({ where: eq(creators.key, key) }))!.id;
}

/* ------------------------------------------------------------------ */
/* Étapes 1-2 : découverte et normalisation                            */
/* ------------------------------------------------------------------ */

export type EvidenceInput = {
  kind: EvidenceKind;
  sourceType: SourceType;
  sourceName: string;
  externalRef: string;
  url?: string | null;
  title?: string | null;
  author?: string | null;
  excerpt?: string | null;
  points?: number | null;
  commentsCount?: number | null;
  occurredAt?: Date | null;
  independenceKey: string;
  weight?: number;
};

export type Candidate = {
  externalId: string;
  title?: string;
  description?: string;
  publishedAt?: Date;
  thumbnailUrl?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  isShort?: boolean;
  channel?: { channelId?: string | null; name: string; url?: string | null };
  metadataSource?: "rss" | "oembed" | "manual";
  source: { type: SourceType; ref: string; url?: string | null; title?: string | null; sourceId?: number | null; payload?: Record<string, unknown> };
  evidence?: EvidenceInput[];
};

/** Enregistre une vidéo candidate, sa source et ses preuves. Déduplique par identifiant fournisseur. */
export async function registerCandidate(db: DB, c: Candidate): Promise<{ id: number; created: boolean }> {
  let creatorId: number | null = null;
  if (c.channel?.name) creatorId = await upsertCreator(db, c.channel);

  const existing = await db.query.videos.findFirst({ where: and(eq(videos.provider, "youtube"), eq(videos.externalId, c.externalId)) });
  let id: number;
  let created = false;
  if (!existing) {
    const title = c.title ?? "";
    const [row] = await db
      .insert(videos)
      .values({
        externalId: c.externalId,
        slug: title ? videoSlug(title, c.externalId) : c.externalId,
        title,
        description: c.description ?? null,
        publishedAt: c.publishedAt ?? null,
        thumbnailUrl: c.thumbnailUrl ?? null,
        viewCount: c.viewCount ?? null,
        likeCount: c.likeCount ?? null,
        statsUpdatedAt: c.viewCount != null ? new Date() : null,
        isShort: c.isShort ?? false,
        creatorId,
        metadataSource: c.metadataSource ?? null,
        metadataUpdatedAt: c.metadataSource ? new Date() : null,
        searchTitle: normalize(title),
      })
      .onConflictDoNothing()
      .returning({ id: videos.id });
    if (row) {
      id = row.id;
      created = true;
    } else {
      id = (await db.query.videos.findFirst({ where: eq(videos.externalId, c.externalId) }))!.id;
    }
  } else {
    id = existing.id;
    // Complète les champs manquants sans écraser des métadonnées plus complètes (API).
    const patch: Partial<typeof videos.$inferInsert> = {};
    if (!existing.title && c.title) {
      patch.title = c.title;
      patch.slug = videoSlug(c.title, c.externalId);
      patch.searchTitle = normalize(c.title);
    }
    if (!existing.description && c.description) patch.description = c.description;
    if (!existing.publishedAt && c.publishedAt) patch.publishedAt = c.publishedAt;
    if (!existing.creatorId && creatorId) patch.creatorId = creatorId;
    if (existing.metadataSource !== "youtube_api" && c.viewCount != null) {
      patch.viewCount = c.viewCount;
      patch.likeCount = c.likeCount ?? existing.likeCount;
      patch.statsUpdatedAt = new Date();
    }
    if (c.isShort && !existing.isShort) patch.isShort = true;
    if (!existing.metadataSource && c.metadataSource) {
      patch.metadataSource = c.metadataSource;
      patch.metadataUpdatedAt = new Date();
    }
    if (Object.keys(patch).length) await db.update(videos).set({ ...patch, needsReanalysis: true, updatedAt: new Date() }).where(eq(videos.id, id));
  }

  await db
    .insert(videoSources)
    .values({ videoId: id, sourceId: c.source.sourceId ?? null, sourceType: c.source.type, sourceRef: c.source.ref, url: c.source.url ?? null, title: c.source.title ?? null, payload: c.source.payload })
    .onConflictDoNothing();

  if (c.evidence?.length) {
    const inserted = await db
      .insert(recommendationEvidence)
      .values(c.evidence.map((e) => ({ videoId: id, ...e, weight: e.weight ?? 1 })))
      .onConflictDoNothing()
      .returning({ id: recommendationEvidence.id });
    if (inserted.length && !created) await db.update(videos).set({ needsReanalysis: true }).where(eq(videos.id, id));
  }
  return { id, created };
}

/* ------------------------------------------------------------------ */
/* Étapes 3-4 : enrichissement et vérification                         */
/* ------------------------------------------------------------------ */

export async function enrichVideos(opts: { videoIds?: number[]; limit?: number; force?: boolean; log?: Logger } = {}) {
  const db = await getDb();
  const log = opts.log ?? consoleLogger;
  const useApi = youtubeApiEnabled();
  const where = opts.videoIds?.length
    ? inArray(videos.id, opts.videoIds)
    : opts.force
      ? undefined
      : useApi
        ? and(or(isNull(videos.metadataSource), ne(videos.metadataSource, "youtube_api")), notInArray(videos.status, ["excluded"]))
        : and(or(isNull(videos.metadataSource), eq(videos.title, ""), and(isNull(videos.embeddable), isNull(videos.availabilityCheckedAt))), notInArray(videos.status, ["excluded", "unavailable"]));
  const list = await db.select({ id: videos.id, externalId: videos.externalId, title: videos.title, creatorId: videos.creatorId, status: videos.status, statusLocked: videos.statusLocked }).from(videos).where(where).limit(opts.limit ?? 2000);
  log.info(`Enrichissement de ${list.length} vidéo(s) via ${useApi ? "YouTube Data API" : "oEmbed (sans clé API)"}`);

  if (useApi) {
    try {
      const map = await apiVideos(list.map((v) => v.externalId));
      const channelIds = new Set<string>();
      for (const v of list) {
        const a = map.get(v.externalId);
        if (!a || a.privacyStatus === "private") {
          await markUnavailable(db, v.id, v.statusLocked, a ? "private" : "unavailable");
          log.stat("unavailable");
          continue;
        }
        const creatorId = await upsertCreator(db, { channelId: a.channelId, name: a.channelTitle });
        channelIds.add(a.channelId);
        const thumb = a.thumbnails.maxres ?? a.thumbnails.standard ?? a.thumbnails.high ?? a.thumbnails.medium ?? a.thumbnails.default;
        await db
          .update(videos)
          .set({
            title: a.title,
            slug: videoSlug(a.title, v.externalId),
            description: a.description,
            creatorId,
            publishedAt: a.publishedAt,
            durationSeconds: a.durationSeconds,
            thumbnails: a.thumbnails,
            thumbnailUrl: (a.thumbnails.high ?? thumb)?.url ?? null,
            thumbnailWidth: (a.thumbnails.high ?? thumb)?.width ?? null,
            thumbnailHeight: (a.thumbnails.high ?? thumb)?.height ?? null,
            providerTags: a.tags,
            providerCategoryId: a.categoryId,
            language: a.language ?? undefined,
            languageSource: a.language ? "api" : undefined,
            viewCount: a.viewCount,
            likeCount: a.likeCount,
            commentCount: a.commentCount,
            statsUpdatedAt: new Date(),
            embeddable: a.embeddable,
            availability: a.embeddable ? "available" : "embed_disabled",
            availabilityCheckedAt: new Date(),
            availabilityFailures: 0,
            isShort: (a.durationSeconds ?? 999) <= 60 && /#shorts/i.test(`${a.title} ${a.description}`) ? true : undefined,
            metadataSource: "youtube_api",
            metadataUpdatedAt: new Date(),
            needsReanalysis: true,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, v.id));
        log.stat("enriched");
      }
      // Statistiques des chaînes (1 unité par lot de 50)
      const ids = [...channelIds];
      for (let i = 0; i < ids.length; i += 50) {
        for (const ch of await apiChannels({ ids: ids.slice(i, i + 50) })) {
          await db
            .update(creators)
            .set({ subscriberCount: ch.subscriberCount, videoCount: ch.videoCount, country: ch.country, handle: ch.customUrl, description: ch.description.slice(0, 2000), statsUpdatedAt: new Date(), updatedAt: new Date() })
            .where(eq(creators.channelId, ch.id));
        }
      }
      return;
    } catch (e) {
      if (e instanceof QuotaExceededError) {
        log.warn(`${e.message} — bascule sur oEmbed pour cette exécution`);
      } else throw e;
    }
  }

  await pMap(
    list,
    async (v) => {
      try {
        const r = await oembed(v.externalId);
        if (r.status === "available") {
          const creatorId = await upsertCreator(db, { name: r.authorName, url: r.authorUrl });
          await db
            .update(videos)
            .set({
              title: r.title,
              slug: videoSlug(r.title, v.externalId),
              creatorId: v.creatorId ?? creatorId,
              thumbnailUrl: r.thumbnailUrl,
              thumbnailWidth: r.thumbnailWidth,
              thumbnailHeight: r.thumbnailHeight,
              embeddable: true,
              availability: "available",
              availabilityCheckedAt: new Date(),
              availabilityFailures: 0,
              metadataSource: "oembed",
              metadataUpdatedAt: new Date(),
              needsReanalysis: true,
              updatedAt: new Date(),
            })
            .where(eq(videos.id, v.id));
          log.stat("enriched");
        } else if (r.status === "embed_disabled") {
          await db
            .update(videos)
            .set({ embeddable: false, availability: "embed_disabled", availabilityCheckedAt: new Date(), statusReason: v.title ? undefined : "Intégration désactivée : métadonnées indisponibles sans clé API", updatedAt: new Date() })
            .where(eq(videos.id, v.id));
          log.stat("embed_disabled");
        } else {
          await markUnavailable(db, v.id, v.statusLocked, "unavailable");
          log.stat("unavailable");
        }
      } catch (e) {
        log.stat("errors");
        await log.warn(`oEmbed en échec pour ${v.externalId}`, { error: String(e) });
      }
    },
    4,
  );
}

async function markUnavailable(db: DB, id: number, locked: boolean, availability: "unavailable" | "private") {
  await db
    .update(videos)
    .set({
      availability,
      availabilityCheckedAt: new Date(),
      availabilityFailures: sql`${videos.availabilityFailures} + 1`,
      ...(locked ? {} : { status: "unavailable" as const, statusReason: "Vidéo supprimée, privée ou inaccessible chez le fournisseur", statusChangedAt: new Date() }),
      updatedAt: new Date(),
    })
    .where(eq(videos.id, id));
}

/** Étape 9 : revérifie périodiquement les vidéos publiées (disponibilité, statistiques). */
export async function refreshAvailability(opts: { olderThanDays?: number; limit?: number; log?: Logger } = {}) {
  const db = await getDb();
  const days = opts.olderThanDays ?? (await getSetting("ingestion")).refreshAfterDays;
  const cutoff = new Date(Date.now() - days * 86400e3);
  const list = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(inArray(videos.status, ["published", "pending_review", "unavailable"]), or(isNull(videos.availabilityCheckedAt), sql`${videos.availabilityCheckedAt} < ${cutoff}`)))
    .orderBy(videos.availabilityCheckedAt)
    .limit(opts.limit ?? 500);
  (opts.log ?? consoleLogger).info(`Actualisation de ${list.length} vidéo(s) non vérifiées depuis ${days} jours`);
  if (!list.length) return;
  await enrichVideos({ videoIds: list.map((v) => v.id), log: opts.log });
  // Une vidéo de nouveau disponible repasse par l'analyse et la notation.
  await db.update(videos).set({ status: "discovered", statusReason: "De nouveau disponible", needsReanalysis: true }).where(and(inArray(videos.id, list.map((v) => v.id)), eq(videos.status, "unavailable"), eq(videos.availability, "available"), eq(videos.statusLocked, false)));
}

/* ------------------------------------------------------------------ */
/* Étape 5 : analyse (classification)                                  */
/* ------------------------------------------------------------------ */

export async function analyzeVideos(opts: { videoIds?: number[]; limit?: number; force?: boolean; log?: Logger } = {}) {
  const db = await getDb();
  const log = opts.log ?? consoleLogger;
  const maps = await categoryIdMaps();
  const where = opts.videoIds?.length
    ? inArray(videos.id, opts.videoIds)
    : and(opts.force ? undefined : eq(videos.needsReanalysis, true), ne(videos.title, ""), notInArray(videos.status, ["excluded", "unavailable"]));
  const list = await db.select().from(videos).where(where).limit(opts.limit ?? 5000);
  const useAi = await aiEnabled();
  log.info(`Analyse de ${list.length} vidéo(s) (${useAi ? "modèle de langage" : HEURISTIC_VERSION})`);

  const tagCache = new Map<string, number>();
  for (const v of list) {
    const ev = await db.select().from(recommendationEvidence).where(eq(recommendationEvidence.videoId, v.id));
    const srcs = await db
      .select({ hint: sources.universeHint })
      .from(videoSources)
      .leftJoin(sources, eq(sources.id, videoSources.sourceId))
      .where(eq(videoSources.videoId, v.id));
    const creator = v.creatorId ? await db.query.creators.findFirst({ where: eq(creators.id, v.creatorId) }) : null;
    const hint = srcs.find((s) => s.hint)?.hint ?? null;
    const input = {
      title: v.title,
      description: v.description,
      providerTags: v.providerTags,
      evidenceTitles: ev.filter((e) => e.kind === "community_upvote" && e.title).map((e) => e.title!),
      channelName: creator?.name,
      universeHint: hint,
      durationSeconds: v.durationSeconds,
    };
    const inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
    const started = Date.now();
    let output: AnalysisOutput;
    let meta = { provider: "heuristic", model: "regles-taxonomie", modelVersion: HEURISTIC_VERSION, promptVersion: null as string | null, tokensIn: null as number | null, tokensOut: null as number | null, costUsd: null as number | null };
    const heuristic = classify(input);
    output = heuristic;
    if (useAi && heuristic.relevance > 0.2) {
      try {
        const r = await analyzeWithAi(input, heuristic);
        output = r.output;
        meta = { provider: r.provider, model: r.model, modelVersion: r.model, promptVersion: r.promptVersion, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.costUsd };
      } catch (e) {
        await log.warn(`Analyse IA en échec pour ${v.externalId}, repli heuristique`, { error: String(e) });
        await db.insert(aiAnalysis).values({ videoId: v.id, provider: "anthropic", model: "n/a", modelVersion: "n/a", inputHash, error: String(e).slice(0, 1000), durationMs: Date.now() - started });
      }
    }
    await db.insert(aiAnalysis).values({
      videoId: v.id,
      provider: meta.provider,
      model: meta.model,
      modelVersion: meta.modelVersion,
      promptVersion: meta.promptVersion,
      inputHash,
      output,
      confidence: output.universes[0]?.confidence ?? 0,
      tokensIn: meta.tokensIn,
      tokensOut: meta.tokensOut,
      costUsd: meta.costUsd != null ? String(meta.costUsd) : null,
      durationMs: Date.now() - started,
    });
    await applyAssignments(db, v.id, output, meta.provider === "heuristic" ? "heuristic" : "ai", maps, tagCache);
    const lang = v.languageSource === "api" || v.languageSource === "editor" ? undefined : output.language ?? guessLanguage(v.title) ?? undefined;
    await db
      .update(videos)
      .set({
        primaryFormat: output.formats[0]?.slug ?? null,
        technicalLevel: output.technicalLevel ?? null,
        temporality: output.temporality ?? null,
        propulsion: output.technologies[0]?.slug ?? null,
        ...(lang ? { language: lang, languageSource: "heuristic" as const } : {}),
        ...(output.summary && v.editorialSummarySource !== "editor" ? { editorialSummary: output.summary, editorialSummarySource: "ai" as const } : {}),
        analysisVersion: meta.modelVersion,
        analyzedAt: new Date(),
        needsReanalysis: false,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, v.id));
    log.stat(output.inScope ? "in_scope" : "out_of_scope");
  }
  if (list.length) await rebuildSearchText(list.map((v) => v.id));
}

type Maps = Awaited<ReturnType<typeof categoryIdMaps>>;

async function applyAssignments(db: DB, videoId: number, o: AnalysisOutput, source: "heuristic" | "ai", maps: Maps, tagCache: Map<string, number>) {
  // Les affectations faites par un éditeur sont conservées ; seules les automatiques sont remplacées.
  const auto = inArray(videoCategories.source, ["heuristic", "ai"]);
  await db.delete(videoCategories).where(and(eq(videoCategories.videoId, videoId), auto));
  await db.delete(videoSubcategories).where(and(eq(videoSubcategories.videoId, videoId), inArray(videoSubcategories.source, ["heuristic", "ai"])));
  await db.delete(videoBrands).where(and(eq(videoBrands.videoId, videoId), inArray(videoBrands.source, ["heuristic", "ai"])));
  await db.delete(videoModels).where(and(eq(videoModels.videoId, videoId), inArray(videoModels.source, ["heuristic", "ai"])));
  await db.delete(videoTags).where(and(eq(videoTags.videoId, videoId), inArray(videoTags.source, ["heuristic", "ai"])));
  if (!o.inScope) return;
  const round = (x: number) => Math.round(x * 100) / 100;

  const cats: (typeof videoCategories.$inferInsert)[] = [];
  o.universes.forEach((u, i) => {
    const c = maps.category.get(u.slug);
    if (c) cats.push({ videoId, categoryId: c.id, isPrimary: i === 0, confidence: round(u.confidence), source });
  });
  for (const [list, prefix] of [[o.themes, ""], [o.formats, "format-"], [o.technologies, "techno-"]] as const) {
    for (const t of list) {
      const c = maps.category.get(`${prefix}${t.slug}`);
      if (c) cats.push({ videoId, categoryId: c.id, confidence: round(t.confidence), source });
    }
  }
  if (cats.length) await db.insert(videoCategories).values(cats).onConflictDoNothing();
  const subs = o.subcategories.map((s) => maps.subcategory.get(s.slug) && { videoId, subcategoryId: maps.subcategory.get(s.slug)!.id, confidence: round(s.confidence), source }).filter(Boolean) as (typeof videoSubcategories.$inferInsert)[];
  if (subs.length) await db.insert(videoSubcategories).values(subs).onConflictDoNothing();
  const bs = o.brands.map((b) => maps.brand.get(b.slug) && { videoId, brandId: maps.brand.get(b.slug)!.id, confidence: round(b.confidence), source }).filter(Boolean) as (typeof videoBrands.$inferInsert)[];
  if (bs.length) await db.insert(videoBrands).values(bs).onConflictDoNothing();
  const ms = o.models.map((m) => maps.model.get(`${m.brand}/${m.slug}`) && { videoId, modelId: maps.model.get(`${m.brand}/${m.slug}`)!.id, confidence: round(m.confidence), source }).filter(Boolean) as (typeof videoModels.$inferInsert)[];
  if (ms.length) await db.insert(videoModels).values(ms).onConflictDoNothing();
  for (const t of o.tags) {
    const slug = normalize(t).replace(/\s+/g, "-");
    if (!slug) continue;
    let tagId = tagCache.get(slug);
    if (!tagId) {
      const label = t.length <= 4 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
      const [row] = await db.insert(tags).values({ slug, labels: { fr: label, en: label } }).onConflictDoUpdate({ target: tags.slug, set: { slug } }).returning({ id: tags.id });
      tagId = row.id;
      tagCache.set(slug, tagId);
    }
    await db.insert(videoTags).values({ videoId, tagId, source }).onConflictDoNothing();
  }
}

/** Recalcule les textes normalisés utilisés par la recherche plein texte. */
export async function rebuildSearchText(videoIds?: number[]) {
  const db = await getDb();
  const where = videoIds?.length ? sql`where v.id in (${sql.join(videoIds.map((i) => sql`${i}`), sql`, `)})` : sql``;
  const rowsRes = await db.execute(sql`
    select v.id, v.title, v.description, v.editorial_summary, v.selection_reason,
      coalesce(cr.name, '') as creator,
      coalesce((select string_agg(coalesce(c.labels->>'fr','') || ' ' || coalesce(c.labels->>'en',''), ' ') from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id), '') as cats,
      coalesce((select string_agg(coalesce(s.labels->>'fr','') || ' ' || coalesce(s.labels->>'en',''), ' ') from video_subcategories vs join subcategories s on s.id = vs.subcategory_id where vs.video_id = v.id), '') as subs,
      coalesce((select string_agg(b.name || ' ' || array_to_string(b.aliases, ' '), ' ') from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = v.id), '') as brands,
      coalesce((select string_agg(m.name || ' ' || array_to_string(m.aliases, ' '), ' ') from video_models vm join vehicle_models m on m.id = vm.model_id where vm.video_id = v.id), '') as models,
      coalesce((select string_agg(t.labels->>'fr', ' ') from video_tags vt join tags t on t.id = vt.tag_id where vt.video_id = v.id), '') as tags,
      coalesce(array_to_string(v.provider_tags, ' '), '') as ptags,
      coalesce((select string_agg(e.title, ' ') from recommendation_evidence e where e.video_id = v.id and e.kind = 'community_upvote'), '') as etitles
    from videos v left join creators cr on cr.id = v.creator_id ${where}`);
  const list = (rowsRes as unknown as { rows: Record<string, string | number | null>[] }).rows;
  for (const r of list) {
    await db
      .update(videos)
      .set({
        searchTitle: normalize(String(r.title ?? "")),
        searchEntities: normalize([r.creator, r.brands, r.models, r.tags, r.ptags, r.subs, r.cats].join(" ")).slice(0, 4000),
        searchBody: normalize([String(r.description ?? "").slice(0, 3000), r.editorial_summary, r.selection_reason, r.etitles].join(" ")).slice(0, 6000),
      })
      .where(eq(videos.id, Number(r.id)));
  }
}

/* ------------------------------------------------------------------ */
/* Étapes 6-8 : évaluation, publication, contrôle                      */
/* ------------------------------------------------------------------ */

export async function scoreVideos(opts: { videoIds?: number[]; limit?: number; log?: Logger } = {}) {
  const db = await getDb();
  const log = opts.log ?? consoleLogger;
  const scoring = await getSetting("scoring");
  const ingestion = await getSetting("ingestion");
  const where = opts.videoIds?.length ? inArray(videos.id, opts.videoIds) : and(ne(videos.title, ""), eq(videos.needsReanalysis, false), notInArray(videos.status, ["excluded"]));
  const list = await db.select().from(videos).where(where).limit(opts.limit ?? 20000);
  log.info(`Notation de ${list.length} vidéo(s)`);
  for (const v of list) {
    const analysisRow = await db.query.aiAnalysis.findFirst({ where: and(eq(aiAnalysis.videoId, v.id), isNull(aiAnalysis.error)), orderBy: desc(aiAnalysis.createdAt) });
    if (!analysisRow?.output) continue;
    const ev = await db.select().from(recommendationEvidence).where(eq(recommendationEvidence.videoId, v.id));
    const creator = v.creatorId ? await db.query.creators.findFirst({ where: eq(creators.id, v.creatorId) }) : null;
    const input = {
      analysis: analysisRow.output,
      durationSeconds: v.durationSeconds,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      isShort: v.isShort,
      embeddable: v.embeddable,
      creator: creator ? { name: creator.name, trustLevel: creator.trustLevel, isCuratedSource: creator.isCuratedSource, isOfficial: creator.isOfficial } : null,
      evidence: ev.map<EvidenceLite>((e) => ({ kind: e.kind, independenceKey: e.independenceKey, points: e.points, commentsCount: e.commentsCount, occurredAt: e.occurredAt, sourceName: e.sourceName })),
      editorialPick: v.editorialPick,
    };
    const res = computeScore(input, scoring);
    const effective = v.scoreOverride ?? res.total;
    const decision = decideStatus({ total: effective, confidence: res.confidence, relevance: analysisRow.output.relevance, inScope: analysisRow.output.inScope, availability: v.availability, isShort: v.isShort }, scoring.thresholds, ingestion.autoPublish);
    const statusChange = !v.statusLocked && decision.status !== v.status;
    await db
      .update(videos)
      .set({
        qualityScore: effective,
        scoreConfidence: res.confidence,
        scoreBreakdown: res.breakdown,
        scoreVersion: scoring.version,
        scoredAt: new Date(),
        discoveryScore: res.discoveryScore,
        recommenderCount: res.aggregates.recommenderCount,
        recommendationMonths: res.aggregates.recommendationMonths,
        communityPoints: res.aggregates.communityPoints,
        firstRecommendedAt: res.aggregates.firstRecommendedAt,
        lastRecommendedAt: res.aggregates.lastRecommendedAt,
        selectionReason: buildSelectionReason(input, res),
        ...(!v.statusLocked && !statusChange ? { statusReason: decision.reason } : {}),
        ...(statusChange
          ? {
              status: decision.status,
              statusReason: decision.reason,
              statusChangedAt: new Date(),
              ...(decision.status === "published" && !v.publishedOnSiteAt ? { publishedOnSiteAt: new Date() } : {}),
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, v.id));
    log.stat(`status_${v.statusLocked ? v.status : decision.status}`);
  }
}

/** Remet en file l'analyse de vidéos (ex. après modification de la taxonomie). */
export async function flagForReanalysis(videoIds?: number[]) {
  const db = await getDb();
  await db.update(videos).set({ needsReanalysis: true }).where(videoIds?.length ? inArray(videos.id, videoIds) : undefined);
}

export { categories, subcategories };
