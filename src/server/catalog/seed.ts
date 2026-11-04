import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brands, categories, playlists, subcategories, vehicleModels, type PlaylistRules } from "@/db/schema";
import { BRANDS, MODELS } from "@/lib/taxonomy/brands";
import { FORMATS, TECHNOLOGIES, THEMES, UNIVERSES } from "@/lib/taxonomy/data";

/** Playlists thématiques initiales. Leur contenu est calculé à partir du catalogue réel. */
export const DEFAULT_PLAYLISTS: {
  slug: string;
  tier: "start" | "deep";
  fr: string;
  en: string;
  pitchFr: string;
  pitchEn: string;
  descFr: string;
  rules: PlaylistRules;
}[] = [
  { slug: "les-moteurs-les-plus-extraordinaires", tier: "start", fr: "Les moteurs les plus extraordinaires", en: "The most extraordinary engines", pitchFr: "V12, moteurs rotatifs, réacteurs, moteurs de fusée : des mécaniques hors normes.", pitchEn: "V12s, rotaries, jet and rocket engines: engineering at its wildest.", descFr: "Une sélection de vidéos consacrées aux moteurs qui ont repoussé les limites de la conception, de la puissance ou de l'ingéniosité.", rules: { themes: ["motorisation"], formats: ["demonstration", "documentaire", "conference"], minScore: 50, limit: 14, order: "score" } },
  { slug: "histoire-de-ferrari", tier: "deep", fr: "Histoire de Ferrari", en: "The history of Ferrari", pitchFr: "De Maranello aux circuits : les modèles, les hommes et les courses.", pitchEn: "From Maranello to the racetrack: the cars, the people, the races.", descFr: "Les vidéos du catalogue consacrées à Ferrari, de la plus ancienne à la plus récente.", rules: { brands: ["ferrari"], minScore: 40, limit: 14, order: "published_asc" } },
  { slug: "les-grandes-restaurations-automobiles", tier: "start", fr: "Les grandes restaurations automobiles", en: "Great car restorations", pitchFr: "Des épaves aux concours d'élégance : le travail patient de la restauration.", pitchEn: "From barn finds to concours: the patient craft of restoration.", descFr: "Restaurations complètes, remises en route et sauvetages de voitures anciennes.", rules: { subcategories: ["restauration-automobile"], minScore: 40, limit: 14, order: "score" } },
  { slug: "comprendre-les-moteurs-a-reaction", tier: "start", fr: "Comprendre les moteurs à réaction", en: "Understanding jet engines", pitchFr: "Turbofans, turboréacteurs, postcombustion : le principe, puis les détails.", pitchEn: "Turbofans, turbojets, afterburners: the principle, then the details.", descFr: "Un parcours pour comprendre le fonctionnement des moteurs aéronautiques, des explications de base aux analyses approfondies.", rules: { subcategories: ["moteurs-aeronautiques"], minScore: 40, limit: 12, order: "score" } },
  { slug: "les-bateaux-les-plus-impressionnants", tier: "start", fr: "Les bateaux les plus impressionnants", en: "The most impressive ships and boats", pitchFr: "Porte-conteneurs géants, sous-marins, superyachts et bateaux de course.", pitchEn: "Giant container ships, submarines, superyachts and race boats.", descFr: "Les vidéos nautiques et maritimes les mieux notées du catalogue.", rules: { universes: ["nautisme"], minScore: 50, limit: 14, order: "score" } },
  { slug: "les-plus-belles-mecaniques", tier: "deep", fr: "Les plus belles mécaniques", en: "Beautiful machinery", pitchFr: "Démontages, vues en coupe et mécaniques d'exception.", pitchEn: "Teardowns, cutaways and exceptional machinery.", descFr: "Des vidéos qui montrent la mécanique de près : démontages, animations et explications.", rules: { themes: ["mecanique"], formats: ["demonstration", "restauration", "visite-d-usine"], minScore: 50, limit: 14, order: "score" } },
  { slug: "les-innovations-automobiles", tier: "deep", fr: "Les innovations automobiles", en: "Automotive innovations", pitchFr: "Ce qui a changé la voiture : technologies, prototypes et ruptures.", pitchEn: "What changed the car: technologies, prototypes and breakthroughs.", descFr: "Technologies, inventions et prototypes qui ont fait évoluer l'automobile.", rules: { universes: ["automobile"], themes: ["innovation", "ingenierie"], minScore: 45, limit: 14, order: "score" } },
  { slug: "les-grandes-courses-historiques", tier: "deep", fr: "Les grandes courses historiques", en: "Historic races", pitchFr: "Le Mans, les Grands Prix, le Tourist Trophy : la compétition racontée.", pitchEn: "Le Mans, Grands Prix, the TT: racing history told.", descFr: "Compétitions automobiles, motocyclistes et nautiques, avec un regard historique.", rules: { subcategories: ["competition-automobile", "motogp-et-competition", "bateaux-de-course"], themes: ["histoire"], minScore: 40, limit: 14, order: "published_asc" } },
  { slug: "la-mecanique-expliquee", tier: "start", fr: "La mécanique expliquée", en: "Mechanics explained", pitchFr: "Boîtes de vitesses, différentiels, embrayages : comment ça marche, vraiment.", pitchEn: "Gearboxes, differentials, clutches: how they really work.", descFr: "Des explications claires et illustrées des grands principes mécaniques.", rules: { themes: ["mecanique"], formats: ["demonstration", "tutoriel", "conference"], minScore: 45, limit: 14, order: "score" } },
  { slug: "les-chefs-d-oeuvre-de-l-ingenierie", tier: "deep", fr: "Les chefs-d'œuvre de l'ingénierie", en: "Engineering masterpieces", pitchFr: "Les machines les plus abouties, expliquées par ceux qui les comprennent.", pitchEn: "The most accomplished machines, explained by people who understand them.", descFr: "Les vidéos les mieux notées pour leur profondeur technique, tous univers confondus.", rules: { themes: ["ingenierie"], minScore: 60, limit: 14, order: "score" } },
  { slug: "les-vehicules-qui-ont-change-l-histoire", tier: "start", fr: "Les véhicules qui ont changé l'histoire", en: "Vehicles that changed history", pitchFr: "Ford T, Concorde, Saturn V, porte-conteneurs : des machines qui ont tout changé.", pitchEn: "Model T, Concorde, Saturn V, the container ship: machines that changed everything.", descFr: "Documentaires et récits sur les véhicules qui ont transformé la société.", rules: { themes: ["histoire"], formats: ["documentaire", "conference"], minScore: 45, limit: 14, order: "score" } },
];

