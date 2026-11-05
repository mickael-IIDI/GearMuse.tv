import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Types partagés                                                      */
/* ------------------------------------------------------------------ */

export type Labels = { fr: string; en?: string; [locale: string]: string | undefined };

export const VIDEO_STATUSES = [
  "discovered", // identifiée, pas encore enrichie / analysée
  "pending_review", // file de validation humaine
  "published", // visible sur le site
  "rejected", // hors périmètre ou qualité insuffisante
  "excluded", // exclue manuellement par un administrateur
  "unavailable", // supprimée, privée ou bloquée côté fournisseur
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const AVAILABILITY = [
  "unknown",
  "available",
  "embed_disabled",
  "unavailable",
  "private",
  "region_blocked",
] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const SOURCE_TYPES = [
  "hackernews",
  "youtube_channel_rss",
  "youtube_api_search",
  "youtube_api_channel",
  "reddit",
  "editorial",
  "user_suggestion",
  "blog_rss",
  "manual_import",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const EVIDENCE_KINDS = [
  "community_upvote", // soumission votée par une communauté (ex. story HN)
  "community_comment", // recommandation dans un commentaire
  "editorial_pick", // validée par la rédaction
  "curated_channel", // publiée par une chaîne spécialisée suivie
  "official_channel", // chaîne officielle d'un constructeur / institution
  "expert_mention", // citée par un média ou blog spécialisé
  "user_suggestion", // proposée par un visiteur (puis validée)
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const CATEGORY_KINDS = ["universe", "theme", "format", "technology"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const ADMIN_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const JOB_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type ScoreCriterion = {
  key: string;
  score: number; // 0..1
  weight: number;
  basis: string; // justification lisible, fondée sur des signaux réels
  available: boolean; // false si le signal n'est pas mesurable avec les données actuelles
};
export type ScoreBreakdown = {
  version: string;
  total: number;
  confidence: number;
  criteria: ScoreCriterion[];
  penalties: { key: string; points: number; basis: string }[];
};

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Créateurs et sources                                                */
/* ------------------------------------------------------------------ */

export const creators = pgTable(
  "creators",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    provider: text("provider").notNull().default("youtube"),
    /** Clé stable : "yt:channel:UC…" ou, à défaut, "yt:url:<url de la chaîne>". */
    key: text("key").notNull(),
    channelId: text("channel_id"),
    handle: text("handle"),
    name: text("name").notNull(),
    url: text("url"),
    description: text("description"),
    country: text("country"),
    language: text("language"),
    subscriberCount: bigint("subscriber_count", { mode: "number" }),
    videoCount: integer("video_count"),
    /** Chaîne suivie volontairement comme source spécialisée. */
    isCuratedSource: boolean("is_curated_source").notNull().default(false),
    /** Chaîne officielle d'un constructeur, d'une institution ou d'une compétition. */
    isOfficial: boolean("is_official").notNull().default(false),
    /** Crédibilité 0..100, renseignée par la rédaction ou héritée de la source. */
    trustLevel: smallint("trust_level"),
    statsUpdatedAt: ts("stats_updated_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("creators_key_uq").on(t.key),
    uniqueIndex("creators_channel_uq").on(t.provider, t.channelId),
    index("creators_name_idx").on(t.name),
  ],
);

/** Sources de découverte configurables (chaînes, requêtes HN, subreddits…). */
export const sources = pgTable(
  "sources",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    type: text("type").$type<
      "youtube_channel" | "hn_query" | "hn_youtube_index" | "reddit_subreddit" | "youtube_search" | "blog_rss"
    >().notNull(),
    name: text("name").notNull(),
    /** Paramètres propres au type : channelId, query, subreddit, feedUrl… */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    /** Univers dominant attendu (slug de catégorie), utilisé comme indice de classification. */
    universeHint: text("universe_hint"),
    trustLevel: smallint("trust_level").notNull().default(50),
    isOfficial: boolean("is_official").notNull().default(false),
    enabled: boolean("enabled").notNull().default(true),
    /** Vérifiée = l'identifiant a répondu correctement lors du dernier contrôle. */
    verifiedAt: ts("verified_at"),
    lastRunAt: ts("last_run_at"),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    itemsFound: integer("items_found").notNull().default(0),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("sources_type_name_uq").on(t.type, t.name)],
);

/* ------------------------------------------------------------------ */
/* Vidéos                                                              */
/* ------------------------------------------------------------------ */

export const videos = pgTable(
  "videos",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    provider: text("provider").notNull().default("youtube"),
    externalId: text("external_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    creatorId: integer("creator_id").references(() => creators.id, { onDelete: "set null" }),
    publishedAt: ts("published_at"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    thumbnailWidth: smallint("thumbnail_width"),
    thumbnailHeight: smallint("thumbnail_height"),
    /** Miniatures officielles retournées par le fournisseur, par taille. */
    thumbnails: jsonb("thumbnails").$type<Record<string, { url: string; width?: number; height?: number }>>(),
    language: text("language"),
    languageSource: text("language_source").$type<"api" | "heuristic" | "editor">(),
    viewCount: bigint("view_count", { mode: "number" }),
    likeCount: bigint("like_count", { mode: "number" }),
    commentCount: bigint("comment_count", { mode: "number" }),
    statsUpdatedAt: ts("stats_updated_at"),
    /** Mots-clés fournis par l'auteur (API YouTube). */
    providerTags: text("provider_tags").array(),
    providerCategoryId: text("provider_category_id"),
    embeddable: boolean("embeddable"),
    availability: text("availability").$type<Availability>().notNull().default("unknown"),
    availabilityCheckedAt: ts("availability_checked_at"),
    availabilityFailures: smallint("availability_failures").notNull().default(0),
    isShort: boolean("is_short").notNull().default(false),
    /** Diffusion en direct en cours ou programmée, ou direct permanent archivé (> 12 h) : exclue du catalogue. */
    isLive: boolean("is_live").notNull().default(false),
    /** Métadonnées complètes obtenues via l'API officielle (durée, date…). */
    metadataSource: text("metadata_source").$type<"youtube_api" | "rss" | "oembed" | "manual">(),
    metadataUpdatedAt: ts("metadata_updated_at"),

    status: text("status").$type<VideoStatus>().notNull().default("discovered"),
    statusReason: text("status_reason"),
    statusChangedAt: ts("status_changed_at"),
    /** Statut fixé par un éditeur : le pipeline automatique ne le modifie plus. */
    statusLocked: boolean("status_locked").notNull().default(false),
    publishedOnSiteAt: ts("published_on_site_at"),

    qualityScore: smallint("quality_score"),
    scoreConfidence: real("score_confidence"),
    scoreBreakdown: jsonb("score_breakdown").$type<ScoreBreakdown>(),
    scoreVersion: text("score_version"),
    scoreOverride: smallint("score_override"),
    scoredAt: ts("scored_at"),
    /** Indice de découverte 0..100 (pépite peu vue mais recommandée). */
    discoveryScore: smallint("discovery_score"),

    editorialPick: boolean("editorial_pick").notNull().default(false),
    editorialSummary: text("editorial_summary"),
    editorialSummarySource: text("editorial_summary_source").$type<"ai" | "editor">(),
    selectionReason: text("selection_reason"),
    primaryFormat: text("primary_format"),
    technicalLevel: text("technical_level").$type<"grand_public" | "passionne" | "expert">(),
    temporality: text("temporality").$type<"evergreen" | "dated" | "news">(),
    propulsion: text("propulsion"),

    /** Agrégats de preuves de recommandation (recalculés). */
    recommenderCount: integer("recommender_count").notNull().default(0),
    recommendationMonths: integer("recommendation_months").notNull().default(0),
    communityPoints: integer("community_points").notNull().default(0),
    firstRecommendedAt: ts("first_recommended_at"),
    lastRecommendedAt: ts("last_recommended_at"),

    /** Dernière recherche des mentions Hacker News de cette vidéo. */
    mentionsCheckedAt: ts("mentions_checked_at"),
    analysisVersion: text("analysis_version"),
    analyzedAt: ts("analyzed_at"),
    needsReanalysis: boolean("needs_reanalysis").notNull().default(true),

    /** Textes normalisés (minuscules, sans accents) pour la recherche. */
    searchTitle: text("search_title").notNull().default(""),
    searchEntities: text("search_entities").notNull().default(""),
    searchBody: text("search_body").notNull().default(""),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`setweight(to_tsvector('simple'::regconfig, search_title), 'A') || setweight(to_tsvector('french'::regconfig, search_title), 'A') || setweight(to_tsvector('english'::regconfig, search_title), 'A') || setweight(to_tsvector('simple'::regconfig, search_entities), 'B') || setweight(to_tsvector('french'::regconfig, search_body), 'C') || setweight(to_tsvector('english'::regconfig, search_body), 'C')`,
    ),

    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("videos_provider_external_uq").on(t.provider, t.externalId),
    uniqueIndex("videos_slug_uq").on(t.slug),
    index("videos_status_score_idx").on(t.status, t.qualityScore),
    index("videos_status_published_idx").on(t.status, t.publishedAt),
    index("videos_status_onsite_idx").on(t.status, t.publishedOnSiteAt),
    index("videos_status_duration_idx").on(t.status, t.durationSeconds),
    index("videos_status_discovery_idx").on(t.status, t.discoveryScore),
    index("videos_creator_idx").on(t.creatorId),
    index("videos_availability_check_idx").on(t.availabilityCheckedAt),
    index("videos_reanalysis_idx").on(t.needsReanalysis),
    index("videos_search_vector_idx").using("gin", t.searchVector),
    index("videos_search_title_trgm_idx").using("gin", sql`${t.searchTitle} gin_trgm_ops`),
    check("videos_score_range", sql`${t.qualityScore} is null or (${t.qualityScore} between 0 and 100)`),
    check(
      "videos_status_check",
      sql`${t.status} in ('discovered','pending_review','published','rejected','excluded','unavailable')`,
    ),
  ],
);

/** Chaque mention d'une vidéo dans une source de découverte. */
export const videoSources = pgTable(
  "video_sources",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    sourceId: integer("source_id").references(() => sources.id, { onDelete: "set null" }),
    sourceType: text("source_type").$type<SourceType>().notNull(),
    /** Référence unique dans la source : id de story HN, id de chaîne, id de lot… */
    sourceRef: text("source_ref").notNull(),
    url: text("url"),
    title: text("title"),
    discoveredAt: ts("discovered_at").notNull().defaultNow(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
  },
  (t) => [
    uniqueIndex("video_sources_uq").on(t.videoId, t.sourceType, t.sourceRef),
    index("video_sources_video_idx").on(t.videoId),
  ],
);

/** Preuves de recommandation : chaque signal réel et vérifiable qui motive une sélection. */
export const recommendationEvidence = pgTable(
  "recommendation_evidence",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EvidenceKind>().notNull(),
    sourceType: text("source_type").$type<SourceType>().notNull(),
    sourceName: text("source_name").notNull(),
    externalRef: text("external_ref").notNull(),
    url: text("url"),
    title: text("title"),
    author: text("author"),
    excerpt: text("excerpt"),
    points: integer("points"),
    commentsCount: integer("comments_count"),
    occurredAt: ts("occurred_at"),
    /** Clé d'indépendance : deux preuves de même clé comptent pour un seul recommandeur. */
    independenceKey: text("independence_key").notNull(),
    weight: real("weight").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("evidence_uq").on(t.videoId, t.sourceType, t.externalRef),
    index("evidence_video_idx").on(t.videoId),
  ],
);

/* ------------------------------------------------------------------ */
/* Taxonomie                                                           */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    slug: text("slug").notNull(),
    kind: text("kind").$type<CategoryKind>().notNull(),
    labels: jsonb("labels").$type<Labels>().notNull(),
    descriptions: jsonb("descriptions").$type<Labels>(),
    icon: text("icon"),
    color: text("color"),
    sortOrder: smallint("sort_order").notNull().default(0),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    isActive: boolean("is_active").notNull().default(true),
    videoCount: integer("video_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug), index("categories_kind_idx").on(t.kind)],
);

export const subcategories = pgTable(
  "subcategories",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    labels: jsonb("labels").$type<Labels>().notNull(),
    descriptions: jsonb("descriptions").$type<Labels>(),
    keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
    sortOrder: smallint("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    videoCount: integer("video_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subcategories_cat_slug_uq").on(t.categoryId, t.slug)],
);

const assignmentCols = {
  confidence: real("confidence").notNull().default(1),
  source: text("source").$type<"heuristic" | "ai" | "editor" | "api">().notNull().default("heuristic"),
};

export const videoCategories = pgTable(
  "video_categories",
  {
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...assignmentCols,
  },
  (t) => [primaryKey({ columns: [t.videoId, t.categoryId] }), index("video_categories_cat_idx").on(t.categoryId)],
);

export const videoSubcategories = pgTable(
  "video_subcategories",
  {
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    subcategoryId: integer("subcategory_id")
      .notNull()
      .references(() => subcategories.id, { onDelete: "cascade" }),
    ...assignmentCols,
  },
  (t) => [
    primaryKey({ columns: [t.videoId, t.subcategoryId] }),
    index("video_subcategories_sub_idx").on(t.subcategoryId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    slug: text("slug").notNull(),
    labels: jsonb("labels").$type<Labels>().notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tags_slug_uq").on(t.slug)],
);

export const videoTags = pgTable(
  "video_tags",
  {
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
    ...assignmentCols,
  },
  (t) => [primaryKey({ columns: [t.videoId, t.tagId] }), index("video_tags_tag_idx").on(t.tagId)],
);

export const brands = pgTable(
  "brands",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    /** Univers concernés (slugs de catégories de type universe). */
    universes: text("universes").array().notNull().default(sql`'{}'::text[]`),
    country: text("country"),
    descriptions: jsonb("descriptions").$type<Labels>(),
    wikidataId: text("wikidata_id"),
    isActive: boolean("is_active").notNull().default(true),
    videoCount: integer("video_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("brands_slug_uq").on(t.slug)],
);

export const vehicleModels = pgTable(
  "vehicle_models",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    universe: text("universe"),
    yearsLabel: text("years_label"),
    descriptions: jsonb("descriptions").$type<Labels>(),
    isActive: boolean("is_active").notNull().default(true),
    videoCount: integer("video_count").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("vehicle_models_brand_slug_uq").on(t.brandId, t.slug)],
);

export const videoBrands = pgTable(
  "video_brands",
  {
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    brandId: integer("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    ...assignmentCols,
  },
  (t) => [primaryKey({ columns: [t.videoId, t.brandId] }), index("video_brands_brand_idx").on(t.brandId)],
);

export const videoModels = pgTable(
  "video_models",
  {
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    modelId: integer("model_id").notNull().references(() => vehicleModels.id, { onDelete: "cascade" }),
    ...assignmentCols,
  },
  (t) => [primaryKey({ columns: [t.videoId, t.modelId] }), index("video_models_model_idx").on(t.modelId)],
);

/* ------------------------------------------------------------------ */
/* Playlists                                                           */
/* ------------------------------------------------------------------ */

export type PlaylistRules = {
  universes?: string[];
  subcategories?: string[];
  themes?: string[];
  formats?: string[];
  technologies?: string[];
  brands?: string[];
  keywords?: string[];
  minScore?: number;
  minDurationSeconds?: number;
  limit?: number;
  order?: "score" | "published_asc" | "published_desc" | "duration";
};

export const playlists = pgTable(
  "playlists",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    slug: text("slug").notNull(),
    kind: text("kind").$type<"editorial" | "smart">().notNull().default("editorial"),
    tier: text("tier").$type<"start" | "deep">().notNull().default("start"),
    titles: jsonb("titles").$type<Labels>().notNull(),
    pitches: jsonb("pitches").$type<Labels>(),
    descriptions: jsonb("descriptions").$type<Labels>(),
    rules: jsonb("rules").$type<PlaylistRules>(),
    coverVideoId: integer("cover_video_id").references(() => videos.id, { onDelete: "set null" }),
    status: text("status").$type<"draft" | "published">().notNull().default("draft"),
    sortOrder: smallint("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    curatedBy: text("curated_by"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("playlists_slug_uq").on(t.slug), index("playlists_status_idx").on(t.status, t.sortOrder)],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    playlistId: integer("playlist_id").notNull().references(() => playlists.id, { onDelete: "cascade" }),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    note: text("note"),
    pinned: boolean("pinned").notNull().default(false),
    addedBy: text("added_by").$type<"rule" | "editor">().notNull().default("rule"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.playlistId, t.videoId] }),
    index("playlist_items_pos_idx").on(t.playlistId, t.position),
  ],
);

/* ------------------------------------------------------------------ */
/* Curation : revues éditoriales et analyses                           */
/* ------------------------------------------------------------------ */

export const editorialReviews = pgTable(
  "editorial_reviews",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    adminUserId: integer("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    decision: text("decision").$type<"approve" | "reject" | "exclude" | "feature" | "unfeature" | "edit" | "reanalyze">().notNull(),
    scoreOverride: smallint("score_override"),
    summary: text("summary"),
    selectionReason: text("selection_reason"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("editorial_reviews_video_idx").on(t.videoId)],
);

export type AnalysisOutput = {
  inScope: boolean;
  relevance: number; // 0..1
  universes: { slug: string; confidence: number }[];
  subcategories: { slug: string; confidence: number }[];
  themes: { slug: string; confidence: number }[];
  formats: { slug: string; confidence: number }[];
  technologies: { slug: string; confidence: number }[];
  brands: { slug: string; confidence: number }[];
  models: { slug: string; brand: string; confidence: number }[];
  tags: string[];
  technicalLevel?: "grand_public" | "passionne" | "expert";
  temporality?: "evergreen" | "dated" | "news";
  pedagogicalValue?: number; // 0..1
  technicalDepth?: number; // 0..1
  historicalInterest?: number; // 0..1
  originality?: number; // 0..1
  language?: string;
  summary?: string;
  selectionReason?: string;
  sensationalism?: number; // nombre de marqueurs racoleurs dans le titre
  signals: string[]; // éléments observés ayant mené aux décisions
};

export const aiAnalysis = pgTable(
  "ai_analysis",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
    /** "heuristic" = classifieur à règles, sans modèle de langage. */
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    modelVersion: text("model_version").notNull(),
    promptVersion: text("prompt_version"),
    inputHash: text("input_hash").notNull(),
    output: jsonb("output").$type<AnalysisOutput>(),
    confidence: real("confidence"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_analysis_video_idx").on(t.videoId, t.createdAt), index("ai_analysis_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

export const importBatches = pgTable(
  "import_batches",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    kind: text("kind").$type<"manual_url" | "bulk" | "pipeline" | "seed">().notNull(),
    label: text("label").notNull(),
    createdBy: integer("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    total: integer("total").notNull().default(0),
    succeeded: integer("succeeded").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    details: jsonb("details").$type<{ errors?: { item: string; error: string }[]; [k: string]: unknown }>(),
    createdAt: createdAt(),
    finishedAt: ts("finished_at"),
  },
  (t) => [index("import_batches_created_idx").on(t.createdAt)],
);

export const ingestionJobs = pgTable(
  "ingestion_jobs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    type: text("type").notNull(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    /** Point de reprise pour les tâches incrémentales. */
    cursor: jsonb("cursor").$type<Record<string, unknown>>(),
    error: text("error"),
    attempts: smallint("attempts").notNull().default(0),
    batchId: integer("batch_id").references(() => importBatches.id, { onDelete: "set null" }),
    triggeredBy: text("triggered_by").notNull().default("system"),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    createdAt: createdAt(),
  },
  (t) => [index("ingestion_jobs_status_idx").on(t.status, t.createdAt), index("ingestion_jobs_type_idx").on(t.type, t.createdAt)],
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    jobId: integer("job_id").notNull().references(() => ingestionJobs.id, { onDelete: "cascade" }),
    level: text("level").$type<"debug" | "info" | "warn" | "error">().notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("job_events_job_idx").on(t.jobId, t.createdAt)],
);

/** Consommation des API externes (quotas YouTube, dépenses IA…), par jour. */
export const apiUsage = pgTable(
  "api_usage",
  {
    provider: text("provider").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    units: integer("units").notNull().default(0),
    requests: integer("requests").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.day] })],
);

/* ------------------------------------------------------------------ */
/* Contributions publiques                                             */
/* ------------------------------------------------------------------ */

export const videoSuggestions = pgTable(
  "video_suggestions",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    url: text("url").notNull(),
    externalId: text("external_id"),
    note: text("note"),
    status: text("status").$type<"pending" | "imported" | "rejected">().notNull().default("pending"),
    ipHash: text("ip_hash"),
    reviewedBy: integer("reviewed_by").references(() => adminUsers.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("video_suggestions_status_idx").on(t.status, t.createdAt)],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    videoId: integer("video_id").references(() => videos.id, { onDelete: "set null" }),
    url: text("url"),
    reason: text("reason").$type<"rights_holder" | "unavailable" | "wrong_category" | "inappropriate" | "other">().notNull(),
    message: text("message").notNull(),
    contact: text("contact"),
    status: text("status").$type<"open" | "resolved" | "dismissed">().notNull().default("open"),
    resolution: text("resolution"),
    ipHash: text("ip_hash"),
    handledBy: integer("handled_by").references(() => adminUsers.id, { onDelete: "set null" }),
    handledAt: ts("handled_at"),
    createdAt: createdAt(),
  },
  (t) => [index("content_reports_status_idx").on(t.status, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<AdminRole>().notNull().default("editor"),
    isActive: boolean("is_active").notNull().default(true),
    failedAttempts: smallint("failed_attempts").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("admin_users_email_uq").on(t.email),
    check("admin_users_role_check", sql`${t.role} in ('owner','admin','editor','viewer')`),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    /** Empreinte SHA-256 du jeton de session (le jeton brut n'est jamais stocké). */
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    adminUserId: integer("admin_user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

/** Réglages applicatifs modifiables depuis l'administration (pondérations, seuils…). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: integer("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});
