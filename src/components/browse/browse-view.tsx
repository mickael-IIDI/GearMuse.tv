import { FilterBar } from "@/components/video/filter-bar";
import { LoadMore } from "@/components/video/load-more";
import { VideoGrid } from "@/components/video/video-card";
import { Chips, EmptyState, PageHeader } from "@/components/ui/page-header";
import { filtersToSearchParams, parseFilters, type FilterKey, type SortKey, type VideoFilters } from "@/lib/filters";
import { catalogCounts, listVideos } from "@/server/queries/videos";
import { LanguageResetButton } from "@/components/video-language/picker";
import { getI18n, getVideoLanguage } from "@/server/locale";

type SP = Record<string, string | string[] | undefined>;

/** Vue de liste réutilisée par toutes les pages de parcours (catégories, marques, sélections…). */
export async function BrowseView({
  searchParams,
  fixed = {},
  defaultSort,
  title,
  subtitle,
  crumbs,
  chips,
  groups,
  intro,
}: {
  searchParams: SP;
  fixed?: VideoFilters;
  defaultSort?: SortKey;
  title: string;
  subtitle?: React.ReactNode;
  crumbs?: { href: string; label: string }[];
  chips?: { href: string; label: string; active?: boolean; count?: number }[];
  groups?: FilterKey[];
  intro?: React.ReactNode;
}) {
  const [{ t, locale }, language] = await Promise.all([getI18n(), getVideoLanguage()]);
  const parsed = parseFilters(searchParams);
  const filters = { ...parsed.filters, ...fixed, langue: language };
  const sort = parsed.sort ?? defaultSort;
  const [list, counts] = await Promise.all([listVideos({ filters, sort, page: 1, withTotal: true }), catalogCounts()]);
  const query = filtersToSearchParams(filters, { tri: sort }).toString();
  const pct = counts.published ? Math.round((counts.withDuration / counts.published) * 100) : 100;
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} crumbs={crumbs}>
        {list.total != null && <p className="mt-2 text-sm text-faint">{t.common.videos(list.total)}</p>}
      </PageHeader>
      {intro}
      {/* Les compteurs des pastilles portent sur tout le catalogue : ils sont masqués quand une langue est choisie. */}
      {chips && <Chips items={language ? chips.map((c) => ({ ...c, count: undefined })) : chips} />}
      <FilterBar groups={groups} durationKnownPct={pct} locked={Object.keys(fixed)} />
      {list.items.length ? (
        <>
          <VideoGrid items={list.items} locale={locale} />
          <LoadMore key={query} endpoint="/api/videos" query={query} initialHasMore={list.hasMore} />
        </>
      ) : (
        <EmptyState title={language ? t.videoLanguage.empty : t.filters.empty}>{language && <LanguageResetButton />}</EmptyState>
      )}
    </>
  );
}
