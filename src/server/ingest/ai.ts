import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import type { AnalysisOutput } from "@/db/schema";
import { BRANDS, MODELS } from "@/lib/taxonomy/brands";
import { FORMATS, TECHNOLOGIES, THEMES, UNIVERSES } from "@/lib/taxonomy/data";
import type { ClassifierInput } from "@/lib/taxonomy/classifier";
import { getSetting } from "@/server/settings";
import { recordUsage } from "./http";

/**
 * Analyse éditoriale par modèle de langage (optionnelle).
 * Activée seulement si ANTHROPIC_API_KEY est définie ET si l'administration l'active
 * (réglage ai.enabled), dans la limite du budget mensuel. Le modèle est configurable
 * (AI_MODEL ou réglage ai.model). Le modèle n'a accès qu'aux métadonnées fournies :
 * il lui est interdit d'inventer des faits absents de ces métadonnées.
 */

export const PROMPT_VERSION = "analysis-prompt-2026.11.1";

/** Tarifs publics en $ par million de jetons (entrée, sortie) — à tenir à jour. */
const PRICING: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export async function aiModel(): Promise<string> {
  return process.env.AI_MODEL || (await getSetting("ai")).model || "claude-opus-5-5";
}

export async function monthSpendUsd(): Promise<number> {
  const db = await getDb();
  const month = new Date().toISOString().slice(0, 7);
  const r = rows<{ total: string | null }>(await db.execute(sql`select sum(cost_usd)::text as total from api_usage where provider = 'anthropic' and day::text like ${month + "%"}`));
  return Number(r[0]?.total ?? 0);
}

export async function aiEnabled(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const s = await getSetting("ai");
  if (!s.enabled) return false;
  return (await monthSpendUsd()) < s.monthlyBudgetUsd;
}

const scored = z.array(z.object({ slug: z.string(), confidence: z.number().min(0).max(1) }));
const OutputSchema = z.object({
  inScope: z.boolean(),
  relevance: z.number().min(0).max(1),
  universes: scored,
  subcategories: scored,
  themes: scored,
  formats: scored,
  technologies: scored,
  brands: scored,
  models: z.array(z.object({ slug: z.string(), brand: z.string(), confidence: z.number().min(0).max(1) })),
  tags: z.array(z.string()),
  technicalLevel: z.enum(["grand_public", "passionne", "expert"]),
  temporality: z.enum(["evergreen", "dated", "news"]),
  pedagogicalValue: z.number().min(0).max(1),
  technicalDepth: z.number().min(0).max(1),
  historicalInterest: z.number().min(0).max(1),
  originality: z.number().min(0).max(1),
  language: z.string(),
  summary: z.string(),
  signals: z.array(z.string()),
});

const scoredJson = { type: "array", items: { type: "object", properties: { slug: { type: "string" }, confidence: { type: "number" } }, required: ["slug", "confidence"], additionalProperties: false } };
const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["inScope", "relevance", "universes", "subcategories", "themes", "formats", "technologies", "brands", "models", "tags", "technicalLevel", "temporality", "pedagogicalValue", "technicalDepth", "historicalInterest", "originality", "language", "summary", "signals"],
  properties: {
    inScope: { type: "boolean" },
    relevance: { type: "number" },
    universes: scoredJson,
    subcategories: scoredJson,
    themes: scoredJson,
    formats: scoredJson,
    technologies: scoredJson,
    brands: scoredJson,
    models: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, brand: { type: "string" }, confidence: { type: "number" } }, required: ["slug", "brand", "confidence"], additionalProperties: false } },
    tags: { type: "array", items: { type: "string" } },
    technicalLevel: { type: "string", enum: ["grand_public", "passionne", "expert"] },
    temporality: { type: "string", enum: ["evergreen", "dated", "news"] },
    pedagogicalValue: { type: "number" },
    technicalDepth: { type: "number" },
    historicalInterest: { type: "number" },
    originality: { type: "number" },
    language: { type: "string" },
    summary: { type: "string" },
    signals: { type: "array", items: { type: "string" } },
  },
};

function taxonomyText(): string {
  const lines: string[] = [];
  for (const u of UNIVERSES) lines.push(`univers ${u.slug} — sous-catégories : ${u.subs.map((s) => s[0]).join(", ")}`);
  lines.push(`thèmes : ${THEMES.map((t) => t[0]).join(", ")}`);
  lines.push(`formats : ${FORMATS.map((t) => t[0]).join(", ")}`);
  lines.push(`technologies : ${TECHNOLOGIES.map((t) => t[0]).join(", ")}`);
  lines.push(`marques : ${BRANDS.map((b) => b.slug).join(", ")}`);
  lines.push(`modèles (marque/modèle) : ${MODELS.map((m) => `${m.brand}/${m.slug}`).join(", ")}`);
  return lines.join("\n");
}

