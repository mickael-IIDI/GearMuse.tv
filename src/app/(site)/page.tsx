import Link from "next/link";
import { sql } from "drizzle-orm";
import { getDb, rows } from "@/db/client";
import { siteConfig } from "@/config/site";
import { UNIVERSE_ICONS } from "@/components/icons";
import { VideoCard } from "@/components/video/video-card";
import { ForYouSection } from "@/components/video/for-you-section";
import { EmptyState } from "@/components/ui/page-header";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { universes } from "@/server/queries/catalog";
import { catalogCounts, listVideos, type VideoCard as Card } from "@/server/queries/videos";
import type { VideoFilters, SortKey } from "@/lib/filters";

const daySeed = () => Math.floor(Date.now() / 86400000);

function Section({ title, href, items, locale, seeAll, reason }: { title: string; href?: string; items: Card[]; locale: string; seeAll: string; reason?: string }) {
  if (!items.length) return null;
  return (
    <section className="mb-12" aria-label={title}>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-[21px] font-bold tracking-tight">{title}</h2>
        {href && (
          <Link href={href} className="shrink-0 text-sm font-medium text-muted hover:text-fg">
            {seeAll} →
          </Link>
        )}
      </div>
      {reason && <p className="-mt-3 mb-4 text-sm text-muted">{reason}</p>}
      <div className="video-grid">
        {items.map((v, i) => (
          <VideoCard key={v.id} v={v} locale={locale} priority={i < 4} />
        ))}
      </div>
    </section>
  );
}

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const seed = daySeed();
  const [counts, unis] = await Promise.all([catalogCounts(), universes()]);
  const shown = new Set<number>();
  const pick = async (filters: VideoFilters, sort: SortKey | undefined, n = 8, useSeed = false) => {
    const r = await listVideos({ filters, sort, pageSize: n + 12, seed: useSeed ? seed : undefined });
    const out = r.items.filter((v) => !shown.has(v.id)).slice(0, n);
    out.forEach((v) => shown.add(v.id));
    return out;
  };

  const moment = await pick({}, "qualite", 8, true);
  const essentials = await pick({ qualite: "incontournables" }, "qualite");
  const gems = await pick({ qualite: "pepites" }, "decouverte", 4);
  const docs = await pick({ format: "documentaire" }, "qualite", 4);
  const restorations = await pick({ format: "restauration" }, "qualite", 4);
  const innovations = await pick({ theme: "innovation" }, "qualite", 4);
  let recent = await pick({ date: "annee" }, "qualite", 4);
  if (recent.length < 4) recent = [...recent, ...(await pick({}, "date", 4 - recent.length))];
  const mostRecommended = await pick({}, "recommandation", 4);

  // « Explorer une nouvelle catégorie » : une sous-catégorie fournie, tirée au sort chaque jour.
  const db = await getDb();
  const subs = rows<{ slug: string; labels: { fr: string; en?: string }; u: string }>(
    await db.execute(sql`select s.slug, s.labels, c.slug as u from subcategories s join categories c on c.id = s.category_id where s.video_count >= 4 order by s.id`),
  );
  const exploreSub = subs.length ? subs[seed % subs.length] : null;
  const explore = exploreSub ? await pick({ sous: exploreSub.slug }, "qualite", 4) : [];

  return (
    <>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-line bg-elev px-6 py-8 sm:px-10 sm:py-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-accent/15 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{siteConfig.name}</p>
        <h1 className="mt-2 max-w-3xl font-display text-[28px] font-bold leading-[1.15] tracking-tight sm:text-[38px]">{t.home.hero}</h1>
        <p className="mt-3 max-w-2xl text-[15.5px] text-muted">{t.home.heroSub}</p>
        <p className="mt-4 text-sm text-faint">
          {t.home.stats(counts.published)}
          {counts.pending > 0 && <> · {en ? `${counts.pending.toLocaleString("en")} awaiting editorial review` : `${counts.pending.toLocaleString("fr-FR")} en attente de validation éditoriale`}</>}
        </p>
        <nav aria-label={t.nav.universes} className="mt-6 flex flex-wrap gap-2">
          {unis.map((u) => {
            const Icon = UNIVERSE_ICONS[u.slug];
            return (
              <Link key={u.slug} href={`/univers/${u.slug}`} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg/60 px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent">
                {Icon && <Icon size={18} />}
                {label(u.labels, locale)}
                <span className="text-xs text-faint">{u.videoCount}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      {!counts.published && <EmptyState title={t.home.empty} />}

      <Section title={t.home.moment} href="/videos" items={moment} locale={locale} seeAll={t.home.seeAll} />
      <ForYouSection />
      <Section title={t.home.essentials} href="/videos?qualite=incontournables" items={essentials} locale={locale} seeAll={t.home.seeAll} reason={en ? "Recommended by at least three different people, over time." : "Recommandées par au moins trois personnes différentes, dans la durée."} />
      <Section title={t.home.gems} href="/decouvertes" items={gems} locale={locale} seeAll={t.home.seeAll} reason={en ? "Valued by the community, but little watched on YouTube." : "Appréciées par la communauté, mais peu vues sur YouTube."} />
      <Section title={t.home.documentaries} href="/videos?format=documentaire" items={docs} locale={locale} seeAll={t.home.seeAll} />
      <Section title={t.home.restorations} href="/videos?format=restauration" items={restorations} locale={locale} seeAll={t.home.seeAll} />
      <Section title={t.home.innovations} href="/themes/innovation" items={innovations} locale={locale} seeAll={t.home.seeAll} />
      <Section title={t.home.recent} href="/videos?tri=date" items={recent} locale={locale} seeAll={t.home.seeAll} />
      <Section title={t.home.mostRecommended} href="/videos?tri=recommandation" items={mostRecommended} locale={locale} seeAll={t.home.seeAll} />
      {exploreSub && <Section title={t.home.explore(label(exploreSub.labels, locale))} href={`/univers/${exploreSub.u}/${exploreSub.slug}`} items={explore} locale={locale} seeAll={t.home.seeAll} />}

      <div className="mt-4 flex justify-center">
        <Link href="/videos" className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-ink hover:opacity-90">
          {en ? "Browse the whole catalog" : "Parcourir tout le catalogue"}
        </Link>
      </div>
    </>
  );
}
