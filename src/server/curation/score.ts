import type { AnalysisOutput, Availability, EvidenceKind, ScoreBreakdown, ScoreCriterion, VideoStatus } from "@/db/schema";
import type { Settings } from "@/server/settings";

/**
 * Notation qualitative sur 100, explicable. Chaque critère indique s'il est
 * mesurable avec les données disponibles ; les critères non mesurables sont exclus
 * du calcul (et réduisent la confiance) au lieu d'être inventés.
 */

export type EvidenceLite = {
  kind: EvidenceKind;
  independenceKey: string;
  points: number | null;
  commentsCount?: number | null;
  occurredAt: Date | null;
  sourceName: string;
};

export type ScoreInput = {
  analysis: AnalysisOutput;
  durationSeconds: number | null;
  publishedAt: Date | null;
  viewCount: number | null;
  isShort: boolean;
  embeddable: boolean | null;
  creator: { name?: string | null; trustLevel: number | null; isCuratedSource: boolean; isOfficial: boolean } | null;
  evidence: EvidenceLite[];
  editorialPick: boolean;
  now?: Date;
};

export type ScoreResult = {
  breakdown: ScoreBreakdown;
  total: number;
  confidence: number;
  discoveryScore: number | null;
  aggregates: {
    recommenderCount: number;
    recommendationMonths: number;
    communityPoints: number;
    firstRecommendedAt: Date | null;
    lastRecommendedAt: Date | null;
  };
};

const INDEPENDENT_KINDS: EvidenceKind[] = ["community_upvote", "community_comment", "expert_mention", "user_suggestion", "editorial_pick"];
const r2 = (x: number) => Math.round(x * 100) / 100;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const pct = (x: number) => `${Math.round(x * 100)} %`;

export function aggregateEvidence(evidence: EvidenceLite[]) {
  const independent = evidence.filter((e) => INDEPENDENT_KINDS.includes(e.kind));
  const keys = new Set(independent.map((e) => e.independenceKey));
  const months = new Set(independent.filter((e) => e.occurredAt).map((e) => e.occurredAt!.toISOString().slice(0, 7)));
  const years = new Set(independent.filter((e) => e.occurredAt).map((e) => e.occurredAt!.getUTCFullYear()));
  const dates = independent.map((e) => e.occurredAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime());
  const points = independent.filter((e) => e.kind === "community_upvote").reduce((s, e) => s + (e.points ?? 0), 0);
  const maxPoints = Math.max(0, ...independent.filter((e) => e.kind === "community_upvote").map((e) => e.points ?? 0));
  return {
    recommenderCount: keys.size,
    recommendationMonths: months.size,
    years: years.size,
    communityPoints: points,
    maxPoints,
    firstRecommendedAt: dates[0] ?? null,
    lastRecommendedAt: dates[dates.length - 1] ?? null,
  };
}

