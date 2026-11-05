import { sql, type SQL } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import type { Labels } from "@/db/schema";
import type { SortKey, VideoFilters } from "@/lib/filters";
import { analyzeQuery, DICTIONARY_WORDS, STOPWORDS, type QueryTerm } from "@/lib/search/synonyms";
import { editDistance, normalize } from "@/lib/text";

export type VideoCard = {
  id: number;
  externalId: string;
  slug: string;
  title: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  qualityScore: number | null;
  scoreConfidence: number | null;
  editorialPick: boolean;
  recommenderCount: number;
  discoveryScore: number | null;
  viewCount: number | null;
  language: string | null;
  selectionReason: string | null;
  editorialSummary: string | null;
  availability: string;
  embeddable: boolean | null;
  primaryFormat: string | null;
  creator: { id: number; name: string; url: string | null } | null;
  universe: { slug: string; labels: Labels; color: string | null } | null;
  subcategories: { slug: string; labels: Labels; universe: string }[];
  /** Champs contextuels (recommandations, playlists, recherche). */
  reason?: string;
  note?: string | null;
  position?: number;
};

const CARD_COLUMNS = sql`
  v.id, v.external_id, v.slug, v.title, v.published_at, v.duration_seconds, v.thumbnail_url, v.quality_score, v.score_confidence,
  v.editorial_pick, v.recommender_count, v.discovery_score, v.view_count, v.language, v.selection_reason, v.editorial_summary,
  v.availability, v.embeddable, v.primary_format,
  cr.id as creator_id, cr.name as creator_name, cr.url as creator_url,
  (select json_build_object('slug', c.slug, 'labels', c.labels, 'color', c.color) from video_categories vc join categories c on c.id = vc.category_id
     where vc.video_id = v.id and c.kind = 'universe' order by vc.is_primary desc, vc.confidence desc limit 1) as universe,
  (select coalesce(json_agg(x), '[]'::json) from (select s.slug, s.labels, pc.slug as universe from video_subcategories vs join subcategories s on s.id = vs.subcategory_id
     join categories pc on pc.id = s.category_id where vs.video_id = v.id order by vs.confidence desc limit 2) x) as subs`;

type Row = Record<string, unknown>;
const parseJson = <T>(v: unknown): T => (typeof v === "string" ? (JSON.parse(v) as T) : (v as T));

export function toCard(r: Row): VideoCard {
  const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);
  const num = (x: unknown) => (x == null ? null : Number(x));
  return {
    id: Number(r.id),
    externalId: String(r.external_id),
    slug: String(r.slug),
    title: String(r.title),
    publishedAt: iso(r.published_at),
    durationSeconds: num(r.duration_seconds),
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    qualityScore: num(r.quality_score),
    scoreConfidence: num(r.score_confidence),
    editorialPick: Boolean(r.editorial_pick),
    recommenderCount: Number(r.recommender_count ?? 0),
    discoveryScore: num(r.discovery_score),
    viewCount: num(r.view_count),
    language: (r.language as string) ?? null,
    selectionReason: (r.selection_reason as string) ?? null,
    editorialSummary: (r.editorial_summary as string) ?? null,
    availability: String(r.availability ?? "unknown"),
    embeddable: r.embeddable == null ? null : Boolean(r.embeddable),
    primaryFormat: (r.primary_format as string) ?? null,
    creator: r.creator_id ? { id: Number(r.creator_id), name: String(r.creator_name), url: (r.creator_url as string) ?? null } : null,
    universe: r.universe ? parseJson(r.universe) : null,
    subcategories: parseJson(r.subs ?? []) ?? [],
    ...(r.reason ? { reason: String(r.reason) } : {}),
    ...(r.note !== undefined ? { note: (r.note as string) ?? null } : {}),
    ...(r.position !== undefined ? { position: Number(r.position) } : {}),
  };
}

const catExists = (slug: string, kind?: string) =>
  sql`exists (select 1 from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.slug = ${slug}${kind ? sql` and c.kind = ${kind}` : sql``})`;

