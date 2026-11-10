import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ingestionJobs, jobEvents } from "@/db/schema";
import { refreshCounts, seedTaxonomy } from "@/server/catalog/seed";
import { refreshSmartPlaylists } from "@/server/catalog/playlists";
import { discoverChannelFeeds, discoverHnComments, discoverHnMentions, discoverHnStories, discoverReddit, resolveCuratedSources } from "./discovery";
import { analyzeVideos, enrichVideos, refreshAvailability, scoreVideos, type Logger } from "./pipeline";

/**
 * Exécution des tâches d'ingestion avec journal (job_events), statistiques,
 * statut et protection contre les exécutions concurrentes d'un même type.
 */

type Params = Record<string, unknown>;
type JobFn = (log: Logger, params: Params) => Promise<void>;

export const JOB_TYPES: Record<string, { label: string; description: string; run: JobFn }> = {
  seed_taxonomy: { label: "Amorcer la taxonomie", description: "Catégories, marques, modèles et playlists par défaut", run: async (log) => { const s = await seedTaxonomy(); await log.info("Taxonomie à jour", s); } },
  resolve_sources: { label: "Vérifier les sources", description: "Résout les chaînes spécialisées via Wikidata et les vérifie par flux RSS", run: (log) => resolveCuratedSources(log) },
  discover_hn_stories: { label: "Découverte Hacker News (stories)", description: "Stories HN liant une vidéo YouTube", run: (log, p) => discoverHnStories(log, { fromYear: p.fromYear as number | undefined, toYear: p.toYear as number | undefined, minPoints: p.minPoints as number | undefined }) },
  discover_hn_comments: { label: "Découverte Hacker News (commentaires)", description: "Vidéos citées dans les commentaires par plusieurs personnes", run: (log) => discoverHnComments(log) },
  discover_hn_mentions: { label: "Recommandeurs Hacker News", description: "Compte les personnes distinctes citant chaque vidéo du périmètre", run: (log, p) => discoverHnMentions(log, { limit: p.limit as number | undefined }) },
  discover_channels: { label: "Découverte chaînes suivies", description: "Flux RSS des chaînes vérifiées (et catalogue complet avec clé API)", run: (log, p) => discoverChannelFeeds(log, { backfillPages: p.backfillPages as number | undefined, pagesByUniverse: p.pagesByUniverse as Record<string, number> | undefined, channelIds: p.channelIds as string[] | undefined, language: p.language as string | undefined, topPerChannel: p.topPerChannel as number | undefined }) },
  discover_reddit: { label: "Découverte Reddit", description: "Meilleures publications des subreddits configurés (OAuth requis)", run: (log) => discoverReddit(log) },
  enrich: { label: "Enrichir les métadonnées", description: "YouTube Data API (ou oEmbed sans clé) : titre, chaîne, durée, disponibilité", run: (log, p) => enrichVideos({ log, limit: p.limit as number | undefined, force: Boolean(p.force) }) },
  analyze: { label: "Analyser / classer", description: "Classification (heuristique ou modèle de langage)", run: (log, p) => analyzeVideos({ log, force: Boolean(p.force), limit: p.limit as number | undefined }) },
  score: { label: "Noter et publier", description: "Score explicable, publication automatique ou file de validation (vidéos nouvelles ou modifiées ; {\"full\":true} pour tout renoter)", run: (log, p) => scoreVideos({ log, limit: p.limit as number | undefined, full: Boolean(p.full) }) },
  refresh_availability: { label: "Revérifier la disponibilité", description: "Contrôle périodique des vidéos (suppression, blocage, statistiques)", run: (log, p) => refreshAvailability({ log, olderThanDays: p.olderThanDays as number | undefined }) },
  refresh_playlists: { label: "Recalculer les playlists", description: "Playlists intelligentes à partir des règles", run: async (log) => { const r = await refreshSmartPlaylists(); await log.info("Playlists recalculées", r); } },
  refresh_counts: { label: "Recalculer les compteurs", description: "Nombre de vidéos par catégorie, marque, modèle", run: async () => refreshCounts() },
};