export function computeScore(input: ScoreInput, cfg: Settings["scoring"]): ScoreResult {
  const now = input.now ?? new Date();
  const a = input.analysis;
  const w = cfg.weights;
  const agg = aggregateEvidence(input.evidence);
  const criteria: ScoreCriterion[] = [];
  const add = (key: keyof typeof w, score: number | null, basis: string) =>
    criteria.push({ key, weight: w[key], score: score == null ? 0 : r2(clamp(score)), basis, available: score != null });

  const universe = a.universes[0]?.slug;
  add("relevance", a.inScope ? a.relevance : 0, a.inScope ? `Pertinence thématique estimée à ${pct(a.relevance)}${universe ? ` (univers principal : ${universe})` : ""}` : "Hors du périmètre des véhicules motorisés");
  add("technicalDepth", a.technicalDepth ?? null, a.technicalDepth != null ? `Profondeur technique estimée à ${pct(a.technicalDepth)} d'après le titre, la description et la durée` : "Aucun signal détecté dans les métadonnées (non mesurable)");
  add("pedagogy", a.pedagogicalValue ?? null, a.pedagogicalValue != null ? `Valeur pédagogique estimée à ${pct(a.pedagogicalValue)}` : "Aucun signal détecté dans les métadonnées (non mesurable)");
  add("historicalInterest", a.historicalInterest ?? null, a.historicalInterest != null ? `Intérêt historique estimé à ${pct(a.historicalInterest)}` : "Pas de dimension historique détectée (non mesurable)");
  add("originality", a.originality ?? null, a.originality != null ? `Originalité estimée à ${pct(a.originality)}` : "Non mesurable sans analyse par modèle de langage");

  if (input.creator?.trustLevel != null) {
    const label = input.creator.isOfficial ? "chaîne officielle" : input.creator.isCuratedSource ? "chaîne spécialisée suivie" : "chaîne évaluée";
    add("creatorCredibility", input.creator.trustLevel / 100, `${input.creator.name ?? "Chaîne"} : ${label} (confiance ${input.creator.trustLevel}/100)`);
  } else add("creatorCredibility", null, "Crédibilité de la chaîne non évaluée");

  const n = agg.recommenderCount;
  // Deux signaux indépendants : le nombre de recommandeurs distincts et les votes d'une communauté
  // (chaque point HN ou Reddit est un vote individuel). On retient le plus fort des deux.
  const byPeople = n === 0 ? 0 : 1 - Math.exp(-n / 2.2);
  const byVotes = agg.maxPoints > 0 ? clamp(Math.log10(agg.maxPoints) / Math.log10(600)) : 0;
  const recScore = n === 0 ? 0 : clamp(Math.max(byPeople, byVotes) + Math.min(byPeople, byVotes) * 0.15);
  const recBasis = n === 0 ? "Aucune recommandation indépendante enregistrée" : `${n} recommandeur${n > 1 ? "s" : ""} distinct${n > 1 ? "s" : ""}${agg.maxPoints ? ` ; soumission votée ${agg.maxPoints} fois` : ""}`;
  add("independentRecommendations", recScore, recBasis);

  if (n > 0) {
    const m = agg.recommendationMonths;
    const rec = clamp((m >= 5 ? 0.9 : m >= 3 ? 0.7 : m === 2 ? 0.5 : 0.15) + (agg.years >= 3 ? 0.1 : 0));
    add("recurrence", rec, `Recommandée sur ${m} mois distinct${m > 1 ? "s" : ""}, ${agg.years} année${agg.years > 1 ? "s" : ""} différente${agg.years > 1 ? "s" : ""}`);
  } else add("recurrence", null, "Pas de recommandation datée");

  const temporality = a.temporality ?? "evergreen";
  let durable = temporality === "evergreen" ? 0.8 : temporality === "dated" ? 0.5 : 0.15;
  const longevity = input.publishedAt && agg.lastRecommendedAt ? (agg.lastRecommendedAt.getTime() - input.publishedAt.getTime()) / (365.25 * 86400e3) : agg.firstRecommendedAt && agg.lastRecommendedAt ? (agg.lastRecommendedAt.getTime() - agg.firstRecommendedAt.getTime()) / (365.25 * 86400e3) : 0;
  if (longevity >= 2) durable += 0.15;
  add("durableValue", durable, `Contenu ${temporality === "evergreen" ? "durable" : temporality === "dated" ? "daté" : "d'actualité"}${longevity >= 2 ? `, encore recommandé ${Math.floor(longevity)} ans plus tard` : ""}`);

  // La rareté ne récompense qu'une vidéo déjà recommandée (« pépite ») : peu de vues seules ne prouvent rien.
  if (input.viewCount != null && n > 0) {
    const v = input.viewCount;
    const rarity = v < 10_000 ? 1 : v < 100_000 ? 0.8 : v < 1_000_000 ? 0.5 : v < 10_000_000 ? 0.25 : 0.1;
    add("rarity", rarity, `${v.toLocaleString("fr-FR")} vues sur YouTube`);
  } else add("rarity", null, input.viewCount == null ? "Nombre de vues inconnu" : "Sans recommandation, la rareté n'est pas un critère de qualité");

  if (temporality !== "evergreen" && input.publishedAt) {
    const ageY = (now.getTime() - input.publishedAt.getTime()) / (365.25 * 86400e3);
    add("freshness", ageY < 1 ? 1 : ageY < 3 ? 0.6 : 0.2, `Publiée il y a ${ageY < 1 ? "moins d'un an" : `${Math.floor(ageY)} an(s)`}`);
  } else add("freshness", null, temporality === "evergreen" ? "Sans objet pour un contenu durable" : "Date de publication inconnue");

  const penalties: ScoreBreakdown["penalties"] = [];
  if (input.isShort) penalties.push({ key: "short", points: cfg.penalties.short, basis: "Format Shorts" });
  else if (input.durationSeconds != null && input.durationSeconds < 90) penalties.push({ key: "veryShort", points: cfg.penalties.veryShort, basis: "Durée inférieure à 90 secondes" });
  if (a.sensationalism) penalties.push({ key: "sensational", points: cfg.penalties.sensational * Math.min(2, a.sensationalism), basis: "Titre racoleur" });
  if (input.embeddable === false) penalties.push({ key: "embedDisabled", points: cfg.penalties.embedDisabled, basis: "Lecture intégrée désactivée par l'auteur" });

  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const availWeight = criteria.filter((c) => c.available).reduce((s, c) => s + c.weight, 0);
  const raw = availWeight > 0 ? criteria.filter((c) => c.available).reduce((s, c) => s + c.score * c.weight, 0) / availWeight : 0;
  const total = Math.round(clamp(raw * 100 - penalties.reduce((s, p) => s + p.points, 0), 0, 100));
  const classConf = a.universes[0]?.confidence ?? 0;
  const confidence = r2((availWeight / totalWeight) * (0.5 + 0.5 * classConf) * (input.durationSeconds == null ? 0.9 : 1));

  const rarity = criteria.find((c) => c.key === "rarity");
  const discoveryScore = rarity?.available ? Math.round(total * rarity.score * (n > 0 ? 1 : 0.7)) : null;

  return {
    breakdown: { version: cfg.version, total, confidence, criteria, penalties },
    total,
    confidence,
    discoveryScore,
    aggregates: {
      recommenderCount: agg.recommenderCount,
      recommendationMonths: agg.recommendationMonths,
      communityPoints: agg.communityPoints,
      firstRecommendedAt: agg.firstRecommendedAt,
      lastRecommendedAt: agg.lastRecommendedAt,
    },
  };
}