/** Amorce (ou met à jour) la taxonomie, les marques, les modèles et les playlists. Idempotent. */
export async function seedTaxonomy() {
  const db = await getDb();
  const stats = { categories: 0, subcategories: 0, brands: 0, models: 0, playlists: 0 };

  const upsertCat = async (slug: string, kind: "universe" | "theme" | "format" | "technology", fr: string, en: string, keywords: string[], sortOrder: number, extra: { descFr?: string; descEn?: string; icon?: string; color?: string } = {}) => {
    const [row] = await db
      .insert(categories)
      .values({ slug, kind, labels: { fr, en }, keywords, sortOrder, icon: extra.icon, color: extra.color, descriptions: extra.descFr ? { fr: extra.descFr, en: extra.descEn } : undefined })
      .onConflictDoUpdate({
        target: categories.slug,
        set: { labels: { fr, en }, keywords, kind, sortOrder, icon: extra.icon ?? null, color: extra.color ?? null, ...(extra.descFr ? { descriptions: { fr: extra.descFr, en: extra.descEn } } : {}), updatedAt: new Date() },
      })
      .returning({ id: categories.id });
    stats.categories++;
    return row.id;
  };

  for (const [i, u] of UNIVERSES.entries()) {
    const catId = await upsertCat(u.slug, "universe", u.fr, u.en, u.keywords, i, { descFr: u.descFr, descEn: u.descEn, icon: u.icon, color: u.color });
    for (const [j, [slug, fr, en, kws]] of u.subs.entries()) {
      await db
        .insert(subcategories)
        .values({ categoryId: catId, slug, labels: { fr, en }, keywords: kws, sortOrder: j })
        .onConflictDoUpdate({ target: [subcategories.categoryId, subcategories.slug], set: { labels: { fr, en }, keywords: kws, sortOrder: j, updatedAt: new Date() } });
      stats.subcategories++;
    }
  }
  for (const [i, [slug, fr, en, kws]] of THEMES.entries()) await upsertCat(slug, "theme", fr, en, kws, i);
  for (const [i, [slug, fr, en, kws]] of FORMATS.entries()) await upsertCat(`format-${slug}`, "format", fr, en, kws, i);
  for (const [i, [slug, fr, en, kws]] of TECHNOLOGIES.entries()) await upsertCat(`techno-${slug}`, "technology", fr, en, kws, i);

  for (const b of BRANDS) {
    await db
      .insert(brands)
      .values({ slug: b.slug, name: b.name, aliases: b.aliases ?? [], universes: b.universes, country: b.country })
      .onConflictDoUpdate({ target: brands.slug, set: { name: b.name, aliases: b.aliases ?? [], universes: b.universes, country: b.country ?? null, updatedAt: new Date() } });
    stats.brands++;
  }
  const brandRows = await db.select({ id: brands.id, slug: brands.slug }).from(brands);
  const brandId = new Map(brandRows.map((b) => [b.slug, b.id]));
  for (const m of MODELS) {
    const bid = brandId.get(m.brand);
    if (!bid) continue;
    await db
      .insert(vehicleModels)
      .values({ brandId: bid, slug: m.slug, name: m.name, aliases: m.aliases, universe: m.universe, yearsLabel: m.years })
      .onConflictDoUpdate({ target: [vehicleModels.brandId, vehicleModels.slug], set: { name: m.name, aliases: m.aliases, universe: m.universe, updatedAt: new Date() } });
    stats.models++;
  }

  for (const [i, p] of DEFAULT_PLAYLISTS.entries()) {
    const existing = await db.query.playlists.findFirst({ where: eq(playlists.slug, p.slug) });
    if (existing) continue; // ne jamais écraser une playlist modifiée par la rédaction
    await db.insert(playlists).values({
      slug: p.slug,
      kind: "smart",
      tier: p.tier,
      titles: { fr: p.fr, en: p.en },
      pitches: { fr: p.pitchFr, en: p.pitchEn },
      descriptions: { fr: p.descFr },
      rules: p.rules,
      status: "published",
      sortOrder: i,
      seoTitle: p.fr,
      seoDescription: p.descFr,
      curatedBy: "Règles éditoriales automatiques",
      publishedAt: new Date(),
    });
    stats.playlists++;
  }
  return stats;
}

