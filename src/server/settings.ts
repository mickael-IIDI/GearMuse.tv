import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { appSettings } from "@/db/schema";

/** Réglages par défaut — modifiables depuis l'administration (table app_settings). */
export const DEFAULT_SETTINGS = {
  scoring: {
    version: "score-v1",
    /** Pondérations (points relatifs). Les critères non mesurables sont exclus du calcul. */
    weights: {
      relevance: 14,
      technicalDepth: 12,
      pedagogy: 10,
      historicalInterest: 6,
      originality: 6,
      creatorCredibility: 8,
      independentRecommendations: 18,
      recurrence: 10,
      durableValue: 8,
      rarity: 5,
      freshness: 3,
    },
    thresholds: {
      /** Score minimal pour une publication automatique. */
      publish: 55,
      /** En dessous : rejet ; entre review et publish : file de validation. */
      review: 30,
      /** Confiance minimale (part des critères mesurables × confiance de classification). */
      minConfidence: 0.4,
      /** Pertinence thématique minimale pour la publication automatique. */
      minRelevance: 0.55,
    },
    penalties: { short: 30, veryShort: 15, sensational: 5, embedDisabled: 3 },
  },
  ingestion: {
    autoPublish: true,
    hnMinPoints: 5,
    hnFromYear: 2007,
    commentDiscoveryMinAuthors: 2,
    refreshAfterDays: 25,
    maxNewCandidatesPerRun: 3000,
  },
  ai: {
    enabled: false,
    provider: "anthropic",
    model: "claude-opus-5-5",
    monthlyBudgetUsd: 20,
  },
};

export type Settings = typeof DEFAULT_SETTINGS;
type Key = keyof Settings;

const cache = new Map<string, { value: unknown; at: number }>();

function merge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== "object" || Array.isArray(override)) return (override as T) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === "object" && !Array.isArray(b) ? merge(b, v) : v;
  }
  return out as T;
}

export async function getSetting<K extends Key>(key: K): Promise<Settings[K]> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 30_000) return c.value as Settings[K];
  const db = await getDb();
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  const value = merge(DEFAULT_SETTINGS[key], row?.value);
  cache.set(key, { value, at: Date.now() });
  return value;
}

export async function setSetting<K extends Key>(key: K, value: Settings[K], adminUserId?: number) {
  const db = await getDb();
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy: adminUserId ?? null })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: adminUserId ?? null, updatedAt: new Date() } });
  cache.delete(key);
}
