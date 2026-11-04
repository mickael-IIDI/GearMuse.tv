import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, rows } from "@/db/client";
import { listVideos, toCard, type VideoCard } from "@/server/queries/videos";

/**
 * Moteur « Pour vous ». Aucun compte : le navigateur envoie un profil compact
 * (identifiants de vidéos aimées / vues / masquées et préférences explicites).
 * Le profil n'est ni stocké ni journalisé côté serveur.
 */

const YT = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const ProfileSchema = z.object({
  favorites: z.array(YT).max(300).default([]),
  later: z.array(YT).max(300).default([]),
  history: z.array(YT).max(300).default([]),
  hidden: z.array(YT).max(300).default([]),
  prefs: z
    .object({
      universes: z.array(z.string().max(40)).max(10).default([]),
      formats: z.array(z.string().max(40)).max(12).default([]),
      duration: z.enum(["court", "moyen", "long", "tres-long"]).nullable().optional(),
    })
    .default({ universes: [], formats: [] }),
  seed: z.number().int().min(0).max(1e9).default(0),
  page: z.number().int().min(1).max(20).default(1),
  locale: z.enum(["fr", "en"]).default("fr"),
});
export type Profile = z.infer<typeof ProfileSchema>;

type Feature = { k: "sub" | "brand" | "model" | "tag" | "cat" | "creator"; id: number; w: number };

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const L = (labels: { fr: string; en?: string } | null | undefined, locale: string) => (labels ? (locale === "en" && labels.en) || labels.fr : "");