export const PIPELINE_STEPS = [
  "seed_taxonomy",
  "discover_hn_stories",
  "discover_hn_comments",
  "discover_channels",
  "discover_reddit",
  "enrich",
  "analyze",
  "score",
  "discover_hn_mentions",
  "analyze",
  "score",
  "refresh_playlists",
  "refresh_counts",
] as const;

/** Étapes quotidiennes (incrémentales) adaptées à une tâche planifiée. */
export const DAILY_STEPS = ["discover_channels", "discover_hn_stories", "discover_reddit", "enrich", "analyze", "score", "discover_hn_mentions", "analyze", "score", "refresh_availability", "refresh_playlists", "refresh_counts"] as const;

export async function runJob(type: string, params: Params = {}, triggeredBy = "system", opts: { echo?: boolean } = {}) {
  const def = JOB_TYPES[type];
  if (!def) throw new Error(`Type de tâche inconnu : ${type}`);
  const db = await getDb();
  const recent = await db.query.ingestionJobs.findFirst({
    where: and(eq(ingestionJobs.type, type), eq(ingestionJobs.status, "running"), gt(ingestionJobs.startedAt, new Date(Date.now() - 2 * 3600e3))),
  });
  if (recent) throw new Error(`Une tâche « ${def.label} » est déjà en cours (#${recent.id})`);

  const [job] = await db.insert(ingestionJobs).values({ type, params, status: "running", triggeredBy, startedAt: new Date(), attempts: 1 }).returning();
  const stats: Record<string, number> = {};
  const write = async (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => {
    if (opts.echo) console[level === "info" ? "log" : level](`[${type}] ${message}`, data ? JSON.stringify(data).slice(0, 300) : "");
    await db.insert(jobEvents).values({ jobId: job.id, level, message: message.slice(0, 2000), data });
  };
  const log: Logger = {
    info: (m, d) => write("info", m, d),
    warn: (m, d) => write("warn", m, d),
    error: (m, d) => write("error", m, d),
    stat: (k, inc = 1) => {
      stats[k] = (stats[k] ?? 0) + inc;
    },
  };
  const started = Date.now();
  try {
    await def.run(log, params);
    stats.duration_ms = Date.now() - started;
    await db.update(ingestionJobs).set({ status: "succeeded", stats, finishedAt: new Date() }).where(eq(ingestionJobs.id, job.id));
    if (opts.echo) console.log(`[${type}] terminé en ${Math.round(stats.duration_ms / 1000)} s`, JSON.stringify(stats));
    return { id: job.id, status: "succeeded" as const, stats };
  } catch (e) {
    stats.duration_ms = Date.now() - started;
    await write("error", `Échec : ${String(e)}`);
    await db.update(ingestionJobs).set({ status: "failed", stats, error: String(e).slice(0, 2000), finishedAt: new Date() }).where(eq(ingestionJobs.id, job.id));
    return { id: job.id, status: "failed" as const, stats, error: String(e) };
  }
}

export async function runSteps(steps: readonly string[], params: Record<string, Params> = {}, triggeredBy = "system", opts: { echo?: boolean } = {}) {
  const results = [];
  for (const s of steps) results.push({ step: s, ...(await runJob(s, params[s] ?? {}, triggeredBy, opts)) });
  return results;
}

/** Marque comme échouées les tâches restées « running » après un arrêt brutal (reprise). */
export async function recoverStaleJobs(olderThanMinutes = 180) {
  const db = await getDb();
  await db
    .update(ingestionJobs)
    .set({ status: "failed", error: "Interrompue (processus arrêté) — relancez la tâche, elle reprend de façon incrémentale", finishedAt: new Date() })
    .where(and(eq(ingestionJobs.status, "running"), lt(ingestionJobs.startedAt, new Date(Date.now() - olderThanMinutes * 60e3))));
}
