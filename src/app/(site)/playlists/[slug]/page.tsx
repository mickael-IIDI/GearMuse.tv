import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { IconExternal } from "@/components/icons";
import { VideoCard } from "@/components/video/video-card";
import { EmptyState } from "@/components/ui/page-header";
import { label } from "@/lib/i18n";
import { getI18n } from "@/server/locale";
import { getPlaylist } from "@/server/queries/catalog";
import { Mosaic } from "@/components/video/mosaic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await getPlaylist((await params).slug);
  if (!r) return {};
  const p = r.playlist;
  return {
    title: p.seoTitle || p.titles.fr,
    description: p.seoDescription || p.descriptions?.fr || p.pitches?.fr || undefined,
    alternates: { canonical: `/playlists/${p.slug}` },
    openGraph: r.items[0]?.thumbnailUrl ? { images: [{ url: r.items[0].thumbnailUrl }] } : undefined,
    robots: r.items.length < 3 ? { index: false, follow: true } : undefined,
  };
}

export default async function PlaylistPage({ params }: Props) {
  const { t, locale } = await getI18n();
  const en = locale === "en";
  const r = await getPlaylist((await params).slug);
  if (!r) notFound();
  const { playlist: p, items } = r;
  const minutes = items.every((v) => v.durationSeconds != null) ? Math.round(items.reduce((s, v) => s + (v.durationSeconds ?? 0), 0) / 60) : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: p.titles.fr,
    itemListElement: items.map((v, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteConfig.url}/video/${v.slug}`, name: v.title })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="mb-8 flex flex-col gap-6 md:flex-row">
        <div className="w-full shrink-0 md:w-[360px]">
          <Mosaic covers={items.slice(0, 4).map((v) => ({ thumbnailUrl: v.thumbnailUrl, externalId: v.externalId }))} />
        </div>
        <div className="min-w-0">
          <nav className="mb-2 text-[13px] text-muted"><Link href="/playlists" className="hover:text-fg">{t.nav.playlists}</Link></nav>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight">{label(p.titles, locale)}</h1>
          <p className="mt-1 text-sm text-faint">
            {p.curatedBy ?? (en ? "Editorial" : "Rédaction")} · {t.common.videos(items.length)}{minutes ? ` · ${t.common.minutes(minutes)}` : ""}
            {p.kind === "smart" ? (en ? " · updated automatically from the catalog" : " · mise à jour automatiquement à partir du catalogue") : ""}
          </p>
          {p.descriptions && <p className="mt-3 max-w-2xl text-[15px] text-muted">{label(p.descriptions, locale)}</p>}
          {items.length > 1 && (
            <a href={`https://www.youtube.com/watch_videos?video_ids=${items.slice(0, 50).map((v) => v.externalId).join(",")}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink">
              {t.common.playAll} <IconExternal size={15} />
            </a>
          )}
        </div>
      </header>
      {items.length ? (
        <ol className="flex max-w-5xl flex-col gap-5">
          {items.map((v, i) => (
            <li key={v.id} className="flex gap-4">
              <span className="w-6 shrink-0 pt-2 text-right font-display text-lg font-semibold text-faint tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <VideoCard v={{ ...v, editorialSummary: v.note ?? v.editorialSummary }} locale={locale} variant="row" />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title={t.common.none} />
      )}
    </>
  );
}
