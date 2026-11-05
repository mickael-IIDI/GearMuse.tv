import type { AnalysisOutput } from "@/db/schema";
import { guessLanguage, normalize, pad } from "@/lib/text";
import { BRANDS, MODELS } from "./brands";
import { FORMATS, TECHNOLOGIES, THEMES, UNIVERSES } from "./data";

/**
 * Classifieur heuristique (sans modèle de langage). Déterministe et explicable :
 * chaque décision est accompagnée des signaux textuels observés.
 * Version enregistrée dans ai_analysis.model_version.
 */
export const HEURISTIC_VERSION = "heuristic-2026.11.1";

export type ClassifierInput = {
  title: string;
  description?: string | null;
  providerTags?: string[] | null;
  evidenceTitles?: string[];
  channelName?: string | null;
  /** Univers attendu de la source (chaîne spécialisée…). */
  universeHint?: string | null;
  durationSeconds?: number | null;
};

type Kw = { phrase: string; strong: boolean };
const parseKws = (list: string[]): Kw[] =>
  list.map((k) => (k.startsWith("!") ? { phrase: normalize(k.slice(1)), strong: true } : { phrase: normalize(k), strong: false }));

/** Expressions qui produisent des faux positifs (informatique, idiomes…). Retirées avant analyse. */
const EXCLUSIONS = [
  "guy kawasaki", "harrison ford", "tom ford", "gerald ford", "ford foundation", "lotus notes", "lotus software", "jaguar land rover pension",
  "search engine", "search engines", "game engine", "game engines", "rendering engine", "javascript engine", "js engine",
  "physics engine", "unreal engine", "unity engine", "template engine", "inference engine", "query engine",
  "database engine", "storage engine", "rule engine", "rules engine", "workflow engine", "chess engine", "engine optimization",
  "v8 javascript", "v8 engine javascript", "chrome v8", "node js", "rust lang", "rust programming", "rust language", "in rust",
  "written in rust", "rust compiler", "control plane", "data plane", "airplane mode", "complex plane", "plane geometry",
  "train a model", "train the model", "train your model", "train a neural", "train neural", "think tank", "fish tank",
  "tank top", "septic tank", "water tank", "rocket league", "rocket chat", "not rocket science", "rocket science",
  "usb bus", "pci bus", "bus factor", "event bus", "message bus", "data bus", "system bus", "i2c bus", "spi bus",
  "race condition", "race conditions", "data race", "arms race", "human race", "audit trail", "paper trail", "quad core",
  "f1 score", "ship it", "ship code", "ship software", "ship fast", "ship faster", "ship products", "we ship",
  "github copilot", "pilot program", "pilot episode", "pilot study", "crash course", "server crash", "market crash",
  "stock market crash", "crypto crash", "app crash", "data transmission", "flight of ideas", "car talk podcast",
  "hacker news", "launch hn", "show hn", "ask hn", "product launch", "launch week", "space bar", "spaceship operator",
  "drag and drop", "drag queen", "ted talk", "vehicle for", "engine of growth", "growth engine", "economic engine",
  "fork in the road", "cargo cult", "cargo build", "rust cargo", "jet lag", "jetbrains", "orbit around the sun",
];

/** Univers dont les mots-clés faibles exigent un signal fort ailleurs. */
const UNIVERSE_KWS = UNIVERSES.map((u) => ({
  slug: u.slug,
  kws: parseKws(u.keywords),
  subs: u.subs.map(([slug, , , kws]) => ({ slug, kws: parseKws(kws) })),
}));
const THEME_KWS = THEMES.map(([slug, , , kws]) => ({ slug, kws: parseKws(kws) }));
const FORMAT_KWS = FORMATS.map(([slug, , , kws]) => ({ slug, kws: parseKws(kws) }));
const TECH_KWS = TECHNOLOGIES.map(([slug, , , kws]) => ({ slug, kws: parseKws(kws) }));