export function filterConditions(f: VideoFilters): SQL[] {
  const c: SQL[] = [sql`v.status = 'published'`];
  if (f.univers) c.push(catExists(f.univers, "universe"));
  if (f.theme) c.push(catExists(f.theme, "theme"));
  if (f.format) c.push(catExists(`format-${f.format}`));
  if (f.techno) c.push(catExists(`techno-${f.techno}`));
  if (f.sous) c.push(sql`exists (select 1 from video_subcategories vs join subcategories s on s.id = vs.subcategory_id where vs.video_id = v.id and s.slug = ${f.sous})`);
  if (f.marque) c.push(sql`exists (select 1 from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = v.id and b.slug = ${f.marque})`);
  if (f.modele)
    c.push(sql`exists (select 1 from video_models vm join vehicle_models m on m.id = vm.model_id join brands b on b.id = m.brand_id where vm.video_id = v.id and m.slug = ${f.modele}${f.marque ? sql` and b.slug = ${f.marque}` : sql``})`);
  if (f.chaine) c.push(sql`v.creator_id = ${f.chaine}`);
  switch (f.date) {
    case "semaine": c.push(sql`v.published_at >= now() - interval '7 days'`); break;
    case "mois": c.push(sql`v.published_at >= now() - interval '30 days'`); break;
    case "annee": c.push(sql`v.published_at >= now() - interval '365 days'`); break;
    case "2020s": c.push(sql`v.published_at >= '2020-01-01' and v.published_at < '2030-01-01'`); break;
    case "2010s": c.push(sql`v.published_at >= '2010-01-01' and v.published_at < '2020-01-01'`); break;
    case "2000s": c.push(sql`v.published_at >= '2000-01-01' and v.published_at < '2010-01-01'`); break;
    case "historique": c.push(catExists("histoire", "theme")); break;
  }
  switch (f.duree) {
    case "court": c.push(sql`v.duration_seconds < 240`); break;
    case "moyen": c.push(sql`v.duration_seconds >= 240 and v.duration_seconds < 1200`); break;
    case "long": c.push(sql`v.duration_seconds >= 1200 and v.duration_seconds < 3600`); break;
    case "tres-long": c.push(sql`v.duration_seconds >= 3600`); break;
  }
  if (f.langue === "fr" || f.langue === "en") c.push(sql`v.language = ${f.langue}`);
  if (f.langue === "autre") c.push(sql`v.language is not null and v.language not in ('fr', 'en')`);
  switch (f.qualite) {
    case "pepites": c.push(sql`(v.discovery_score >= 30 or (v.recommender_count >= 2 and v.view_count < 100000))`); break;
    case "incontournables": c.push(sql`v.recommender_count >= 3 and v.quality_score >= 60`); break;
    case "durables": c.push(sql`v.temporality = 'evergreen' and v.quality_score >= 50`); break;
    case "technique": c.push(sql`v.technical_level in ('expert', 'passionne') and v.quality_score >= 50`); break;
  }
  return c;
}

function orderBy(sort: SortKey | undefined, seed?: number): SQL {
  switch (sort) {
    case "recommandation": return sql`v.recommender_count desc, v.community_points desc, v.quality_score desc nulls last`;
    case "date": return sql`v.published_at desc nulls last, v.id desc`;
    case "recent": return sql`v.published_on_site_at desc nulls last, v.id desc`;
    case "ancien": return sql`v.published_at asc nulls last, v.id`;
    case "popularite": return sql`v.view_count desc nulls last, v.recommender_count desc`;
    case "decouverte": return sql`v.discovery_score desc nulls last, v.quality_score desc nulls last`;
    case "duree": return sql`v.duration_seconds desc nulls last`;
    case "qualite":
    case "pertinence":
    default:
      // « Meilleures d'abord », avec un léger brassage quotidien optionnel parmi les scores proches.
      return seed != null
        ? sql`(coalesce(v.quality_score, 0) + ((('x' || substr(md5(v.external_id || ${String(seed)}), 1, 4))::bit(16)::int) % 9)) desc, v.id`
        : sql`v.quality_score desc nulls last, v.recommender_count desc, v.id`;
  }
}

export const PAGE_SIZE = 36;