export function decideStatus(
  p: { total: number; confidence: number; relevance: number; inScope: boolean; availability: Availability; isShort: boolean },
  cfg: Settings["scoring"]["thresholds"],
  autoPublish: boolean,
): { status: VideoStatus; reason: string } {
  if (p.availability === "unavailable" || p.availability === "private") return { status: "unavailable", reason: "Vidéo indisponible chez le fournisseur" };
  if (!p.inScope) return { status: "rejected", reason: "Hors périmètre thématique" };
  if (p.isShort) return { status: "rejected", reason: "Format Shorts exclu" };
  if (p.total >= cfg.publish && p.confidence >= cfg.minConfidence && p.relevance >= cfg.minRelevance) {
    return autoPublish ? { status: "published", reason: `Publication automatique : score ${p.total}, confiance ${p.confidence}` } : { status: "pending_review", reason: "Publication automatique désactivée" };
  }
  if (p.total >= cfg.review) return { status: "pending_review", reason: `Cas incertain : score ${p.total}, confiance ${p.confidence}, pertinence ${p.relevance}` };
  return { status: "rejected", reason: `Score insuffisant (${p.total})` };
}

/** Justification factuelle de la sélection, construite uniquement à partir de preuves enregistrées. */
export function buildSelectionReason(input: ScoreInput, result: ScoreResult): string {
  const parts: string[] = [];
  if (input.editorialPick) parts.push("Sélectionnée par la rédaction.");
  const hnStories = input.evidence.filter((e) => e.kind === "community_upvote" && e.sourceName === "Hacker News");
  const hnComments = input.evidence.filter((e) => e.kind === "community_comment" && e.sourceName === "Hacker News");
  if (hnStories.length) {
    const best = hnStories.reduce((a, b) => ((a.points ?? 0) >= (b.points ?? 0) ? a : b));
    parts.push(`Partagée sur Hacker News${best.points ? ` (${best.points} points${best.commentsCount ? `, ${best.commentsCount} commentaires` : ""})` : ""}.`);
  }
  const people = new Set(hnComments.map((e) => e.independenceKey)).size;
  if (people) {
    const years = hnComments.map((e) => e.occurredAt?.getUTCFullYear()).filter((y): y is number => Boolean(y));
    const span = years.length ? (Math.min(...years) === Math.max(...years) ? ` en ${Math.min(...years)}` : ` entre ${Math.min(...years)} et ${Math.max(...years)}`) : "";
    parts.push(`Citée dans les discussions Hacker News par ${people} personne${people > 1 ? "s" : ""} distincte${people > 1 ? "s" : ""}${span}.`);
  }
  const reddit = input.evidence.filter((e) => e.sourceName.startsWith("r/"));
  if (reddit.length) parts.push(`Recommandée sur ${[...new Set(reddit.map((e) => e.sourceName))].join(", ")}.`);
  if (input.creator?.isOfficial) parts.push(`Chaîne officielle : ${input.creator.name}.`);
  else if (input.creator?.isCuratedSource) parts.push(`Publiée par ${input.creator.name}, chaîne spécialisée suivie par la rédaction.`);
  const strengths = result.breakdown.criteria
    .filter((c) => c.available && c.score >= 0.6 && ["technicalDepth", "pedagogy", "historicalInterest", "durableValue", "rarity"].includes(c.key))
    .map((c) => ({ technicalDepth: "profondeur technique", pedagogy: "valeur pédagogique", historicalInterest: "intérêt historique", durableValue: "contenu durable", rarity: "peu vue au regard de son intérêt" })[c.key as "rarity"]);
  if (strengths.length) parts.push(`Points forts estimés : ${strengths.join(", ")}.`);
  return parts.join(" ");
}