/** Recalcule les compteurs de vidéos publiées par catégorie, sous-catégorie, marque, modèle et tag. */
export async function refreshCounts() {
  const db = await getDb();
  await db.execute(sql`update categories c set video_count = coalesce((select count(*) from video_categories vc join videos v on v.id = vc.video_id where vc.category_id = c.id and v.status = 'published'), 0)`);
  await db.execute(sql`update subcategories s set video_count = coalesce((select count(*) from video_subcategories vs join videos v on v.id = vs.video_id where vs.subcategory_id = s.id and v.status = 'published'), 0)`);
  await db.execute(sql`update brands b set video_count = coalesce((select count(*) from video_brands vb join videos v on v.id = vb.video_id where vb.brand_id = b.id and v.status = 'published'), 0)`);
  await db.execute(sql`update vehicle_models m set video_count = coalesce((select count(*) from video_models vm join videos v on v.id = vm.video_id where vm.model_id = m.id and v.status = 'published'), 0)`);
  await db.execute(sql`update tags t set usage_count = coalesce((select count(*) from video_tags vt join videos v on v.id = vt.video_id where vt.tag_id = t.id and v.status = 'published'), 0)`);
}

export async function categoryIdMaps() {
  const db = await getDb();
  const cats = await db.select({ id: categories.id, slug: categories.slug, kind: categories.kind }).from(categories);
  const subs = await db
    .select({ id: subcategories.id, slug: subcategories.slug, categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(and(eq(subcategories.isActive, true)));
  const brandRows = await db.select({ id: brands.id, slug: brands.slug, name: brands.name }).from(brands);
  const modelRows = await db.select({ id: vehicleModels.id, slug: vehicleModels.slug, brandId: vehicleModels.brandId, name: vehicleModels.name }).from(vehicleModels);
  return {
    category: new Map(cats.map((c) => [c.slug, c])),
    subcategory: new Map(subs.map((s) => [s.slug, s])),
    brand: new Map(brandRows.map((b) => [b.slug, b])),
    model: new Map(modelRows.map((m) => [`${brandRows.find((b) => b.id === m.brandId)?.slug}/${m.slug}`, m])),
  };
}