export async function listVideos(opts: { filters?: VideoFilters; sort?: SortKey; page?: number; pageSize?: number; seed?: number; excludeIds?: number[]; withTotal?: boolean }) {
  const db = await getDb();
  const size = opts.pageSize ?? PAGE_SIZE;
  const page = opts.page ?? 1;
  const conds = filterConditions(opts.filters ?? {});
  if (opts.excludeIds?.length) conds.push(sql`v.id not in (${sql.join(opts.excludeIds.map((i) => sql`${i}`), sql`, `)})`);
  const where = sql.join(conds, sql` and `);
  const res = await db.execute(sql`select ${CARD_COLUMNS} from videos v left join creators cr on cr.id = v.creator_id where ${where} order by ${orderBy(opts.sort, opts.seed)} limit ${size + 1} offset ${(page - 1) * size}`);
  const list = rows<Row>(res);
  let total: number | null = null;
  if (opts.withTotal) total = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from videos v where ${where}`))[0]?.n ?? 0);
  return { items: list.slice(0, size).map(toCard), hasMore: list.length > size, total };
}

/* ------------------------------------------------------------------ */
/* Recherche                                                           */
/* ------------------------------------------------------------------ */

const lexeme = (w: string) => w.replace(/[^a-z0-9]/g, "");
function altToTsquery(alt: string): string | null {
  const words = alt.split(" ").map(lexeme).filter(Boolean);
  if (!words.length) return null;
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(" <-> ");
}
function termToTsquery(t: QueryTerm): string | null {
  const parts = t.alternatives.map(altToTsquery).filter((x): x is string => Boolean(x));
  return parts.length ? `(${parts.join(" | ")})` : null;
}

/** Vocabulaire du catalogue publié (lexèmes et fréquences), mis en cache 10 minutes. */
let vocab: { words: Map<string, number>; at: number } | null = null;
async function vocabulary(): Promise<Map<string, number>> {
  if (vocab && Date.now() - vocab.at < 600_000) return vocab.words;
  const db = await getDb();
  const res = await db.execute(sql`select word, ndoc from ts_stat('select to_tsvector(''simple'', search_title || '' '' || search_entities) from videos where status = ''published''') where length(word) >= 3`);
  const words = new Map(rows<{ word: string; ndoc: number }>(res).map((r) => [r.word, Number(r.ndoc)]));
  vocab = { words, at: Date.now() };
  return words;
}

/** Corrige les mots inconnus (catalogue + dictionnaire FR/EN), puis ré-analyse la requête corrigée. */
export async function spellCorrect(q: string): Promise<{ terms: QueryTerm[]; suggestion: string | null }> {
  const words = await vocabulary();
  const dict = new Map<string, number>(words);
  for (const w of DICTIONARY_WORDS) if (!dict.has(w)) dict.set(w, 50);
  const tokens = normalize(q).split(" ").filter(Boolean);
  let changed = false;
  const fixed = tokens.map((tok) => {
    if (tok.length < 4 || /\d/.test(tok) || STOPWORDS.has(tok) || dict.has(tok)) return tok;
    for (const w of dict.keys()) if (w.startsWith(tok)) return tok; // préfixe connu : pas de correction
    // Tolérance proportionnelle à la longueur : 1 faute jusqu'à 6 lettres, 2 au-delà.
    const maxDist = tok.length <= 6 ? 1 : 2;
    let best: { w: string; d: number; n: number } | null = null;
    for (const [w, n] of dict) {
      if (Math.abs(w.length - tok.length) > maxDist) continue;
      const d = editDistance(tok, w, maxDist);
      if (d <= maxDist && (!best || d < best.d || (d === best.d && n > best.n))) best = { w, d, n };
    }
    if (!best) return tok;
    changed = true;
    return best.w;
  });
  const corrected = fixed.join(" ");
  return { terms: analyzeQuery(changed ? corrected : q), suggestion: changed ? corrected : null };
}

export type SearchResult = {
  items: VideoCard[];
  hasMore: boolean;
  total: number;
  suggestion: string | null;
  relaxed: boolean;
  terms: string[];
};

export async function searchVideos(q: string, opts: { filters?: VideoFilters; sort?: SortKey; page?: number; pageSize?: number } = {}): Promise<SearchResult> {
  const db = await getDb();
  const size = opts.pageSize ?? 24;
  const page = opts.page ?? 1;
  const qn = normalize(q);
  const { terms, suggestion } = await spellCorrect(q);
  const termQueries = terms.map(termToTsquery).filter((x): x is string => Boolean(x));
  const content = terms.map((t, i) => ({ t, q: termToTsquery(t), i })).filter((x) => x.q && !x.t.modifier);
  const modifiers = terms.map((t) => ({ t, q: termToTsquery(t) })).filter((x) => x.q && x.t.modifier);
  const filters = filterConditions(opts.filters ?? {});
  if (!termQueries.length) return { items: [], hasMore: false, total: 0, suggestion: null, relaxed: false, terms: [] };

  const full = termQueries.join(" | ");
  const countOf = (list: { q: string | null }[]) => (list.length ? sql.join(list.map((x) => sql`(v.search_vector @@ to_tsquery('simple', ${x.q!}))::int`), sql` + `) : sql`0`);
  // Les termes d'intention (« comment fonctionne », « essai »…) renforcent le classement sans suffire à eux seuls.
  const matchedExpr = content.length ? countOf(content) : countOf(modifiers);
  const boostExpr = content.length ? countOf(modifiers) : sql`0`;
  const run = async (minMatch: number) => {
    const where = sql.join([...filters, sql`(v.search_vector @@ to_tsquery('simple', ${full}) or similarity(v.search_title, ${qn}) > 0.35)`, sql`(${matchedExpr}) >= ${minMatch}`], sql` and `);
    const score = sql`((${matchedExpr}) * 1.0 + (${boostExpr}) * 0.4 + ts_rank_cd(v.search_vector, to_tsquery('simple', ${full}), 32) * 4 + similarity(v.search_title, ${qn}) * 1.5 + coalesce(v.quality_score, 0) / 250.0)`;
    const order = !opts.sort || opts.sort === "pertinence" ? sql`${score} desc, v.id` : orderBy(opts.sort);
    const res = await db.execute(sql`select ${CARD_COLUMNS} from videos v left join creators cr on cr.id = v.creator_id where ${where} order by ${order} limit ${size + 1} offset ${(page - 1) * size}`);
    const total = Number(rows<{ n: number }>(await db.execute(sql`select count(*)::int as n from videos v where ${where}`))[0]?.n ?? 0);
    return { list: rows<Row>(res), total };
  };
  // Exige la majorité des termes ; à défaut, on élargit à au moins un terme (« résultats proches »).
  const nContent = content.length || modifiers.length;
  const strict = Math.max(1, Math.min(nContent, Math.ceil(nContent * 0.6)));
  let r = await run(strict);
  let relaxed = false;
  if (!r.total && strict > 1) {
    r = await run(1);
    relaxed = r.total > 0;
  }
  return {
    items: r.list.slice(0, size).map(toCard),
    hasMore: r.list.length > size,
    total: r.total,
    suggestion,
    relaxed,
    terms: terms.map((t) => t.term),
  };
}

/* ------------------------------------------------------------------ */
/* Lecture unitaire, similaires, sélections                            */
/* ------------------------------------------------------------------ */

export async function videosByIds(ids: number[]): Promise<VideoCard[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const res = await db.execute(sql`select ${CARD_COLUMNS} from videos v left join creators cr on cr.id = v.creator_id where v.id in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
  const map = new Map(rows<Row>(res).map((r) => [Number(r.id), toCard(r)]));
  return ids.map((i) => map.get(i)).filter((x): x is VideoCard => Boolean(x));
}

