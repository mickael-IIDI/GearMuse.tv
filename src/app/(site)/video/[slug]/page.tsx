import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { IconExternal, IconFlag } from "@/components/icons";
import { Player } from "@/components/video/player";
import { Expandable, VideoActions } from "@/components/video/video-actions";
import { VideoCard } from "@/components/video/video-card";
import { RelativeDate } from "@/components/ui/relative-date";
import { label } from "@/lib/i18n";
import { formatDuration, truncate } from "@/lib/text";
import { LanguagePicker } from "@/components/video-language/picker";
import { getI18n, getVideoLanguage } from "@/server/locale";
import { getVideoPage } from "@/server/queries/catalog";
import { relatedVideos, sameBrandOrModel } from "@/server/queries/videos";

type Props = { params: Promise<{ slug: string }> };

const CRITERIA_LABELS: Record<string, [string, string]> = {
  relevance: ["Pertinence thématique", "Topical relevance"],
  technicalDepth: ["Profondeur technique", "Technical depth"],
  pedagogy: ["Qualité pédagogique", "Educational value"],
  historicalInterest: ["Intérêt historique", "Historical interest"],
  originality: ["Originalité", "Originality"],
  creatorCredibility: ["Crédibilité de l'auteur", "Creator credibility"],
  independentRecommendations: ["Recommandations indépendantes", "Independent recommendations"],
  recurrence: ["Recommandations dans la durée", "Recommendations over time"],
  durableValue: ["Valeur durable", "Lasting value"],
  rarity: ["Rareté", "Rarity"],
  freshness: ["Fraîcheur", "Freshness"],
};

function poster(v: { externalId: string; thumbnails: Record<string, { url: string }> | null; thumbnailUrl: string | null }) {
  return v.thumbnails?.maxres?.url ?? v.thumbnails?.standard?.url ?? v.thumbnails?.high?.url ?? v.thumbnailUrl ?? `https://i.ytimg.com/vi/${v.externalId}/hqdefault.jpg`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getVideoPage((await params).slug);
  if (!data) return { title: "Vidéo introuvable", robots: { index: false } };
  const v = data.video;
  const desc = truncate(v.editorialSummary || v.selectionReason || v.description || v.title, 160);
  return {
    title: v.title,
    description: desc,
    alternates: { canonical: `/video/${v.slug}` },
    openGraph: { type: "video.other", title: v.title, description: desc, images: [{ url: poster(v) }], videos: [{ url: `https://www.youtube.com/embed/${v.externalId}` }] },
    robots: v.status !== "published" ? { index: false, follow: true } : undefined,
  };
}

