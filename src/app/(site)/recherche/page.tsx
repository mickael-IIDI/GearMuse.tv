import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/video/filter-bar";
import { LoadMore } from "@/components/video/load-more";
import { VideoCard } from "@/components/video/video-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { filtersToSearchParams, parseFilters } from "@/lib/filters";
import { LanguageResetButton } from "@/components/video-language/picker";
import { getI18n, getVideoLanguage } from "@/server/locale";
import { searchVideos } from "@/server/queries/videos";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseFilters(await searchParams);
  return { title: q ? `Recherche : ${q}` : "Recherche", robots: { index: false, follow: true } };
}

const EXAMPLES = [
  "Restauration complète d'une Porsche 911 ancienne",
  "Fonctionnement d'un moteur V12 Ferrari",
  "Comment fonctionne un moteur hors-bord ?",
  "Cockpit Airbus A350",
  "Construction d'un moteur d'avion",
  "Documentaire sur les 24 Heures du Mans",
];

export default async function SearchPage({ searchParams }: Props) {
  const { t, locale } = await getI18n();
  const { q, filters: urlFilters, sort } = parseFilters(await searchParams);
  const filters = { ...urlFilters, langue: await getVideoLanguage() };
  if (!q) {
    return (
      <>
        <PageHeader title={t.search.button} subtitle={locale === "en" ? "Natural language works, in French or English." : "Le langage naturel fonctionne, en français comme en anglais."} />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <Link key={e} href={`/recherche?q=${encodeURIComponent(e)}`} className="rounded-full bg-soft px-4 py-2 text-sm hover:bg-hover">{e}</Link>
          ))}
        </div>
      </>
    );
  }
  const r = await searchVideos(q, { filters, sort });
  const query = filtersToSearchParams(filters, { q, tri: sort }).toString();
  return (
    <>
      <PageHeader title={r.total ? t.search.results(r.total, q) : t.search.none(q)}>
        {r.suggestion && (
          <p className="mt-2 text-sm text-muted">
            {t.search.didYouMean}{" "}
            <Link className="font-medium text-link underline" href={`/recherche?${filtersToSearchParams(urlFilters, { q: r.suggestion }).toString()}`}>{r.suggestion}</Link>
          </p>
        )}
        {r.relaxed && <p className="mt-2 text-sm text-muted">{t.search.relaxed(q)}</p>}
      </PageHeader>
      <FilterBar search />
      {r.items.length ? (
        <>
          <div className="flex max-w-5xl flex-col gap-5">
            {r.items.map((v, i) => (
              <VideoCard key={v.id} v={v} locale={locale} variant="row" priority={i < 3} />
            ))}
          </div>
          <LoadMore key={query} endpoint="/api/videos" query={query} initialHasMore={r.hasMore} variant="row" />
        </>
      ) : (
        <EmptyState title={t.search.none(q)}>
          <p>{t.search.noneHint}</p>
          {filters.langue && <LanguageResetButton />}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {EXAMPLES.slice(0, 4).map((e) => (
              <Link key={e} href={`/recherche?q=${encodeURIComponent(e)}`} className="rounded-full bg-soft px-3 py-1.5 text-xs hover:bg-hover">{e}</Link>
            ))}
          </div>
        </EmptyState>
      )}
    </>
  );
}