const SYSTEM = `Tu es l'analyste éditorial d'une médiathèque vidéo consacrée aux véhicules motorisés (automobile, moto, aviation, bateaux, autres véhicules dont trains, engins, fusées).
Tu reçois uniquement les métadonnées publiques d'une vidéo. Règles :
- N'utilise que les informations fournies. N'invente aucun fait, chiffre, recommandation ou source.
- Utilise exclusivement les identifiants (slugs) de la taxonomie fournie ; ignore ce qui n'y figure pas.
- inScope=false si la vidéo ne porte pas réellement sur des véhicules motorisés ou leurs technologies.
- Les notes (0 à 1) sont des estimations prudentes fondées sur le titre, la description, la durée et les mots-clés.
- summary : 1 à 2 phrases en français, factuelles, décrivant le contenu annoncé par les métadonnées (pas d'avis, pas de superlatifs). Chaîne vide si les métadonnées sont insuffisantes.
- signals : courtes justifications citant les éléments observés.

Taxonomie :
${taxonomyText()}`;

let client: Anthropic | null = null;

export async function analyzeWithAi(input: ClassifierInput, heuristic: AnalysisOutput) {
  client ??= new Anthropic();
  const model = await aiModel();
  const user = JSON.stringify({
    title: input.title,
    channel: input.channelName ?? null,
    durationSeconds: input.durationSeconds ?? null,
    description: (input.description ?? "").slice(0, 2500),
    authorTags: (input.providerTags ?? []).slice(0, 30),
    recommendationTitles: (input.evidenceTitles ?? []).slice(0, 5),
    sourceUniverseHint: input.universeHint ?? null,
    heuristicGuess: { universes: heuristic.universes, subcategories: heuristic.subcategories },
  });
  const started = Date.now();
  const response = await client.beta.messages.create({
    model,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Le préfixe système (taxonomie) est stable : mis en cache entre les appels.
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low", format: { type: "json_schema", schema: JSON_SCHEMA } },
    messages: [{ role: "user", content: `Analyse cette vidéo :\n${user}` }],
  });
  const usage = response.usage;
  const [pin, pout] = PRICING[model] ?? PRICING["claude-opus-5-5"];
  const tokensIn = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const costUsd = ((usage.input_tokens ?? 0) * pin + (usage.cache_creation_input_tokens ?? 0) * pin * 1.25 + (usage.cache_read_input_tokens ?? 0) * pin * 0.1 + (usage.output_tokens ?? 0) * pout) / 1e6;
  await recordUsage("anthropic", { requests: 1, units: tokensIn + (usage.output_tokens ?? 0), costUsd });

  if (response.stop_reason === "refusal") throw new Error(`Refus du modèle (${response.stop_details?.category ?? "sans catégorie"})`);
  const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const parsed = OutputSchema.parse(JSON.parse(text));

  // Filtre les identifiants hors taxonomie (le modèle ne peut pas en créer).
  const known = {
    universes: new Set(UNIVERSES.map((u) => u.slug)),
    subs: new Set(UNIVERSES.flatMap((u) => u.subs.map((s) => s[0]))),
    themes: new Set(THEMES.map((t) => t[0])),
    formats: new Set(FORMATS.map((t) => t[0])),
    techs: new Set(TECHNOLOGIES.map((t) => t[0])),
    brands: new Set(BRANDS.map((b) => b.slug)),
    models: new Set(MODELS.map((m) => `${m.brand}/${m.slug}`)),
  };
  const output: AnalysisOutput = {
    ...parsed,
    universes: parsed.universes.filter((x) => known.universes.has(x.slug)).slice(0, 3),
    subcategories: parsed.subcategories.filter((x) => known.subs.has(x.slug)).slice(0, 5),
    themes: parsed.themes.filter((x) => known.themes.has(x.slug)).slice(0, 5),
    formats: parsed.formats.filter((x) => known.formats.has(x.slug)).slice(0, 2),
    technologies: parsed.technologies.filter((x) => known.techs.has(x.slug)).slice(0, 2),
    brands: parsed.brands.filter((x) => known.brands.has(x.slug)),
    models: parsed.models.filter((x) => known.models.has(`${x.brand}/${x.slug}`)),
    tags: parsed.tags.slice(0, 10),
    summary: parsed.summary.trim() || undefined,
    sensationalism: heuristic.sensationalism,
  };
  if (output.inScope && !output.universes.length) output.inScope = false;
  return {
    output,
    provider: "anthropic",
    model: response.model,
    promptVersion: PROMPT_VERSION,
    tokensIn,
    tokensOut: usage.output_tokens ?? 0,
    costUsd: Math.round(costUsd * 1e6) / 1e6,
    durationMs: Date.now() - started,
  };
}