/** Cartes par identifiant fournisseur (bibliothèque locale du visiteur). Inclut les vidéos dépubliées pour l'afficher clairement. */
export async function videosByExternalIds(ids: string[]): Promise<VideoCard[]> {
  const clean = ids.filter((i) => /^[A-Za-z0-9_-]{11}$/.test(i)).slice(0, 500);
  if (!clean.length) return [];
  const db = await getDb();
  const res = await db.execute(sql`select ${CARD_COLUMNS}, v.status from videos v left join creators cr on cr.id = v.creator_id where v.external_id in (${sql.join(clean.map((i) => sql`${i}`), sql`, `)})`);
  const map = new Map(rows<Row>(res).map((r) => [String(r.external_id), { ...toCard(r), availability: r.status === "published" ? String(r.availability) : "unavailable" }]));
  return clean.map((i) => map.get(i)).filter((x): x is VideoCard => Boolean(x));
}

/** Vidéos similaires : recouvrement pondéré de sous-catégories, marques, modèles, tags, thèmes et chaîne. */
export async function relatedVideos(videoId: number, limit = 16): Promise<VideoCard[]> {
  const db = await getDb();
  const res = await db.execute(sql`
    with feats as (
      select 'sub' as k, subcategory_id as id, 3.0 as w from video_subcategories where video_id = ${videoId}
      union all select 'brand', brand_id, 3.0 from video_brands where video_id = ${videoId}
      union all select 'model', model_id, 5.0 from video_models where video_id = ${videoId}
      union all select 'tag', tag_id, 1.5 from video_tags where video_id = ${videoId}
      union all select 'cat', vc.category_id, case when c.kind = 'universe' then 1.0 else 1.5 end from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = ${videoId}
    ),
    cand as (
      select vs.video_id as vid, sum(f.w) as s from feats f join video_subcategories vs on f.k = 'sub' and vs.subcategory_id = f.id group by vs.video_id
      union all select vb.video_id, sum(f.w) from feats f join video_brands vb on f.k = 'brand' and vb.brand_id = f.id group by vb.video_id
      union all select vm.video_id, sum(f.w) from feats f join video_models vm on f.k = 'model' and vm.model_id = f.id group by vm.video_id
      union all select vt.video_id, sum(f.w) from feats f join video_tags vt on f.k = 'tag' and vt.tag_id = f.id group by vt.video_id
      union all select vc.video_id, sum(f.w) from feats f join video_categories vc on f.k = 'cat' and vc.category_id = f.id group by vc.video_id
      union all select v2.id, 2.0 from videos v2 where v2.creator_id = (select creator_id from videos where id = ${videoId}) and v2.creator_id is not null
    ),
    agg as (select vid, sum(s) as s from cand where vid <> ${videoId} group by vid)
    select ${CARD_COLUMNS} from agg join videos v on v.id = agg.vid left join creators cr on cr.id = v.creator_id
    where v.status = 'published'
    order by agg.s + coalesce(v.quality_score, 0) / 25.0 desc limit ${limit}`);
  return rows<Row>(res).map(toCard);
}