async function buildFeatures(p: Profile): Promise<{ features: Feature[]; seenIds: Set<string> }> {
  const db = await getDb();
  const weights = new Map<string, number>();
  const all = [...new Set([...p.favorites, ...p.later, ...p.history])];
  const seenIds = new Set([...p.history, ...p.favorites, ...p.hidden]);
  if (all.length) {
    const base = rows<{ id: number; ext: string }>(await db.execute(sql`select id, external_id as ext from videos where external_id in (${sql.join(all.map((x) => sql`${x}`), sql`, `)})`));
    const w = new Map<number, number>();
    for (const b of base) {
      let x = 0;
      if (p.favorites.includes(b.ext)) x += 3;
      if (p.later.includes(b.ext)) x += 1.5;
      const hi = p.history.indexOf(b.ext);
      if (hi >= 0) x += 1 * Math.exp(-hi / 40); // l'historique récent compte davantage
      w.set(Number(b.id), x);
    }
    const ids = [...w.keys()];
    if (ids.length) {
      const idList = sql.join(ids.map((i) => sql`${i}`), sql`, `);
      const feats = rows<{ vid: number; k: Feature["k"]; fid: number; f: number }>(
        await db.execute(sql`
          select video_id as vid, 'sub' as k, subcategory_id as fid, 1.0 as f from video_subcategories where video_id in (${idList})
          union all select video_id, 'brand', brand_id, 1.0 from video_brands where video_id in (${idList})
          union all select video_id, 'model', model_id, 1.2 from video_models where video_id in (${idList})
          union all select video_id, 'tag', tag_id, 0.5 from video_tags where video_id in (${idList})
          union all select vc.video_id, 'cat', vc.category_id, case when c.kind = 'universe' then 0.6 else 0.4 end from video_categories vc join categories c on c.id = vc.category_id where vc.video_id in (${idList})
          union all select id, 'creator', creator_id, 0.8 from videos where id in (${idList}) and creator_id is not null`),
      );
      for (const f of feats) {
        const key = `${f.k}:${f.fid}`;
        weights.set(key, (weights.get(key) ?? 0) + (w.get(Number(f.vid)) ?? 0) * Number(f.f));
      }
    }
  }
  if (p.prefs.universes.length || p.prefs.formats.length) {
    const slugs = [...p.prefs.universes, ...p.prefs.formats.map((f) => `format-${f}`)];
    const cats = rows<{ id: number; slug: string }>(await db.execute(sql`select id, slug from categories where slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)})`));
    for (const c of cats) weights.set(`cat:${c.id}`, (weights.get(`cat:${c.id}`) ?? 0) + (c.slug.startsWith("format-") ? 2 : 4));
  }
  const features = [...weights.entries()]
    .map(([key, w]) => ({ k: key.split(":")[0] as Feature["k"], id: Number(key.split(":")[1]), w }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 120);
  return { features, seenIds };
}

async function featureLabels(features: Feature[], locale: string): Promise<Map<string, string>> {
  const db = await getDb();
  const out = new Map<string, string>();
  const by = (k: Feature["k"]) => features.filter((f) => f.k === k).map((f) => f.id);
  const q = async (k: Feature["k"], query: (ids: ReturnType<typeof sql.join>) => ReturnType<typeof sql>) => {
    const ids = by(k);
    if (!ids.length) return;
    for (const r of rows<{ id: number; label: unknown }>(await db.execute(query(sql.join(ids.map((i) => sql`${i}`), sql`, `))))) {
      const lab = typeof r.label === "string" && r.label.startsWith("{") ? L(JSON.parse(r.label), locale) : typeof r.label === "object" ? L(r.label as { fr: string }, locale) : String(r.label);
      out.set(`${k}:${r.id}`, lab);
    }
  };
  await q("sub", (ids) => sql`select id, labels as label from subcategories where id in (${ids})`);
  await q("cat", (ids) => sql`select id, labels as label from categories where id in (${ids})`);
  await q("brand", (ids) => sql`select id, name as label from brands where id in (${ids})`);
  await q("model", (ids) => sql`select id, name as label from vehicle_models where id in (${ids})`);
  await q("tag", (ids) => sql`select id, labels as label from tags where id in (${ids})`);
  await q("creator", (ids) => sql`select id, name as label from creators where id in (${ids})`);
  return out;
}

function reasonFor(top: string | null, labels: Map<string, string>, locale: string): string {
  const en = locale === "en";
  if (!top) return en ? "Matches your tastes" : "Correspond à vos goûts";
  const [k] = top.split(":");
  const label = labels.get(top) ?? "";
  switch (k) {
    case "sub": return en ? `Recommended because you like ${label.toLowerCase()}` : `Recommandée car vous aimez : ${label.toLowerCase()}`;
    case "brand": return en ? `Because you follow ${label}` : `Parce que vous suivez ${label}`;
    case "model": return en ? `More about the ${label}` : `Autour de : ${label}`;
    case "creator": return en ? `From ${label}, a channel you watch` : `De ${label}, une chaîne que vous regardez`;
    case "tag": return en ? `Because you are interested in ${label}` : `Pour votre intérêt pour : ${label}`;
    default: return en ? `Because you like ${label.toLowerCase()}` : `Parce que vous aimez : ${label.toLowerCase()}`;
  }
}

const durationOk = (d: number | null, pref?: string | null) =>
  !pref || d == null ? true : pref === "court" ? d < 240 : pref === "moyen" ? d >= 240 && d < 1200 : pref === "long" ? d >= 1200 && d < 3600 : d >= 3600;

export async function recommend(p: Profile): Promise<{ items: VideoCard[]; personalized: boolean }> {
  const db = await getDb();
  const PAGE = 24;
  const rand = mulberry32(p.seed * 31 + p.page);
  const { features, seenIds } = await buildFeatures(p);
  const en = p.locale === "en";

  if (!features.length) return { items: await coldStart(p, seenIds), personalized: false };

  const prof = sql.join(features.map((f) => sql`(${f.k}, ${f.id}::int, ${f.w}::float8)`), sql`, `);
  const res = await db.execute(sql`
    with prof(k, id, w) as (values ${prof}),
    cand as (
      select vs.video_id as vid, p.w as s, p.k || ':' || p.id as f from prof p join video_subcategories vs on p.k = 'sub' and vs.subcategory_id = p.id
      union all select vb.video_id, p.w, p.k || ':' || p.id from prof p join video_brands vb on p.k = 'brand' and vb.brand_id = p.id
      union all select vm.video_id, p.w, p.k || ':' || p.id from prof p join video_models vm on p.k = 'model' and vm.model_id = p.id
      union all select vt.video_id, p.w * 0.6, p.k || ':' || p.id from prof p join video_tags vt on p.k = 'tag' and vt.tag_id = p.id
      union all select vc.video_id, p.w * 0.5, p.k || ':' || p.id from prof p join video_categories vc on p.k = 'cat' and vc.category_id = p.id
      union all select v2.id, p.w, p.k || ':' || p.id from prof p join videos v2 on p.k = 'creator' and v2.creator_id = p.id
    ),
    agg as (select vid, sum(s) as s, (array_agg(f order by s desc))[1] as top from cand group by vid)
    select v.id, v.external_id, v.slug, v.title, v.published_at, v.duration_seconds, v.thumbnail_url, v.quality_score, v.score_confidence,
      v.editorial_pick, v.recommender_count, v.discovery_score, v.view_count, v.language, v.selection_reason, v.editorial_summary, v.availability, v.embeddable, v.primary_format,
      cr.id as creator_id, cr.name as creator_name, cr.url as creator_url,
      (select json_build_object('slug', c.slug, 'labels', c.labels, 'color', c.color) from video_categories vc join categories c on c.id = vc.category_id where vc.video_id = v.id and c.kind = 'universe' order by vc.is_primary desc limit 1) as universe,
      (select coalesce(json_agg(x), '[]'::json) from (select s.slug, s.labels, pc.slug as universe from video_subcategories vs join subcategories s on s.id = vs.subcategory_id join categories pc on pc.id = s.category_id where vs.video_id = v.id order by vs.confidence desc limit 2) x) as subs,
      agg.s as sim, agg.top
    from agg join videos v on v.id = agg.vid left join creators cr on cr.id = v.creator_id
    where v.status = 'published'
    order by agg.s desc limit 400`);
  const cands = rows<Record<string, unknown>>(res).filter((r) => !seenIds.has(String(r.external_id)));
  const maxSim = Math.max(1, ...cands.map((r) => Number(r.sim)));
  const labels = await featureLabels(features.slice(0, 60), p.locale);

  const scored = cands
    .map((r) => {
      const card = toCard(r);
      const sim = Number(r.sim) / maxSim;
      const q = (card.qualityScore ?? 40) / 100;
      const disc = (card.discoveryScore ?? 0) / 100;
      const score = 0.58 * sim + 0.32 * q + 0.06 * disc + (durationOk(card.durationSeconds, p.prefs.duration) ? 0.04 : -0.1) + rand() * 0.06;
      return { card, score, top: (r.top as string) ?? null };
    })
    .sort((a, b) => b.score - a.score);

  // Diversité : plafonds par chaîne et par sous-catégorie principale, pages successives sans répétition.
  const picked: VideoCard[] = [];
  const perCreator = new Map<number, number>();
  const perSub = new Map<string, number>();
  const skip = (p.page - 1) * Math.round(PAGE * 0.75);
  let skipped = 0;
  for (const s of scored) {
    const c = s.card.creator?.id ?? -1;
    const sub = s.card.subcategories[0]?.slug ?? "-";
    if ((perCreator.get(c) ?? 0) >= 2 || (perSub.get(sub) ?? 0) >= 4) continue;
    perCreator.set(c, (perCreator.get(c) ?? 0) + 1);
    perSub.set(sub, (perSub.get(sub) ?? 0) + 1);
    if (skipped < skip) {
      skipped++;
      continue;
    }
    picked.push({ ...s.card, reason: reasonFor(s.top, labels, p.locale) });
    if (picked.length >= Math.round(PAGE * 0.75)) break;
  }

  // Exploration : univers peu présents dans le profil, vidéos parmi les mieux notées.
  const pickedIds = new Set([...picked.map((x) => x.id)]);
  const universeWeights = new Map<string, number>();
  for (const x of picked) if (x.universe) universeWeights.set(x.universe.slug, (universeWeights.get(x.universe.slug) ?? 0) + 1);
  const allUniverses = ["automobile", "moto", "aviation", "nautisme", "autres-vehicules"];
  const explore = allUniverses.filter((u) => !p.prefs.universes.includes(u)).sort((a, b) => (universeWeights.get(a) ?? 0) - (universeWeights.get(b) ?? 0));
  const exploreSlots = PAGE - picked.length;
  for (let i = 0; i < exploreSlots && explore.length; i++) {
    const u = explore[i % explore.length];
    const list = await listVideos({ filters: { univers: u }, sort: "qualite", pageSize: 12, seed: p.seed + p.page + i });
    const choice = list.items.find((x) => !pickedIds.has(x.id) && !seenIds.has(x.externalId));
    if (!choice) continue;
    pickedIds.add(choice.id);
    const uLabel = choice.universe ? (en ? choice.universe.labels.en ?? choice.universe.labels.fr : choice.universe.labels.fr) : u;
    picked.splice(Math.min(picked.length, 3 + i * 4), 0, { ...choice, reason: en ? `A discovery from the world of ${uLabel.toLowerCase()}` : `Une découverte dans l'univers : ${uLabel.toLowerCase()}` });
  }
  return { items: picked, personalized: true };
}

/** Démarrage à froid : incontournables, pépites, récentes de qualité et exploration de chaque univers. */
async function coldStart(p: Profile, seen: Set<string>): Promise<VideoCard[]> {
  const en = p.locale === "en";
  const seed = p.seed + p.page * 7;
  const take = async (label: string, opts: Parameters<typeof listVideos>[0], n: number) => {
    const r = await listVideos({ ...opts, pageSize: n * 3, seed });
    return r.items.filter((x) => !seen.has(x.externalId)).slice(0, n).map((x) => ({ ...x, reason: label }));
  };
  const parts = await Promise.all([
    take(en ? "An essential: recommended by many people over time" : "Un incontournable : recommandée par de nombreuses personnes, dans la durée", { filters: { qualite: "incontournables" }, sort: "qualite", page: p.page }, 7),
    take(en ? "Selected for its technical depth" : "Sélectionnée pour son intérêt technique", { filters: { qualite: "technique" }, sort: "qualite", page: p.page }, 5),
    take(en ? "Hidden gem: valued, but little watched" : "Pépite : appréciée, mais peu vue", { filters: { qualite: "pepites" }, sort: "decouverte", page: p.page }, 4),
    ...["automobile", "moto", "aviation", "nautisme", "autres-vehicules"].map((u) =>
      take(en ? "Explore a universe" : "Explorer un univers", { filters: { univers: u }, sort: "qualite", page: p.page }, 2),
    ),
  ]);
  const seenIds = new Set<number>();
  const out: VideoCard[] = [];
  // Entrelace les sources pour éviter des blocs homogènes.
  for (let i = 0; out.length < 24 && i < 10; i++) {
    for (const part of parts) {
      const x = part[i];
      if (x && !seenIds.has(x.id)) {
        seenIds.add(x.id);
        const uLabel = x.universe ? (en ? x.universe.labels.en ?? x.universe.labels.fr : x.universe.labels.fr) : "";
        out.push(x.reason?.startsWith("Explor") ? { ...x, reason: en ? `A discovery from the world of ${uLabel.toLowerCase()}` : `Une découverte dans l'univers : ${uLabel.toLowerCase()}` } : x);
      }
    }
  }
  return out.slice(0, 24);
}