const BRAND_MATCHERS = BRANDS.map((b) => ({
  def: b,
  phrases: [...new Set([...(b.ambiguous ? [] : [normalize(b.name), normalize(b.slug.replace(/-/g, " "))]), ...(b.aliases ?? []).map(normalize)])].filter(Boolean),
}));
const MODEL_MATCHERS = MODELS.map((m) => ({ def: m, phrases: [...new Set(m.aliases.map(normalize))] }));

/** Contextes de jeu vidéo ou de fiction : la vidéo ne porte pas sur un véhicule réel. */
const GAME_CONTEXT = ["minecraft", "fortnite", "roblox", "gta", "gta v", "video game", "jeu video", "gameplay", "let s play", "speedrun", "gran turismo 7", "forza horizon", "xbox", "playstation", "nintendo", "announce trailer", "gameplay trailer", "game trailer",
  // moteurs de jeu et conférences de programmation (« Ship Comms… C++ », « Titanic… Unreal Engine 4 »)
  "unreal engine", "unreal engine 4", "unreal engine 5", "ue4", "ue5", "unity3d", "lightning talk", "cppcon", "cppnow", "pycon", "fosdem", "strange loop"];
const SENSATIONAL = ["you won t believe", "insane", "shocking", "gone wrong", "must see", "unbelievable", "craziest", "omg", "destroyed", "exposed", "scam", "clickbait"];
const NEWS_MARKERS = ["live", "watch live", "replay", "news conference", "press conference", "hearing", "whistleblower", "stock", "earnings", "lawsuit", "recall", "news", "breaking", "this week", "announced", "announcement", "reveal", "revealed", "leaked", "leak", "rumor", "rumors", "actualite", "actu", "nouveaute", "update", "just dropped", "first look", "debut", "unveiled", "salon", "auto show", "motor show", "live stream", "livestream"];
const EVERGREEN_MARKERS = ["history", "histoire", "documentary", "documentaire", "how it works", "comment ca marche", "explained", "explique", "restoration", "restauration", "lecture", "conference", "the story of", "why", "pourquoi", "how does", "engineering", "teardown", "cutaway", "tutorial", "tutoriel", "how to"];
const TECH_DEPTH = ["engineering", "ingenierie", "explained", "explique", "how it works", "comment ca marche", "teardown", "cutaway", "analysis", "analyse", "physics", "physique", "thermodynamics", "thermodynamique", "aerodynamics", "aerodynamique", "design", "technical", "technique", "in depth", "deep dive", "lecture", "conference", "efficiency", "rendement", "combustion", "compression", "torque", "couple", "fluid", "material", "materiaux", "metallurgy", "tolerances", "machining", "usinage", "simulation", "cfd", "math", "calculation"];
const PEDAGOGY = ["explained", "explique", "how it works", "comment ca marche", "how does", "why do", "why does", "tutorial", "tutoriel", "how to", "lesson", "lecon", "lecture", "course", "cours", "beginner", "debutant", "guide", "animation", "animated", "step by step", "pas a pas", "understanding", "comprendre", "basics", "bases", "introduction"];

type Field = { text: string; weight: number; label: string };

function stripExclusions(n: string): string {
  let s = pad(n);
  for (const e of EXCLUSIONS) {
    if (s.includes(` ${e} `)) s = s.split(` ${e} `).join(" ");
  }
  // contexte informatique : « v8 » désigne alors le moteur JavaScript
  if (/ (javascript|chrome|nodejs|node|wasm|webassembly|compiler|interpreter) /.test(s)) s = s.replace(/ v8 /g, " ");
  return s;
}

function scoreKws(fields: Field[], kws: Kw[], signals?: Set<string>): { score: number; strongHits: string[]; hits: string[] } {
  let score = 0;
  const hits: string[] = [];
  const strongHits: string[] = [];
  for (const kw of kws) {
    if (!kw.phrase) continue;
    let best = 0;
    for (const f of fields) {
      if (f.text.includes(` ${kw.phrase} `)) {
        const w = (kw.strong ? 2.5 : 1) * f.weight;
        if (w > best) best = w;
        if (signals && f.weight >= 2) signals.add(`${f.label} : « ${kw.phrase} »`);
      }
    }
    if (best > 0) {
      score += best;
      hits.push(kw.phrase);
      if (kw.strong) strongHits.push(kw.phrase);
    }
  }
  return { score, strongHits, hits };
}