export async function sameBrandOrModel(videoId: number, limit = 8): Promise<{ label: string; href: string; items: VideoCard[] } | null> {
  const db = await getDb();
  const model = rows<{ id: number; name: string; slug: string; bslug: string }>(
    await db.execute(sql`select m.id, m.name, m.slug, b.slug as bslug from video_models vm join vehicle_models m on m.id = vm.model_id join brands b on b.id = m.brand_id where vm.video_id = ${videoId} order by vm.confidence desc limit 1`),
  )[0];
  if (model) {
    const items = await listVideos({ filters: { marque: model.bslug, modele: model.slug }, pageSize: limit + 1 });
    const list = items.items.filter((v) => v.id !== videoId).slice(0, limit);
    if (list.length) return { label: model.name, href: `/marques/${model.bslug}/${model.slug}`, items: list };
  }
  const brand = rows<{ name: string; slug: string }>(await db.execute(sql`select b.name, b.slug from video_brands vb join brands b on b.id = vb.brand_id where vb.video_id = ${videoId} order by vb.confidence desc limit 1`))[0];
  if (brand) {
    const items = await listVideos({ filters: { marque: brand.slug }, pageSize: limit + 1 });
    const list = items.items.filter((v) => v.id !== videoId).slice(0, limit);
    if (list.length) return { label: brand.name, href: `/marques/${brand.slug}`, items: list };
  }
  return null;
}

export async function catalogCounts() {
  const db = await getDb();
  const r = rows<{ status: string; n: number }>(await db.execute(sql`select status, count(*)::int as n from videos group by status`));
  const by = Object.fromEntries(r.map((x) => [x.status, Number(x.n)]));
  const meta = rows<{ with_duration: number; published: number }>(
    await db.execute(sql`select count(*) filter (where duration_seconds is not null)::int as with_duration, count(*)::int as published from videos where status = 'published'`),
  )[0];
  return {
    published: by.published ?? 0,
    pending: by.pending_review ?? 0,
    rejected: by.rejected ?? 0,
    unavailable: by.unavailable ?? 0,
    discovered: by.discovered ?? 0,
    excluded: by.excluded ?? 0,
    withDuration: Number(meta?.with_duration ?? 0),
  };
}
