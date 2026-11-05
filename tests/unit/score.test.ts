import { describe, expect, it } from "vitest";
import type { AnalysisOutput } from "@/db/schema";
import { aggregateEvidence, buildSelectionReason, computeScore, decideStatus, type EvidenceLite, type ScoreInput } from "@/server/curation/score";
import { DEFAULT_SETTINGS } from "@/server/settings";

const cfg = DEFAULT_SETTINGS.scoring;
const analysis = (o: Partial<AnalysisOutput> = {}): AnalysisOutput => ({
  inScope: true,
  relevance: 0.85,
  universes: [{ slug: "aviation", confidence: 0.85 }],
  subcategories: [],
  themes: [],
  formats: [],
  technologies: [],
  brands: [],
  models: [],
  tags: [],
  temporality: "evergreen",
  signals: [],
  ...o,
});
const hn = (author: string, date: string, points: number | null = null, kind: EvidenceLite["kind"] = "community_comment"): EvidenceLite => ({
  kind,
  independenceKey: `hn:user:${author}`,
  points,
  occurredAt: new Date(date),
  sourceName: "Hacker News",
});
const base = (o: Partial<ScoreInput> = {}): ScoreInput => ({
  analysis: analysis(),
  durationSeconds: 1800,
  publishedAt: new Date("2015-01-01"),
  viewCount: null,
  isShort: false,
  embeddable: true,
  creator: null,
  evidence: [],
  editorialPick: false,
  now: new Date("2026-11-01"),
  ...o,
});

describe("agrégation des preuves", () => {
  it("compte les recommandeurs distincts et les mois distincts", () => {
    const agg = aggregateEvidence([hn("a", "2015-01-05"), hn("a", "2015-03-01"), hn("b", "2019-06-01"), hn("c", "2021-02-01", 300, "community_upvote")]);
    expect(agg.recommenderCount).toBe(3);
    expect(agg.recommendationMonths).toBe(4);
    expect(agg.maxPoints).toBe(300);
  });
  it("ne compte pas une chaîne suivie comme recommandation indépendante", () => {
    const agg = aggregateEvidence([{ kind: "curated_channel", independenceKey: "channel:x", points: null, occurredAt: null, sourceName: "X" }]);
    expect(agg.recommenderCount).toBe(0);
  });
});

describe("notation", () => {
  it("exclut les critères non mesurables au lieu de les inventer", () => {
    const r = computeScore(base(), cfg);
    const rarity = r.breakdown.criteria.find((c) => c.key === "rarity")!;
    expect(rarity.available).toBe(false);
    expect(r.confidence).toBeLessThan(1);
  });
  it("valorise des recommandations indépendantes répétées dans le temps", () => {
    const weak = computeScore(base({ evidence: [hn("a", "2015-01-05", 5, "community_upvote")] }), cfg);
    const strong = computeScore(base({ evidence: [hn("a", "2015-01-05", 400, "community_upvote"), hn("b", "2017-05-01"), hn("c", "2020-01-01"), hn("d", "2023-08-01")] }), cfg);
    expect(strong.total).toBeGreaterThan(weak.total);
    expect(strong.aggregates.recommenderCount).toBe(4);
  });
  it("ne qualifie de pépite qu'une vidéo recommandée et vue moins de 100 000 fois", () => {
    const ev = [hn("a", "2015-01-05", 200, "community_upvote"), hn("b", "2018-01-01")];
    expect(computeScore(base({ viewCount: 40_000, evidence: ev }), cfg).discoveryScore).toBeGreaterThan(0);
    expect(computeScore(base({ viewCount: 975_000, evidence: ev }), cfg).discoveryScore).toBeNull();
  });
  it("ne récompense pas la rareté sans recommandation", () => {
    const r = computeScore(base({ viewCount: 500 }), cfg);
    expect(r.breakdown.criteria.find((c) => c.key === "rarity")!.available).toBe(false);
    expect(r.discoveryScore).toBeNull();
  });
  it("pénalise les Shorts et les titres racoleurs", () => {
    const normal = computeScore(base({ evidence: [hn("a", "2020-01-01", 50, "community_upvote")] }), cfg);
    const short = computeScore(base({ isShort: true, evidence: [hn("a", "2020-01-01", 50, "community_upvote")] }), cfg);
    const clickbait = computeScore(base({ analysis: analysis({ sensationalism: 2 }), evidence: [hn("a", "2020-01-01", 50, "community_upvote")] }), cfg);
    expect(short.total).toBe(Math.max(0, normal.total - cfg.penalties.short));
    expect(clickbait.total).toBeLessThan(normal.total);
  });
  it("garde la note entre 0 et 100", () => {
    const r = computeScore(base({ isShort: true, analysis: analysis({ relevance: 0, inScope: false }) }), cfg);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });
});

describe("décision de publication", () => {
  const t = cfg.thresholds;
  it("publie au-dessus des seuils, place les cas incertains en validation, rejette le reste", () => {
    expect(decideStatus({ total: 70, confidence: 0.6, relevance: 0.9, inScope: true, availability: "available", isShort: false }, t, true).status).toBe("published");
    expect(decideStatus({ total: 70, confidence: 0.2, relevance: 0.9, inScope: true, availability: "available", isShort: false }, t, true).status).toBe("pending_review");
    expect(decideStatus({ total: 10, confidence: 0.9, relevance: 0.9, inScope: true, availability: "available", isShort: false }, t, true).status).toBe("rejected");
    expect(decideStatus({ total: 90, confidence: 0.9, relevance: 0.9, inScope: false, availability: "available", isShort: false }, t, true).status).toBe("rejected");
    expect(decideStatus({ total: 90, confidence: 0.9, relevance: 0.9, inScope: true, availability: "unavailable", isShort: false }, t, true).status).toBe("unavailable");
  });
  it("sans publication automatique, tout passe par la validation humaine", () => {
    expect(decideStatus({ total: 90, confidence: 0.9, relevance: 0.9, inScope: true, availability: "available", isShort: false }, t, false).status).toBe("pending_review");
  });
  it("exclut les diffusions en direct, même très bien notées", () => {
    expect(decideStatus({ total: 95, confidence: 0.9, relevance: 0.9, inScope: true, availability: "available", isShort: false, isLive: true }, t, true).status).toBe("rejected");
  });
});

describe("justification de sélection", () => {
  it("ne cite que des preuves enregistrées", () => {
    const input = base({ evidence: [hn("a", "2014-01-01", 120, "community_upvote"), hn("b", "2016-01-01"), hn("c", "2019-01-01")] });
    const reason = buildSelectionReason(input, computeScore(input, cfg));
    expect(reason).toMatch(/Hacker News \(120 points/);
    expect(reason).toMatch(/2 personnes distinctes entre 2016 et 2019/);
    expect(reason).not.toMatch(/rédaction/);
  });
  it("mentionne la sélection éditoriale uniquement si elle existe", () => {
    const input = base({ editorialPick: true });
    expect(buildSelectionReason(input, computeScore(input, cfg))).toMatch(/Sélectionnée par la rédaction/);
  });
});