const toConf = (raw: number, scale: number) => Math.round((1 - Math.exp(-raw / scale)) * 100) / 100;

export function classify(input: ClassifierInput): AnalysisOutput & { universeScores: Record<string, number> } {
  const signals = new Set<string>();
  const titleN = normalize(input.title);
  const fields: Field[] = [
    { text: stripExclusions(titleN), weight: 3, label: "Titre" },
    { text: stripExclusions(normalize((input.providerTags ?? []).join(" | "))), weight: 2, label: "Mots-clés de l'auteur" },
    { text: stripExclusions(normalize((input.evidenceTitles ?? []).join(" | "))), weight: 2, label: "Titre de la recommandation" },
    { text: stripExclusions(normalize((input.description ?? "").slice(0, 1500))), weight: 0.6, label: "Description" },
    { text: stripExclusions(normalize(input.channelName ?? "")), weight: 1.5, label: "Chaîne" },
  ];
  const all = fields.map((f) => f.text).join(" ");

  // Marques et modèles
  const brandHits = new Map<string, number>();
  for (const bm of BRAND_MATCHERS) {
    for (const p of bm.phrases) {
      for (const f of fields) {
        if (f.text.includes(` ${p} `)) {
          brandHits.set(bm.def.slug, Math.max(brandHits.get(bm.def.slug) ?? 0, f.weight));
          if (f.weight >= 2) signals.add(`Marque : ${bm.def.name}`);
        }
      }
    }
  }
  const modelHits = new Map<string, { brand: string; w: number; universe: string }>();
  for (const mm of MODEL_MATCHERS) {
    if (mm.def.requiresBrand && !brandHits.has(mm.def.brand)) continue;
    for (const p of mm.phrases) {
      for (const f of fields) {
        if (f.text.includes(` ${p} `)) {
          const key = `${mm.def.brand}/${mm.def.slug}`;
          const prev = modelHits.get(key);
          if (!prev || prev.w < f.weight) modelHits.set(key, { brand: mm.def.brand, w: f.weight, universe: mm.def.universe });
          if (f.weight >= 2) signals.add(`Modèle : ${mm.def.name}`);
        }
      }
    }
  }
  // un modèle détecté implique sa marque
  for (const [, m] of modelHits) if (!brandHits.has(m.brand)) brandHits.set(m.brand, m.w);

  // Univers
  const universeScores: Record<string, number> = {};
  /** Part du score issue de mots-clés (hors marques) : une marque seule ne suffit pas (homonymes : « Guy Kawasaki »…). */
  const keywordScores: Record<string, number> = {};
  const strongByUniverse: Record<string, string[]> = {};
  for (const u of UNIVERSE_KWS) {
    const r = scoreKws(fields, u.kws, signals);
    let s = r.score;
    // les sous-catégories contribuent faiblement à l'univers (évite les doubles comptes)
    for (const sub of u.subs) s += scoreKws(fields, sub.kws.filter((k) => k.strong)).score * 0.25;
    universeScores[u.slug] = s;
    keywordScores[u.slug] = s;
    strongByUniverse[u.slug] = r.strongHits;
  }
  for (const [slug, w] of brandHits) {
    const b = BRANDS.find((x) => x.slug === slug)!;
    for (const u of b.universes) universeScores[u] = (universeScores[u] ?? 0) + 2 * w / b.universes.length;
  }
  for (const [, m] of modelHits) universeScores[m.universe] = (universeScores[m.universe] ?? 0) + 2.5 * m.w;
  if (input.universeHint && universeScores[input.universeHint] !== undefined) {
    universeScores[input.universeHint] += 4;
    signals.add(`Source spécialisée : ${input.universeHint}`);
  }

  const contextText = pad(`${titleN} ${normalize(input.channelName ?? "")}`);
  const gameHits = GAME_CONTEXT.filter((p) => contextText.includes(` ${p} `)).length;
  if (gameHits) {
    for (const k of Object.keys(universeScores)) universeScores[k] *= 0.3;
    signals.add("Contexte de jeu vidéo détecté dans le titre");
  }
  const ranked = Object.entries(universeScores).sort((a, b) => b[1] - a[1]);
  const [topSlug, topScore] = ranked[0];
  const IN_SCOPE_MIN = 4.5;
  const hasModel = [...modelHits.values()].some((m) => m.universe === topSlug);
  // Ni une marque seule ni la seule thématique de la chaîne ne suffisent : il faut au moins un mot-clé véhicule.
  const inScope = !gameHits && topScore >= IN_SCOPE_MIN && ((keywordScores[topSlug] ?? 0) >= 1 || hasModel);
  if (topScore >= IN_SCOPE_MIN && !inScope) signals.add("Aucun mot-clé véhicule (marque ou thème de chaîne seuls) : hors périmètre");
  // Titre « allusif » : ni le titre ni les titres de recommandation ne citent un véhicule (seuls la description,
  // les mots-clés de l'auteur ou la chaîne le font). La pertinence est réduite : la vidéo part en validation
  // humaine plutôt qu'en publication automatique.
  const topDef = UNIVERSE_KWS.find((u) => u.slug === topSlug);
  const explicitFields = [fields[0], fields[2]];
  const explicitKw = topDef ? scoreKws(explicitFields, [...topDef.kws, ...topDef.subs.flatMap((s) => s.kws)]).score > 0 : false;
  const explicitEntity =
    BRAND_MATCHERS.some((bm) => brandHits.has(bm.def.slug) && bm.phrases.some((p) => explicitFields.some((f) => f.text.includes(` ${p} `)))) ||
    MODEL_MATCHERS.some((mm) => modelHits.has(`${mm.def.brand}/${mm.def.slug}`) && mm.phrases.some((p) => explicitFields.some((f) => f.text.includes(` ${p} `))));
  const allusive = inScope && !explicitKw && !explicitEntity;
  if (allusive) signals.add("Titre sans référence explicite à un véhicule : pertinence réduite, validation humaine conseillée");
  const relevance = allusive ? Math.round(toConf(topScore, 7) * 0.6 * 100) / 100 : toConf(topScore, 7);
  const selectedUniverses = inScope
    ? ranked.filter(([, s], i) => i === 0 || (s >= IN_SCOPE_MIN && s >= topScore * 0.45)).slice(0, 3)
    : [];

  // Sous-catégories des univers retenus
  const subcategories: { slug: string; confidence: number }[] = [];
  for (const [uSlug] of selectedUniverses) {
    const u = UNIVERSE_KWS.find((x) => x.slug === uSlug)!;
    const subScores = u.subs
      .map((sub) => ({ slug: sub.slug, s: scoreKws(fields, sub.kws, signals).score }))
      .filter((x) => x.s >= 2.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    for (const x of subScores) subcategories.push({ slug: x.slug, confidence: toConf(x.s, 6) });
  }

  const pick = (list: { slug: string; kws: Kw[] }[], min: number, max: number, scale: number) =>
    list
      .map((x) => ({ slug: x.slug, s: scoreKws(fields, x.kws).score }))
      .filter((x) => x.s >= min)
      .sort((a, b) => b.s - a.s)
      .slice(0, max)
      .map((x) => ({ slug: x.slug, confidence: toConf(x.s, scale) }));

  const themes = inScope ? pick(THEME_KWS, 2.5, 4, 6) : [];
  const formats = inScope ? pick(FORMAT_KWS, 2.5, 2, 6) : [];
  const technologies = inScope ? pick(TECH_KWS, 2.5, 2, 6) : [];

  // Tags : expressions fortes trouvées dans le titre ou les mots-clés de l'auteur
  const tagSet = new Set<string>();
  for (const u of selectedUniverses) for (const h of strongByUniverse[u[0]] ?? []) if (fields[0].text.includes(` ${h} `)) tagSet.add(h);
  for (const t of [...THEME_KWS, ...TECH_KWS]) for (const kw of t.kws) if (kw.strong && kw.phrase.length > 2 && fields[0].text.includes(` ${kw.phrase} `)) tagSet.add(kw.phrase);

  // Niveau, temporalité, profondeur
  const count = (list: string[]) => list.filter((p) => all.includes(` ${p} `)).length;
  const titleCount = (list: string[]) => list.filter((p) => fields[0].text.includes(` ${p} `)).length;
  const depthHits = count(TECH_DEPTH) + titleCount(TECH_DEPTH);
  const pedaHits = count(PEDAGOGY) + titleCount(PEDAGOGY);
  const longForm = (input.durationSeconds ?? 0) >= 1200;
  const howWorks = /\bhow\b.{0,60}\b(work|works|worked|is made|are made|is built|are built|built|fly|flies|operate|operates)\b|\bcomment\b.{0,60}\b(fonctionne|marche|construit|fabrique|vole)\b|\b(explained|explique|demystified|the basics|101)\b/.test(titleN);
  const whyQ = /^(why|pourquoi)\b/.test(titleN);
  const technicalDepth = Math.min(1, 0.15 + depthHits * 0.14 + (longForm ? 0.1 : 0) + (howWorks ? 0.25 : 0));
  const pedagogicalValue = Math.min(1, 0.15 + pedaHits * 0.16 + (howWorks ? 0.4 : 0) + (whyQ ? 0.15 : 0));
  const historyTheme = themes.find((t) => t.slug === "histoire");
  const historicalInterest = historyTheme ? Math.min(1, 0.3 + historyTheme.confidence * 0.7) : 0.1;

  const isLecture = formats.some((f) => f.slug === "conference");
  const technicalLevel: AnalysisOutput["technicalLevel"] =
    isLecture || depthHits >= 4 ? "expert" : depthHits >= 2 || pedaHits >= 2 || howWorks ? "passionne" : "grand_public";

  const newsHits = titleCount(NEWS_MARKERS);
  const evergreenHits = count(EVERGREEN_MARKERS) + (howWorks ? 1 : 0);
  const temporality: AnalysisOutput["temporality"] =
    newsHits > 0 && evergreenHits === 0 ? "news" : evergreenHits > 0 ? "evergreen" : /\b20[12]\d\b/.test(input.title) ? "dated" : "evergreen";

  const sensational = SENSATIONAL.filter((p) => pad(titleN).includes(` ${p} `)).length;
  if (sensational) signals.add(`Titre sensationnaliste (${sensational} marqueur(s))`);

  const second = ranked[1]?.[1] ?? 0;
  const margin = topScore > 0 ? (topScore - second) / topScore : 0;

  return {
    inScope,
    relevance,
    universes: selectedUniverses.map(([slug, s], i) => ({ slug, confidence: i === 0 ? Math.min(1, toConf(s, 7) * (0.7 + 0.3 * margin)) : toConf(s, 7) * 0.8 })),
    subcategories,
    themes,
    formats,
    technologies,
    brands: [...brandHits.entries()].filter(() => inScope).map(([slug, w]) => ({ slug, confidence: w >= 2 ? 0.9 : 0.6 })),
    models: [...modelHits.entries()].filter(() => inScope).map(([key, m]) => ({ slug: key.split("/")[1], brand: m.brand, confidence: m.w >= 2 ? 0.85 : 0.55 })),
    tags: [...tagSet].slice(0, 10),
    technicalLevel,
    temporality,
    // Un classifieur à règles peut détecter la présence d'un signal, pas son absence :
    // sans signal, le critère est laissé « non mesurable » plutôt que noté bas.
    pedagogicalValue: pedaHits > 0 || howWorks || whyQ ? Math.round(pedagogicalValue * 100) / 100 : undefined,
    technicalDepth: depthHits > 0 || howWorks || longForm ? Math.round(technicalDepth * 100) / 100 : undefined,
    historicalInterest: historyTheme ? Math.round(historicalInterest * 100) / 100 : undefined,
    language: guessLanguage(`${input.title} ${(input.description ?? "").slice(0, 400)}`) ?? undefined,
    signals: [...signals].slice(0, 25),
    universeScores,
    sensationalism: sensational || undefined,
  };
}