export default async function VideoPage({ params }: Props) {
  const { slug } = await params;
  const data = await getVideoPage(slug);
  if (!data) notFound();
  const { video: v, card, categories, tags, brands, models, evidence, creator } = data;
  if (v.slug !== slug) permanentRedirect(`/video/${v.slug}`);
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const language = await getVideoLanguage();
  const [related, sameModel] = await Promise.all([relatedVideos(v.id, 16, language), sameBrandOrModel(v.id, 8, language)]);
  const url = `${siteConfig.url}/video/${v.slug}`;
  const universe = card.universe;
  const hnStories = evidence.filter((e) => e.kind === "community_upvote");
  const comments = evidence.filter((e) => e.kind === "community_comment");
  const themes = categories.filter((c) => c.kind === "theme");
  const formats = categories.filter((c) => c.kind === "format");
  const techs = categories.filter((c) => c.kind === "technology");
  const breakdown = v.scoreBreakdown;

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: t.nav.home, item: siteConfig.url },
        ...(universe ? [{ "@type": "ListItem", position: 2, name: label(universe.labels, locale), item: `${siteConfig.url}/univers/${universe.slug}` }] : []),
        { "@type": "ListItem", position: universe ? 3 : 2, name: v.title, item: url },
      ],
    },
  ];
  // VideoObject uniquement si les champs requis sont réellement connus (pas de date inventée).
  if (v.publishedAt && v.status === "published") {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: v.title,
      description: truncate(v.editorialSummary || v.description || v.selectionReason || v.title, 500),
      thumbnailUrl: [poster(v)],
      uploadDate: v.publishedAt.toISOString(),
      ...(v.durationSeconds ? { duration: `PT${Math.floor(v.durationSeconds / 60)}M${v.durationSeconds % 60}S` } : {}),
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.externalId}`,
      url,
      ...(creator ? { author: { "@type": "Person", name: creator.name, ...(creator.url ? { url: creator.url } : {}) } } : {}),
    });
  }

  return (
    <div className="mx-auto flex max-w-[1760px] flex-col gap-8 xl:flex-row">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="min-w-0 flex-1">
        <div className="-mx-4 sm:mx-0">
          <Player externalId={v.externalId} title={v.title} poster={poster(v)} embeddable={v.embeddable} availability={v.status === "unavailable" ? "unavailable" : v.availability} />
        </div>
        <h1 className="mt-4 font-display text-[21px] font-bold leading-snug sm:text-[23px]">{v.title}</h1>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 text-sm">
            {creator && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/chaine/${creator.id}`} className="font-semibold hover:text-accent">{creator.name}</Link>
                {creator.isOfficial && <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">{en ? "Official" : "Officielle"}</span>}
                {creator.isCuratedSource && !creator.isOfficial && <span className="rounded bg-soft px-1.5 py-0.5 text-xs text-muted">{en ? "Followed channel" : "Chaîne suivie"}</span>}
                {creator.url && (
                  <a href={creator.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                    {t.video.channel} <IconExternal size={12} />
                  </a>
                )}
              </div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              {v.publishedAt ? <span>{t.video.published} <RelativeDate iso={v.publishedAt.toISOString()} /></span> : <span>{t.video.unknownDate}</span>}
              {v.durationSeconds != null && <><span aria-hidden>·</span><span>{formatDuration(v.durationSeconds)}</span></>}
              {v.viewCount != null && <><span aria-hidden>·</span><span>{t.card.views(v.viewCount)}</span></>}
              {v.language && <><span aria-hidden>·</span><span className="uppercase">{v.language}</span></>}
            </div>
          </div>
          <VideoActions externalId={v.externalId} title={v.title} url={url} />
        </div>

        <div className="mt-5 rounded-2xl bg-soft p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            {v.editorialPick && <span className="rounded-md bg-accent px-2 py-0.5 font-semibold text-accent-ink">★ {en ? "Editor's pick" : "Sélection de la rédaction"}</span>}
            {v.qualityScore != null && (
              <span className="rounded-md border border-line bg-elev px-2 py-0.5 tabular-nums" title={t.card.scoreHelp}>
                {en ? "Internal score" : "Note interne"} <strong>{v.qualityScore}</strong>/100
              </span>
            )}
            {v.technicalLevel && <span className="rounded-md bg-elev px-2 py-0.5 text-muted">{t.video.level[v.technicalLevel]}</span>}
            {v.temporality && <span className="rounded-md bg-elev px-2 py-0.5 text-muted">{t.video.temporality[v.temporality]}</span>}
            {formats.map((f) => <Link key={f.slug} href={`/videos?format=${f.slug.replace("format-", "")}`} className="rounded-md bg-elev px-2 py-0.5 text-muted hover:text-fg">{label(f.labels, locale)}</Link>)}
          </div>

          {v.editorialSummary && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">{t.video.summary}</h2>
              <p className="mt-1 text-[14.5px]">{v.editorialSummary}</p>
              {v.editorialSummarySource === "ai" && <p className="mt-1 text-xs text-faint">{t.video.summaryAi}</p>}
            </section>
          )}

          {v.selectionReason && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">{t.video.whySelected}</h2>
              <p className="mt-1 text-[14.5px] text-fg/90">{v.selectionReason}</p>
            </section>
          )}

          {(hnStories.length > 0 || comments.length > 0) && (
            <section className="mt-4">
              <h2 className="text-sm font-semibold">{t.video.evidence}</h2>
              <ul className="mt-2 space-y-2">
                {hnStories.map((e) => (
                  <li key={e.id} className="text-[13.5px]">
                    <a href={e.url ?? "#"} target="_blank" rel="noopener noreferrer" className="font-medium text-link hover:underline">
                      {e.sourceName} : « {e.title} »
                    </a>
                    <span className="text-muted"> — {e.points ?? 0} points{e.commentsCount ? `, ${e.commentsCount} ${en ? "comments" : "commentaires"}` : ""}{e.occurredAt ? `, ${e.occurredAt.getUTCFullYear()}` : ""}</span>
                  </li>
                ))}
                {comments.slice(0, 6).map((e) => (
                  <li key={e.id} className="rounded-xl bg-elev p-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span className="font-semibold text-fg">@{e.author}</span>
                      {e.occurredAt && <span>{e.occurredAt.getUTCFullYear()}</span>}
                      {e.title && <span className="truncate">· {en ? "in" : "dans"} « {e.title} »</span>}
                    </div>
                    {e.excerpt && <p className="mt-1 text-fg/85">{e.excerpt}</p>}
                    <a href={e.url ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-link hover:underline">
                      {t.video.hn} <IconExternal size={12} />
                    </a>
                  </li>
                ))}
                {comments.length > 6 && <li className="text-xs text-muted">{en ? `+ ${comments.length - 6} more mentions` : `+ ${comments.length - 6} autres mentions`}</li>}
              </ul>
            </section>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {universe && <Link href={`/univers/${universe.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] font-medium hover:text-accent">{label(universe.labels, locale)}</Link>}
            {card.subcategories.map((s) => <Link key={s.slug} href={`/univers/${s.universe}/${s.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] hover:text-accent">{label(s.labels, locale)}</Link>)}
            {themes.map((c) => <Link key={c.slug} href={`/themes/${c.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] text-muted hover:text-fg">{label(c.labels, locale)}</Link>)}
            {techs.map((c) => <Link key={c.slug} href={`/technologies/${c.slug.replace("techno-", "")}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] text-muted hover:text-fg">{label(c.labels, locale)}</Link>)}
            {brands.map((b) => <Link key={b.slug} href={`/marques/${b.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] text-muted hover:text-fg">{b.name}</Link>)}
            {models.map((m) => <Link key={m.slug} href={`/marques/${m.bslug}/${m.slug}`} className="rounded-md bg-elev px-2 py-0.5 text-[12.5px] text-muted hover:text-fg">{m.name}</Link>)}
            {tags.map((tg) => <Link key={tg.slug} href={`/recherche?q=${encodeURIComponent(tg.labels.fr)}`} className="rounded-md px-1 py-0.5 text-[12.5px] text-link hover:underline">#{tg.labels.fr}</Link>)}
          </div>

          {v.description && <Expandable text={v.description} more={`${t.video.description} — ${t.video.showMore}`} less={t.video.showLess} />}

          {breakdown && (
            <details className="group mt-3">
              <summary className="cursor-pointer list-none text-sm font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">{t.video.scoreDetails}</summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <tbody>
                    {breakdown.criteria.map((c) => (
                      <tr key={c.key} className="border-t border-line/70">
                        <td className="py-1.5 pr-3 font-medium">{CRITERIA_LABELS[c.key]?.[en ? 1 : 0] ?? c.key}</td>
                        <td className="w-28 py-1.5 pr-3">
                          {c.available ? (
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-elev"><span className="block h-full bg-accent" style={{ width: `${Math.round(c.score * 100)}%` }} /></span>
                              <span className="tabular-nums text-muted">{Math.round(c.score * 100)}</span>
                            </span>
                          ) : (
                            <span className="text-faint">{t.video.notMeasured}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-muted">{c.basis}</td>
                      </tr>
                    ))}
                    {breakdown.penalties.map((p) => (
                      <tr key={p.key} className="border-t border-line/70">
                        <td className="py-1.5 pr-3 font-medium">{en ? "Penalty" : "Pénalité"}</td>
                        <td className="py-1.5 pr-3 text-danger">−{p.points}</td>
                        <td className="py-1.5 text-muted">{p.basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-faint">
                  {en ? "Confidence" : "Confiance"} {Math.round((breakdown.confidence ?? 0) * 100)} % · {breakdown.version} · {v.analysisVersion} ·{" "}
                  <Link href="/a-propos#notation" className="underline">{en ? "methodology" : "méthode"}</Link>
                </p>
              </div>
            </details>
          )}
        </div>

        <div className="mt-3 text-right">
          <Link href={`/signaler?video=${v.externalId}`} className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-fg">
            <IconFlag size={13} /> {t.video.report}
          </Link>
        </div>

        {sameModel && (
          <section className="mt-8">
            <h2 className="mb-4 font-display text-lg font-semibold">
              <Link href={sameModel.href} className="hover:text-accent">{t.video.sameModel(sameModel.label)} →</Link>
            </h2>
            <div className="video-grid">{sameModel.items.slice(0, 4).map((x) => <VideoCard key={x.id} v={x} locale={locale} />)}</div>
          </section>
        )}
      </article>

      <aside className="w-full shrink-0 xl:w-[402px]" aria-label={t.video.related}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">{t.video.related}</h2>
          <LanguagePicker />
        </div>
        <div className="flex flex-col gap-3">
          {related.map((x) => (
            <VideoCard key={x.id} v={x} locale={locale} variant="compact" />
          ))}
          {!related.length && <p className="text-sm text-muted">{t.common.none}</p>}
        </div>
      </aside>
    </div>
  );
}
